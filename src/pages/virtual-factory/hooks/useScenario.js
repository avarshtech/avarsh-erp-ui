import { useCallback, useMemo, useState } from 'react';
import { liveCapacities } from '../engine/simulation/capacities';
import { hypotheticalScenario, NO_WHAT_IF, scenarioForOrder } from '../engine/simulation/scenarios';
import { compareScenario } from '../engine/simulation/simEngine';

/** The order to simulate first: one in production, else the next open one, else a hypothetical order. */
const firstScenario = (snapshot, capacities) => {
  const order = snapshot.orders.find((o) => o.status === 'IN_PRODUCTION') || snapshot.orders.find((o) => o.status === 'CONFIRMED');
  return order ? scenarioForOrder(snapshot, capacities, order.no) : hypotheticalScenario(snapshot, capacities);
};

/**
 * Simulation inputs and results. Capacities are read from the live floor, then frozen with the
 * scenario once simulation starts, so the live refresh never moves a run that is playing.
 */
export const useScenario = ({ snapshot, rules, branchKey }) => {
  const live = useMemo(() => (snapshot ? liveCapacities(snapshot, rules) : null), [snapshot, rules]);
  const fallback = useMemo(() => (snapshot && live ? firstScenario(snapshot, live) : null), [snapshot, live]);
  const [held, setFrozen] = useState(null);
  const frozen = held?.branchKey === branchKey ? held : null;
  const capacities = frozen?.capacities || live;
  const scenario = frozen?.scenario || fallback;
  const comparison = useMemo(() => (scenario && capacities ? compareScenario(scenario, { ...scenario, ...NO_WHAT_IF }, capacities) : null),
    [scenario, capacities]);

  const setScenario = useCallback((next) => setFrozen((f) => ({
    scenario: next, capacities: (f?.branchKey === branchKey && f.capacities) || live, branchKey,
  })), [live, branchKey]);
  const forOrder = useCallback((orderNo) => setFrozen({
    scenario: orderNo ? scenarioForOrder(snapshot, live, orderNo) : hypotheticalScenario(snapshot, live), capacities: live, branchKey,
  }), [snapshot, live, branchKey]);
  const freeze = useCallback(() => setFrozen((f) => (f?.branchKey === branchKey ? f
    : fallback && live ? { scenario: fallback, capacities: live, branchKey } : null)), [fallback, live, branchKey]);
  const unfreeze = useCallback(() => setFrozen(null), []);

  return { capacities, scenario, setScenario, forOrder, freeze, unfreeze, comparison };
};
