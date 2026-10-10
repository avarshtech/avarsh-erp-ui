/**
 * The carton numbers a packing list PRINTS (owner, 2026-10-09/10).
 *
 * Carton Packing numbers cartons per entry however the packers did it — most entries
 * start at 1 again. The packing list decides what prints, by the buyer's rule:
 *   CONTINUE  — one series over the whole list, from its first carton number;
 *   PER_PO    — every buyer PO starts at 1 (a PO covering two styles continues across both);
 *   PER_STYLE — every style (order) starts at 1.
 * A PO or style split across shipments restarts at 1 on each shipment's list.
 *
 * The list is walked segment by segment — its blocks in their order, each block's POs in
 * the shipment's order. Inside one segment (order x PO) the packers' own numbers are kept,
 * shifted to the group's next number, while no two cartons share one; when they clash
 * (every entry started at 1) the entries are stacked in packing-date order instead, each
 * keeping its own gaps.
 *
 * Pure: rows in, rows out. Every row keeps the entry's numbers as ownFrom/ownTo and gets
 * the printed ones as cartonFrom/cartonTo, so every printer, sticker and check that reads
 * cartonFrom/cartonTo reads what prints.
 */
import {
  toRanges, findRangeOverlaps, countCartons, formatRanges, mergeRanges, intersectRanges,
} from './expDocCalc';
import { subtractRanges, contentDiff } from './expDocPlanMatch';

export const NUMBERING = { CONTINUE: 'CONTINUE', PER_PO: 'PER_PO', PER_STYLE: 'PER_STYLE' };

export const NUMBERING_LABELS = {
  [NUMBERING.CONTINUE]: 'Continue across the shipment',
  [NUMBERING.PER_PO]: 'Restart for each buyer PO',
  [NUMBERING.PER_STYLE]: 'Restart for each style',
};

export const DEFAULT_NUMBERING = NUMBERING.CONTINUE;

/** The group a segment numbers in. The whole list, its style, or its PO number. */
export const groupKeyOf = (rule, segment) => {
  if (rule === NUMBERING.PER_STYLE) return `order:${segment.orderId}`;
  if (rule === NUMBERING.PER_PO) return `po:${segment.buyerPoNo ?? ''}`;
  return 'list';
};

/**
 * Whether two numbering groups (of two lists of one shipment) may not share carton numbers:
 * the same group, a continuing list against anything, or groups of different rules (a PO
 * of one list and a style of another can both print carton 1 for the same cartons' order).
 * Only two different POs, or two different styles, may both count from 1.
 */
const kindOf = (g) => String(g).split(':')[0];
export const groupsCollide = (a, b) => a === b || a === 'list' || b === 'list' || kindOf(a) !== kindOf(b);

const own = (r) => ({ from: Number(r.ownFrom ?? r.cartonFrom) || 0, to: Number(r.ownTo ?? r.cartonTo) || 0 });

/** One segment's rows placed from 0: own numbers kept when they do not clash, else entries stacked by date. */
const placeSegment = (rows) => {
  const ownRanges = rows.map((r) => ({ ...own(r), row: r })).filter((r) => r.from > 0 && r.to >= r.from);
  const clash = findRangeOverlaps(ownRanges.map((r) => ({ from: r.from, to: r.to }))).length > 0;
  if (!clash) {
    const base = Math.min(...ownRanges.map((r) => r.from));
    const top = Math.max(...ownRanges.map((r) => r.to));
    return {
      span: ownRanges.length ? top - base + 1 : 0,
      placed: ownRanges.map((r) => ({ row: r.row, from: r.from - base, to: r.to - base })),
    };
  }
  const byEntry = new Map();
  ownRanges.forEach((r) => {
    const key = r.row.sourceEntryId ?? 'none';
    if (!byEntry.has(key)) byEntry.set(key, []);
    byEntry.get(key).push(r);
  });
  const entries = [...byEntry.values()].sort((a, b) => String(a[0].row.packingDate ?? '').localeCompare(String(b[0].row.packingDate ?? ''))
    || Number(a[0].row.sourceEntryId ?? 0) - Number(b[0].row.sourceEntryId ?? 0));
  let offset = 0;
  const placed = [];
  entries.forEach((parts) => {
    const lo = Math.min(...parts.map((p) => p.from));
    const hi = Math.max(...parts.map((p) => p.to));
    parts.forEach((p) => placed.push({ row: p.row, from: p.from - lo + offset, to: p.to - lo + offset }));
    offset += hi - lo + 1;
  });
  return { span: offset, placed };
};

/** The segment key a plan is filed under: order and PO. */
export const planKeyOf = (orderId, poKey) => `${orderId}|${poKey ?? ''}`;

const span = (r) => ({ from: r.from, to: r.to });
const byDate = (a, b) => String(a.packingDate ?? '').localeCompare(String(b.packingDate ?? ''))
  || Number(a.sourceEntryId ?? 0) - Number(b.sourceEntryId ?? 0) || own(a).from - own(b).from;

/**
 * A segment with the buyer's plan prints the PLAN's numbers. A carton packed as per the
 * plan (its own numbers inside the plan's) keeps them — the one holding what the plan
 * says first, then by packing date, so two entries that both started at 1 never print the
 * same number; one packed before the plan takes the next free planned numbers that fit it,
 * in packing-date order, never those of a range marked Not shipping; one that fits nowhere
 * prints after the plan and is flagged by the plan check (V-19).
 * `planRanges`: [{ from, to, notShipping?, plan? }], `plan` the plan row (for its contents).
 */
const placeAgainstPlan = (rows, planRanges) => {
  const plan = mergeRanges(planRanges.map(span));
  const fillable = mergeRanges(planRanges.filter((r) => !r.notShipping).map(span));
  const top = Math.max(...plan.map((r) => r.to));
  const holdsPlanned = (row, o) => planRanges
    .filter((p) => p.plan && intersectRanges([o], [span(p)]).length)
    .every((p) => !contentDiff(p.plan, row).length);
  const placed = [];
  const leftover = [];
  rows
    .map((row) => {
      const o = own(row);
      const inside = o.from > 0 && o.to >= o.from && !subtractRanges([o], plan).length;
      return { row, o, inside, asPlanned: inside && holdsPlanned(row, o) };
    })
    .sort((a, b) => Number(b.asPlanned) - Number(a.asPlanned) || byDate(a.row, b.row))
    .forEach(({ row, o, inside }) => {
      if (inside && !intersectRanges([o], placed.map(span)).length) placed.push({ row, from: o.from, to: o.to });
      else leftover.push(row);
    });
  leftover.sort(byDate);
  let after = top;
  leftover.forEach((row) => {
    const n = own(row).to - own(row).from + 1;
    const fit = subtractRanges(fillable, placed.map(span)).find((f) => f.to - f.from + 1 >= n);
    if (fit) placed.push({ row, from: fit.from, to: fit.from + n - 1 });
    else { placed.push({ row, from: after + 1, to: after + n }); after += n; }
  });
  return { placed, top: Math.max(after, ...placed.map((p) => p.to)) };
};

/**
 * Number the list. `segments` [{ orderId, poKey, buyerPoNo }] in print order; a row
 * belongs to the segment with its orderId and poKey. Rows of no segment are left out.
 * `plans`: Map planKeyOf(orderId, poKey) -> the buyer's planned ranges, in printed numbers
 * ([{ from, to, notShipping?, plan? }], as expDocPlPlan.planRangesOf gives them).
 */
export const printedRows = (rows, segments, { rule = DEFAULT_NUMBERING, firstCartonNo = 1, plans = new Map() } = {}) => {
  const cursor = new Map();
  const out = [];
  segments.forEach((seg) => {
    const segRows = (rows || []).filter((r) => r.orderId === seg.orderId && (r.poKey ?? null) === (seg.poKey ?? null));
    if (!segRows.length) return;
    const group = groupKeyOf(rule, seg);
    const planned = plans.get(planKeyOf(seg.orderId, seg.poKey)) || [];
    if (planned.length) {
      // The buyer's numbers are absolute; the group carries on after the plan
      const { placed, top } = placeAgainstPlan(segRows, planned);
      placed.sort((a, b) => a.from - b.from).forEach(({ row, from, to }) => out.push({
        ...row, ownFrom: own(row).from, ownTo: own(row).to, cartonFrom: from, cartonTo: to, numberGroup: group,
      }));
      cursor.set(group, Math.max(cursor.get(group) ?? 1, top + 1));
      return;
    }
    const start = cursor.get(group) ?? (rule === NUMBERING.CONTINUE ? Math.max(1, Number(firstCartonNo) || 1) : 1);
    const { placed, span } = placeSegment(segRows);
    placed
      .sort((a, b) => a.from - b.from)
      .forEach(({ row, from, to }) => out.push({
        ...row,
        ownFrom: own(row).from,
        ownTo: own(row).to,
        cartonFrom: start + from,
        cartonTo: start + to,
        numberGroup: group,
      }));
    cursor.set(group, start + span);
  });
  return out;
};

/** Rows of a list by their numbering group, each group in carton order. */
export const rowsByGroup = (rows) => {
  const out = new Map();
  (rows || []).forEach((r) => {
    const g = r.numberGroup ?? '_';
    if (!out.has(g)) out.set(g, []);
    out.get(g).push(r);
  });
  out.forEach((list) => list.sort((a, b) => (a.cartonFrom || 0) - (b.cartonFrom || 0)));
  return out;
};

/** How many cartons a group prints on this list: the N of a restarting group's "n of N". */
export const groupCartonCount = (rows, group) =>
  countCartons(toRanges((rows || []).filter((r) => (r.numberGroup ?? '_') === group)));

/**
 * The carton ranges as one line: "1–120" for a continuing list; per group otherwise,
 * "PO 4500123: 1–40 · PO 4500456: 1–30", because the same number then appears in several.
 */
export const rangeLabelOf = (rows, rule) => {
  if (rule !== NUMBERING.PER_PO && rule !== NUMBERING.PER_STYLE) return formatRanges(toRanges(rows));
  return [...rowsByGroup(rows).entries()]
    .map(([, list]) => {
      const head = list[0];
      const name = rule === NUMBERING.PER_PO ? `PO ${head.buyerPoNo || '—'}` : (head.orderNo || head.styleNo || '—');
      return `${name}: ${formatRanges(toRanges(list))}`;
    })
    .join(' · ');
};

/** Cartons on the list, counted per group: under a restart rule numbers repeat across groups. */
export const distinctCartonsOf = (rows) => [...rowsByGroup(rows).values()]
  .reduce((n, list) => n + countCartons(toRanges(list)), 0);
