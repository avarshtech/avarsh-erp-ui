import { useMemo } from 'react';
import { useScenario } from './useScenario';
import { useSimPlayer } from './useSimPlayer';

/**
 * Simulation mode as one object: the scenario and its comparison, the player, and the frame the
 * scene should show (null outside simulation mode).
 */
export const useSimulation = ({ snapshot, rules, active, branchKey }) => {
  const scenarioState = useScenario({ snapshot, rules, branchKey });
  const player = useSimPlayer({ comparison: scenarioState.comparison, scenario: scenarioState.scenario, active });
  const result = scenarioState.comparison?.result;
  const readyHour = useMemo(() => (result ? Math.max(0, result.frames.findIndex((f) => f.material)) : 0), [result]);

  const scene = useMemo(() => (active && result && player.frame ? {
    scenario: scenarioState.scenario, capacities: scenarioState.capacities, result, frame: player.frame, readyHour,
  } : null), [active, result, player.frame, scenarioState.scenario, scenarioState.capacities, readyHour]);

  return { ...scenarioState, player, scene };
};
