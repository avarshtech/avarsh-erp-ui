import { useCallback, useEffect, useRef, useState } from 'react';
import { makeClock } from '../engine/clock';
import { buildSnapshot } from '../engine/snapshot';
import { diffSnapshots } from '../engine/snapshotDiff';
import { firstShiftId } from './composedLoaders';
import { loadSources } from './loadSources';
import { mergeLoad } from './mergeLoad';
import { DEMO, SOURCES } from './sources';

export const ALL_TIERS = ['fast', 'slow'];
const KEEP_EVENTS = 60;
const fresh = () => ({ raw: {}, sources: {}, written: {}, prev: null, seen: new Set(), epoch: 0, seq: 0 });

/**
 * Live factory data. Each load reads a tier of sources and merges into the latest copy (an older
 * load never overwrites a newer one); the new snapshot is diffed against the previous one, and the
 * differences not seen before are the business events. A branch switch starts a new epoch, so a
 * load still in flight from the old branch is dropped instead of reading as a flood of events.
 */
export const useTwinData = (rules) => {
  const [state, setState] = useState({ raw: {}, sources: {}, clock: null, events: [], loading: true, version: 0 });
  const store = useRef(fresh());
  const shift = useRef(null);
  const rulesRef = useRef(rules);
  useEffect(() => { rulesRef.current = rules; }, [rules]);

  const load = useCallback(async (tiers = ALL_TIERS) => {
    const epoch = store.current.epoch;
    store.current.seq += 1;
    const seq = store.current.seq;
    const clock = makeClock(new Date(), rulesRef.current);
    const shiftId = () => {
      shift.current = shift.current || firstShiftId().then((id) => {
        if (id == null) shift.current = null;
        return id;
      });
      return shift.current;
    };
    const result = await loadSources(SOURCES.filter((s) => tiers.includes(s.tier)), { ...clock, shiftId });
    const s = store.current;
    if (s.epoch !== epoch) return;
    Object.assign(s, mergeLoad(s, result, seq));
    const snapshot = buildSnapshot(s.raw, clock, rulesRef.current, { sources: s.sources, demo: DEMO });
    const events = diffSnapshots(s.prev, snapshot, rulesRef.current).filter((e) => !s.seen.has(e.id));
    events.forEach((e) => s.seen.add(e.id));
    s.prev = snapshot;
    setState((prev) => ({
      raw: s.raw, sources: s.sources, clock, loading: false, version: prev.version + 1,
      events: events.length ? [...prev.events, ...events].slice(-KEEP_EVENTS) : prev.events,
    }));
  }, []);

  /** Forget everything (a branch switch): loads still in flight belong to the old epoch and are dropped. */
  const reset = useCallback(() => {
    store.current = { ...fresh(), epoch: store.current.epoch + 1 };
  }, []);

  return { ...state, load, reset };
};
