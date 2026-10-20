import { useMemo } from 'react';
import { computeInsights } from '../engine/insights';
import { buildJourney } from '../engine/orderJourney';
import { buildSnapshot } from '../engine/snapshot';
import { buildTodayStory } from '../engine/todayStory';
import { DEMO } from '../data/sources';

/**
 * What the live data means, derived from it and the rules: the snapshot, its insights (health,
 * attention, achievements), the followed order's journey and today's story.
 */
export const useFactoryView = ({ data, rules, followed }) => {
  const snapshot = useMemo(() => (data.clock
    ? buildSnapshot(data.raw, data.clock, rules, { sources: data.sources, demo: DEMO }) : null),
  [data.raw, data.clock, data.sources, rules]);

  const insights = useMemo(() => (snapshot ? computeInsights(snapshot, rules, data.clock) : null), [snapshot, rules, data.clock]);
  const journey = useMemo(() => (snapshot && followed ? buildJourney(snapshot, followed) : null), [snapshot, followed]);
  const story = useMemo(() => (snapshot ? buildTodayStory(snapshot, rules) : []), [snapshot, rules]);

  return { snapshot, insights, journey, story };
};
