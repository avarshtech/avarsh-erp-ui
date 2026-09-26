/**
 * Garment Process Requirement calculations — pure functions, no React.
 *
 * A GPR has one order and 1..n process LINES (PRD §11):
 *   { key, seqNo, processId, processName, processOtherName,
 *     colors: [colour names], sizes: [size names],
 *     qty: { [colour]: { [size]: processQty } },   // every cell, selected or not
 *     overQtyReasons: { 'colour|size': reason },
 *     orderQtySnapshot: { [colour]: { [size]: orderQty } } }  // written at Submit
 *
 * Deselecting a colour or size keeps its typed quantity in `qty` for the session;
 * only selected cells count in totals and are saved (PRD §9).
 */
import { GPR_OTHER_PROCESS_NAME, GPR_VAL } from './garmentProcessConstants';

export const cellKey = (color, size) => `${color}|${size}`;

const copyMatrix = (m) => Object.fromEntries(Object.entries(m || {}).map(([c, row]) => [c, { ...row }]));

/** A new line: every colour and size selected, each cell = its order qty (PRD §8 "+ Add process"). */
export const newGprLine = (order, key, seqNo) => ({
  key, seqNo, processId: null, processName: null, processOtherName: null,
  colors: order.colors.map((c) => c.name),
  sizes: [...order.sizes],
  qty: copyMatrix(order.qtyMatrix),
  overQtyReasons: {},
});

export const gprLineLabel = (line) => {
  if (!line.processName) return null;
  return line.processName === GPR_OTHER_PROCESS_NAME && line.processOtherName ? line.processOtherName : line.processName;
};

/** Selected cells in the order's colour and size sequence. */
export const selectedCells = (line, order) => order.colors
  .filter((c) => line.colors.includes(c.name))
  .flatMap((c) => order.sizes.filter((s) => line.sizes.includes(s)).map((size) => ({ color: c.name, size })));

const orderQtyOf = (order, color, size) => order.qtyMatrix[color]?.[size] || 0;
const processQtyOf = (line, color, size) => line.qty[color]?.[size];

/** Row, column and line totals over the selected cells, plus the order qty they cover. */
export const gprLineTotals = (line, order) => {
  const rows = {};
  const cols = {};
  let total = 0;
  let orderQty = 0;
  selectedCells(line, order).forEach(({ color, size }) => {
    const v = Number(processQtyOf(line, color, size)) || 0;
    rows[color] = (rows[color] || 0) + v;
    cols[size] = (cols[size] || 0) + v;
    total += v;
    orderQty += orderQtyOf(order, color, size);
  });
  return { rows, cols, total, orderQty };
};

export const overQtyCells = (line, order) => selectedCells(line, order)
  .filter(({ color, size }) => Number(processQtyOf(line, color, size)) > orderQtyOf(order, color, size));

export const negativeCells = (line, order) => selectedCells(line, order)
  .filter(({ color, size }) => Number(processQtyOf(line, color, size)) < 0);

export const renumberGprLines = (lines) => lines.map((l, i) => ({ ...l, seqNo: i + 1 }));

/** A colour or size selected for the first time starts at its order qty (PRD §10); typed values are kept. */
export const ensureSelectedCells = (line, order) => {
  const qty = copyMatrix(line.qty);
  selectedCells(line, order).forEach(({ color, size }) => {
    if (qty[color]?.[size] === undefined) qty[color] = { ...(qty[color] || {}), [size]: orderQtyOf(order, color, size) };
  });
  return { ...line, qty };
};

/** ↑ / ↓ swap with the neighbour (PRD §8); sequence renumbers 1..n. */
export const moveGprLine = (lines, index, delta) => {
  const to = index + delta;
  if (to < 0 || to >= lines.length) return lines;
  const next = [...lines];
  [next[index], next[to]] = [next[to], next[index]];
  return renumberGprLines(next);
};

/** "Copy from previous Seq": colours, sizes and cell quantities, overwriting the active line. */
export const copyFromPrevious = (lines, index) => {
  if (index < 1) return lines;
  const prev = lines[index - 1];
  return lines.map((l, i) => (i === index
    ? { ...l, colors: [...prev.colors], sizes: [...prev.sizes], qty: copyMatrix(prev.qty), overQtyReasons: { ...prev.overQtyReasons } }
    : l));
};

export const resetToOrderQty = (line, order) => ({ ...line, qty: copyMatrix(order.qtyMatrix), overQtyReasons: {} });

/** The flow line: process names in sequence, e.g. "Enzyme Washing → Bleach Washing". */
export const gprFlowLabel = (lines) => lines.map(gprLineLabel).filter(Boolean).join(' → ');

/** Only the selected cells are saved (PRD §9); reasons only for cells still above the order qty. */
export const toSavedLine = (line, order) => {
  const qty = {};
  selectedCells(line, order).forEach(({ color, size }) => {
    qty[color] = { ...(qty[color] || {}), [size]: Number(processQtyOf(line, color, size)) || 0 };
  });
  const over = new Set(overQtyCells(line, order).map(({ color, size }) => cellKey(color, size)));
  const overQtyReasons = Object.fromEntries(Object.entries(line.overQtyReasons || {}).filter(([k]) => over.has(k)));
  return { ...line, qty, overQtyReasons };
};

/**
 * Validation (PRD §16). Save checks V1 and V6 only; Submit runs everything.
 * Returns { errors, firstKey } — firstKey is the first offending line, selected by the screen.
 */
export const validateGpr = (doc, order, { forSubmit, canOverQty }) => {
  const errors = [];
  let firstKey = null;
  const flag = (line, msg) => { errors.push(msg); if (!firstKey && line) firstKey = line.key; };
  if (!doc.orderId || !order) return { errors: [GPR_VAL.V1], firstKey };
  doc.lines.forEach((l) => negativeCells(l, order).forEach(({ color, size }) => flag(l, GPR_VAL.V6(l.seqNo, color, size))));
  if (!forSubmit) return { errors, firstKey };
  if (!doc.lines.length) flag(null, GPR_VAL.V2);
  // Lines carry the process NAME as their snapshot (unique within the 'Garment'
  // category); the id is kept alongside when it was picked from the master.
  const seen = {};
  doc.lines.forEach((l) => {
    if (!l.processName) flag(l, GPR_VAL.V3(l.seqNo));
    else if (l.processName === GPR_OTHER_PROCESS_NAME && !String(l.processOtherName || '').trim()) flag(l, GPR_VAL.V3_OTHER(l.seqNo));
    const label = gprLineLabel(l);
    if (label && seen[label.toLowerCase()]) flag(l, GPR_VAL.V8(l.seqNo));
    if (label) seen[label.toLowerCase()] = true;
    if (!l.colors.length) flag(l, GPR_VAL.V4(l.seqNo));
    if (!l.sizes.length) flag(l, GPR_VAL.V5(l.seqNo));
    if (l.colors.length && l.sizes.length && !(gprLineTotals(l, order).total > 0)) flag(l, GPR_VAL.V10(l.seqNo));
    overQtyCells(l, order).forEach(({ color, size }) => {
      if (!canOverQty) flag(l, GPR_VAL.V7_BLOCK(l.seqNo, color, size));
      else if (!String(l.overQtyReasons?.[cellKey(color, size)] || '').trim()) flag(l, GPR_VAL.V7_REASON(l.seqNo, color, size));
    });
  });
  return { errors, firstKey };
};

/** OP-2: per-process total already requested on the order by its other open GPRs. */
export const requestedByProcess = (otherGprs) => {
  const out = {};
  otherGprs.forEach((g) => g.lines.forEach((l) => {
    out[l.label] ||= { label: l.label, total: 0, requirementNos: [] };
    out[l.label].total += l.total;
    out[l.label].requirementNos.push(g.requirementNo);
  }));
  return Object.values(out);
};
