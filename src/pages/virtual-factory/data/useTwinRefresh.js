import { useEffect, useRef } from 'react';
import { useLiveActivityFeed } from '../../../context/LiveActivityFeedContext';
import { TIER_MS } from './sources';
import { ALL_TIERS } from './useTwinData';

/** How long after an activity-feed event the factory re-reads its fast sources. */
const FEED_NUDGE_MS = 3000;

/**
 * Keeps the twin live (once the branch context has loaded): everything on open and on a branch switch, the fast tier every 45 s and the
 * slow tier every 5 minutes while the tab is visible, and — for admins whose live activity feed is
 * connected — a fast re-read shortly after anything happens in the ERP.
 */
export const useTwinRefresh = ({ load, reset, branchKey, ready }) => {
  useEffect(() => {
    if (!ready) return undefined;
    reset();
    load(ALL_TIERS);
    const fast = setInterval(() => { if (!document.hidden) load(['fast']); }, TIER_MS.fast);
    const slow = setInterval(() => { if (!document.hidden) load(['slow']); }, TIER_MS.slow);
    return () => {
      clearInterval(fast);
      clearInterval(slow);
    };
  }, [ready, branchKey, load, reset]);

  const { events } = useLiveActivityFeed();
  const latest = events?.[0]?.eventId ?? null;
  const seen = useRef(latest);
  useEffect(() => {
    if (latest == null || latest === seen.current) return undefined;
    seen.current = latest;
    const timer = setTimeout(() => load(['fast']), FEED_NUDGE_MS);
    return () => clearTimeout(timer);
  }, [latest, load]);
};
