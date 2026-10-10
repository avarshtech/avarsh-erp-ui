/**
 * The buyer's plan on a packing list (owner, 2026-10-09): when the buyer's packing list
 * fixes the carton breakdown, it is typed once, per order, as carton ranges in the BUYER's
 * numbers, each for one PO. Carton Packing then packs "as per packing list" and the list
 * prints the plan's numbers. Kept on the list: `pl.plans[orderId] = { rows, seq }`.
 *
 * A planned range the shipment will not carry (a short shipment) is marked Not shipping
 * with a reason, rather than deleted, so the buyer's plan stays on record.
 */
import { attributeRange, soloKeyOf, ELSEWHERE } from './expDocPlBlocks';
import { planKeyOf } from '../../utils/expDocPlNumbering';
import { findRangeOverlaps, toRanges } from '../../utils/expDocCalc';
import { entryIssues } from '../../utils/packingEntryIssues';

/** The plan rows of one order, each with the PO group it belongs to. */
export const planRowsOf = (pl, orderId) => pl.plans?.[orderId]?.rows || [];

/**
 * The planned ranges per order x PO, for the numbering (expDocPlNumbering.printedRows):
 * each with its plan row (what its cartons hold) and whether it is marked Not shipping.
 */
export const planRangesOf = (pl) => {
  const out = new Map();
  Object.entries(pl.plans || {}).forEach(([orderId, plan]) => (plan.rows || []).forEach((r) => {
    const key = planKeyOf(Number(orderId), r.poKey ?? null);
    out.set(key, [...(out.get(key) || []), {
      from: Number(r.cartonFrom), to: Number(r.cartonTo), notShipping: Boolean(r.notShipping), plan: r,
    }]);
  }));
  return out;
};

const fail = (message) => {
  const e = new Error(message);
  e.code = 'VALIDATION';
  throw e;
};

/**
 * Check and store one order's plan. Each row needs a sound carton range and contents (the
 * same structural checks as a packing entry), a PO this shipment carries for the order,
 * and no two rows of one PO may share a carton number. Rows keep their ids; new ones get
 * `plan-n` from the order's counter.
 */
export const applyPlan = (pl, orderId, rows, poGroups, meta) => {
  const solo = soloKeyOf(poGroups, meta);
  const prev = pl.plans?.[orderId] || { rows: [], seq: 0 };
  let seq = prev.seq || 0;
  const kept = new Map((prev.rows || []).map((r) => [r.id, r]));
  const placed = rows.map((row) => {
    const key = attributeRange(row, poGroups, solo);
    if (key === undefined || key === ELSEWHERE) {
      fail(`Cartons ${row.cartonFrom}–${row.cartonTo}: pick a buyer PO this shipment carries for the order.`);
    }
    const id = kept.has(row.id) ? row.id : `plan-${(seq += 1)}`;
    const { cartonCount: _c, piecesPerCarton: _p, totalPieces: _t, cbm: _cbm, ...fields } = row;
    return { ...fields, id, poKey: key, notShipping: kept.get(row.id)?.notShipping ?? null };
  });
  const errors = entryIssues({ groups: placed }).filter((i) => i.severity === 'ERROR' && i.code !== 'V-02');
  if (errors.length) fail(errors[0].message);
  const byPo = new Map();
  placed.forEach((r) => byPo.set(r.poKey ?? '', [...(byPo.get(r.poKey ?? '') || []), r]));
  byPo.forEach((list) => {
    const clash = findRangeOverlaps(toRanges(list))[0];
    if (clash) fail(`Cartons ${clash.from}–${clash.to} are planned twice for one PO.`);
  });
  pl.plans = { ...(pl.plans || {}), [orderId]: { rows: placed, seq } };
  return pl;
};

/** Mark a planned range Not shipping (with a reason), or shipping again (reason null). */
export const markNotShipping = (pl, orderId, planRowId, reason) => {
  const plan = pl.plans?.[orderId];
  const row = plan?.rows?.find((r) => r.id === planRowId);
  if (!row) fail('That planned range is no longer on the plan.');
  const text = reason == null ? null : String(reason).trim();
  if (text != null && text.length < 10) fail('Give a reason of at least 10 characters — it is kept with the plan.');
  row.notShipping = text ? { reason: text } : null;
  return row;
};
