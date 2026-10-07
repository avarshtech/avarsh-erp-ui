import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { simMilestones } from '../engine/simulation/milestones';

export const SPEEDS = [0.5, 1, 2, 5, 10];
const TICK_MS = 250;
/** At 1× one simulated working hour passes every real second. */
const HOURS_PER_SECOND = 1;

/**
 * Plays a simulation result hour by hour: play, pause, stop, restart and speed. Passing a milestone
 * (fabric in, cutting starts, sewing starts, cartons packed, truck leaves) raises a visual event.
 */
export const useSimPlayer = ({ comparison, scenario, active }) => {
  const result = comparison?.result;
  const key = result ? `${result.total}-${result.totalHours}-${JSON.stringify(scenario)}` : '';
  const [state, setState] = useState({ key: '', hour: 0, playing: false, speed: 1, run: 0, events: [] });
  const current = state.key === key ? state : { ...state, key, hour: 0, playing: false, events: [] };
  const live = useRef(current);
  useEffect(() => { live.current = current; });
  const milestones = useMemo(() => (result ? simMilestones(result, scenario) : []), [result, scenario]);

  useEffect(() => {
    if (!active || !current.playing || !result) return undefined;
    const timer = setInterval(() => {
      const s = live.current;
      const hour = Math.min(result.totalHours, s.hour + (TICK_MS / 1000) * s.speed * HOURS_PER_SECOND);
      const crossed = milestones.filter((m) => m.hour > s.hour && m.hour <= hour).map((m) => ({ ...m.event, id: `sim-${s.run}-${m.event.id}` }));
      setState({ ...s, hour, playing: hour < result.totalHours, events: crossed.length ? [...s.events, ...crossed] : s.events });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [active, current.playing, result, milestones]);

  const patch = useCallback((change) => setState((s) => ({ ...(s.key === key ? s : { ...s, key, hour: 0, events: [] }), ...change })), [key]);
  const frame = result ? result.frames[Math.min(result.frames.length - 1, Math.floor(current.hour))] : null;

  return {
    hour: current.hour, playing: current.playing, speed: current.speed, frame, events: current.events,
    play: () => patch(current.hour >= (result?.totalHours ?? 0) ? { hour: 0, events: [], run: current.run + 1, playing: true } : { playing: true }),
    pause: () => patch({ playing: false }),
    stop: () => patch({ playing: false, hour: 0, events: [], run: current.run + 1 }),
    restart: () => patch({ playing: true, hour: 0, events: [], run: current.run + 1 }),
    setSpeed: (speed) => patch({ speed }),
    seek: (hour) => patch(hour < current.hour ? { hour, events: [], run: current.run + 1 } : { hour }),
  };
};
