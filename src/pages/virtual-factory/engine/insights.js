import { computeAchievements, lineLeaderboard } from './achievements.js';
import { buildAttention, findBottlenecks } from './attention.js';
import { computeHealth } from './healthScore.js';

/** Everything the screen concludes from a snapshot: bottlenecks, attention list, health, achievements. */
export const computeInsights = (snapshot, rules, clock) => {
  const bottlenecks = findBottlenecks(snapshot, rules, clock);
  const attention = buildAttention(snapshot, rules, bottlenecks, clock);
  const health = computeHealth(snapshot, rules, clock);
  return {
    bottlenecks,
    attention,
    health,
    achievements: computeAchievements(snapshot, rules, clock, health),
    leaderboard: lineLeaderboard(snapshot),
  };
};
