/**
 * TNA scheduling engine — a faithful browser-side implementation of BRD §8.
 * Pure functions; no I/O. Reproduces the §9 worked examples exactly (AC-04/05/06):
 * route filter → leadtime scaling → forward pass → proportional compression →
 * backward pass → feasibility classification.
 */
import dayjs from 'dayjs';

/** §8.3 — drop route-conditional activities absent from the style, re-linking
 *  each removed activity's predecessors onto its successors. */
export const filterByRoute = (lines, routeOps = []) => {
  const removed = new Set(
    lines.filter((l) => l.conditionalOnRoute && !routeOps.includes(l.routeOperation)).map((l) => l.code),
  );
  if (removed.size === 0) return lines.map((l) => ({ ...l, predecessors: [...l.predecessors] }));
  const byCode = Object.fromEntries(lines.map((l) => [l.code, l]));
  const resolve = (code) => (removed.has(code) ? byCode[code].predecessors.flatMap(resolve) : [code]);
  return lines
    .filter((l) => !removed.has(l.code))
    .map((l) => ({ ...l, predecessors: [...new Set(l.predecessors.flatMap(resolve))] }));
};

/** §8.4 — raw = round-half-up(pct/100 × leadtime); clamp to [min,max]; fixed bypasses. */
export const scaleDurations = (lines, leadtime) => lines.map((l) => {
  const raw = Math.round((l.durationPct / 100) * leadtime);
  const effective = l.fixed ? l.baseDays : Math.max(l.minDays, Math.min(l.maxDays, raw));
  return { ...l, rawDays: raw, effectiveDays: effective };
});

/** Kahn topological order over the predecessor graph. */
const topoSort = (lines) => {
  const indeg = Object.fromEntries(lines.map((l) => [l.code, l.predecessors.length]));
  const succ = {};
  lines.forEach((l) => l.predecessors.forEach((p) => { (succ[p] = succ[p] || []).push(l.code); }));
  const order = [];
  const queue = lines.filter((l) => indeg[l.code] === 0).map((l) => l.code);
  while (queue.length) {
    const c = queue.shift();
    order.push(c);
    (succ[c] || []).forEach((s) => { if (--indeg[s] === 0) queue.push(s); });
  }
  return { order, succ, cyclic: order.length !== lines.length };
};

/** §8.5 — ES(a) = max(ES(pred)) + effectiveDays(a). Returns {es, criticalPath}. */
export const forwardPass = (lines) => {
  const byCode = Object.fromEntries(lines.map((l) => [l.code, l]));
  const { order } = topoSort(lines);
  const es = {};
  order.forEach((c) => {
    const l = byCode[c];
    const base = l.predecessors.length ? Math.max(...l.predecessors.map((p) => es[p])) : 0;
    es[c] = base + l.effectiveDays;
  });
  return { es, criticalPath: Math.max(...Object.values(es)) };
};

/** Backward pass anchored at `anchor` (leadtime for real LS; CP length to find the critical chain). */
const backwardFrom = (lines, es, anchor) => {
  const { order, succ } = topoSort(lines);
  const byCode = Object.fromEntries(lines.map((l) => [l.code, l]));
  const ls = {};
  [...order].reverse().forEach((c) => {
    const successors = succ[c] || [];
    ls[c] = successors.length
      ? Math.min(...successors.map((s) => ls[s] - byCode[s].effectiveDays))
      : anchor;
  });
  return ls;
};

/** §8.6 — iterative proportional compression. Mutates nothing; returns new lines + audit. */
export const compress = (lines, leadtime) => {
  let work = lines.map((l) => ({ ...l }));
  const compressedFrom = {};
  for (let guard = 0; guard < 50; guard += 1) {
    const { es, criticalPath } = forwardPass(work);
    const excess = criticalPath - leadtime;
    if (excess <= 0) break;
    const ls = backwardFrom(work, es, criticalPath);
    const critical = work.filter((l) => ls[l.code] - es[l.code] === 0);
    const slack = (l) => (l.fixed ? 0 : l.effectiveDays - l.minDays);
    const totalSlack = critical.reduce((s, l) => s + slack(l), 0);
    if (totalSlack === 0) break; // infeasible — caller classifies
    const reduction = Math.min(excess, totalSlack);
    const cuts = {};
    critical.forEach((l) => { cuts[l.code] = Math.min(slack(l), Math.round((reduction * slack(l)) / totalSlack)); });
    let residual = reduction - Object.values(cuts).reduce((s, v) => s + v, 0);
    while (residual > 0) { // §8.6.5 — residual to the activity with most remaining slack
      const target = critical
        .filter((l) => slack(l) - cuts[l.code] > 0)
        .sort((a, b) => (slack(b) - cuts[b.code]) - (slack(a) - cuts[a.code]))[0];
      if (!target) break;
      cuts[target.code] += 1;
      residual -= 1;
    }
    work = work.map((l) => {
      const cut = cuts[l.code] || 0;
      if (!cut) return l;
      compressedFrom[l.code] = (compressedFrom[l.code] || 0) + cut;
      return { ...l, effectiveDays: l.effectiveDays - cut };
    });
  }
  return { lines: work, compressedFrom };
};

/** Full §8 pipeline. Returns plan lines with es/ls/float/dates + header figures. */
export const generateSchedule = ({ templateLines, leadtime, orderReceived, routeOps = [] }) => {
  const routed = filterByRoute(templateLines, routeOps);
  const scaled = scaleDurations(routed, leadtime);
  const before = forwardPass(scaled).criticalPath;
  const { lines, compressedFrom } = compress(scaled, leadtime);
  const { es, criticalPath } = forwardPass(lines);
  const ls = backwardFrom(lines, es, leadtime); // §8.7 — anchored at ETD
  const compressedDays = Object.values(compressedFrom).reduce((s, v) => s + v, 0);
  const feasibility = criticalPath <= leadtime
    ? (compressedDays > 0 ? 'FEASIBLE_COMPRESSED' : 'FEASIBLE')
    : 'INFEASIBLE';
  const anchor = dayjs(orderReceived);
  return {
    feasibility,
    criticalPathBefore: before,
    criticalPathAfter: criticalPath,
    compressedDays,
    compressedFrom,
    shortfallDays: Math.max(0, criticalPath - leadtime),
    plannedDispatch: anchor.add(criticalPath, 'day').format('YYYY-MM-DD'),
    lines: lines.map((l, i) => ({
      ...l,
      sequence: i + 1,
      esOffset: es[l.code],
      lsOffset: ls[l.code],
      floatDays: ls[l.code] - es[l.code],
      isCritical: ls[l.code] - es[l.code] <= 0,
      plannedDate: anchor.add(es[l.code], 'day').format('YYYY-MM-DD'),
      latestAllowableDate: anchor.add(ls[l.code], 'day').format('YYYY-MM-DD'),
      compressedBy: compressedFrom[l.code] || 0,
    })),
  };
};

/** §8.10 row 4 — projection only: actuals re-anchor downstream, committed dates untouched. */
export const projectDispatch = (planLines, orderReceived) => {
  const anchor = dayjs(orderReceived);
  const byCode = Object.fromEntries(planLines.map((l) => [l.code, l]));
  const { order } = topoSort(planLines);
  const sim = {};
  order.forEach((c) => {
    const l = byCode[c];
    if (l.actualDate) { sim[c] = dayjs(l.actualDate).diff(anchor, 'day'); return; }
    const base = l.predecessors.length ? Math.max(...l.predecessors.map((p) => sim[p])) : 0;
    sim[c] = Math.max(base + l.effectiveDays, l.esOffset);
  });
  const dispatchOffset = Math.max(...Object.values(sim));
  return anchor.add(dispatchOffset, 'day').format('YYYY-MM-DD');
};

/** VR-04 — cycle detection for the template builder. */
export const hasCycle = (lines) => topoSort(lines).cyclic;
