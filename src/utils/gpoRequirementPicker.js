/**
 * The Garment Process PO's requirement picker (PRD §9, S3): Order # → Garment Process # →
 * its colour × size cells. One process per PO (deviation D23): once the PO's lines or the
 * ticks name a process, cells of another process cannot be ticked. Pure functions.
 */

/** Orders with a released requirement line that still has balance (`rows` = gpoRequirementRows()). */
export const orderOptions = (rows) => [...new Map(rows.filter((r) => r.balance > 0)
  .map((r) => [r.orderId, { value: r.orderId, label: `${r.orderNo} · ${r.buyer} · ${r.styleNo}` }])).values()];

/** Requirements with balance — on the picked order, or on any order until one is picked — and their processes. */
export const gprOptions = (rows, orderId) => {
  const byGpr = new Map();
  rows.filter((r) => r.balance > 0 && (!orderId || r.orderId === orderId)).forEach((r) => {
    const g = byGpr.get(r.gprId) || { value: r.gprId, orderId: r.orderId, gprNo: r.gprNo, orderNo: r.orderNo, processes: [] };
    if (!g.processes.includes(r.processLabel)) g.processes.push(r.processLabel);
    byGpr.set(r.gprId, g);
  });
  return [...byGpr.values()].map(({ processes, gprNo, orderNo, ...g }) => ({
    ...g, label: `${gprNo} · ${processes.join(', ')}${orderId ? '' : ` · ${orderNo}`}`,
  }));
};

/** The PO's process: its lines', else the first ticked cell's in table order, else none yet. */
export const pickerProcess = (poProcess, cells, keys) => poProcess ?? cells.find((c) => keys.includes(c.key))?.processLabel ?? null;

/** Why a cell cannot be ticked, or null. `onPo` holds the cell keys already on the PO. */
export const cellBlockReason = (cell, { onPo, process }) => {
  if (onPo.has(cell.key)) return 'Already on this PO';
  if (!(cell.balance > 0)) return 'No balance left';
  if (process && cell.processLabel !== process) return `One process per PO: this PO is ${process}`;
  return null;
};

/**
 * The ticks a selection change may keep: unblocked cells of one process. With nothing ticked
 * and no process yet, the header's select-all therefore takes the first process only.
 */
export const normalisePicked = (cells, keys, poProcess, onPo) => {
  const process = pickerProcess(poProcess, cells, keys);
  return cells.filter((c) => keys.includes(c.key) && !cellBlockReason(c, { onPo, process })).map((c) => c.key);
};
