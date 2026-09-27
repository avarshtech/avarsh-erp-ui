/**
 * Garment Process PO lookups over the Garment Process Requirements (mock). Requirements
 * are read through their own service, so the API swap is a facade change; the ledger
 * comes from the PO store.
 */
import { listGprs, getGpr, getGprOrderContext } from '../../bom/garmentProcess/garmentProcessService';
import { usageInputs } from '../jobWork/allocationReader';
import { requirementUsage, REQUIREMENT_SOURCE, cellId, gprCell } from '../../../utils/jobWorkAllocation';
import { gprLineLabel } from '../../../utils/garmentProcessCalc';
import { gpoLineFromGpr } from '../../../utils/jobWorkPoLines';
import { GPO_VISIBLE } from '../../../utils/garmentProcessPoCalc';

const liveGprs = async () => {
  const visible = (await listGprs()).filter((s) => GPO_VISIBLE.includes(s.status));
  const docs = await Promise.all(visible.map((s) => getGpr(s.id)));
  const inputs = usageInputs(REQUIREMENT_SOURCE.GPR);
  return docs.map((doc) => ({ doc, usage: requirementUsage(REQUIREMENT_SOURCE.GPR, doc, inputs) }));
};

/**
 * GET /api/gpr/eligible — requirement selection rows (PRD §9, S3): one per GPR process
 * line with its allocation. Fully allocated lines come too; the screen hides or greys them.
 */
export const gpoRequirementRows = async () => {
  const live = await liveGprs();
  const orders = new Map(await Promise.all([...new Set(live.map((c) => c.doc.orderId))]
    .map(async (id) => [id, await getGprOrderContext(id)])));
  return live.flatMap(({ doc, usage }) => doc.lines.map((l) => {
    const u = usage.byLine[l.key];
    const order = orders.get(doc.orderId);
    return {
      key: `${doc.id}|${l.key}`, gprId: doc.id, gprNo: doc.requirementNo, gprLineKey: l.key,
      orderId: doc.orderId, orderNo: doc.orderNo, buyer: doc.buyer, styleNo: doc.styleNo,
      garment: order?.garmentDescription ?? null, requiredBy: order?.deliveryDate ?? null, submittedOn: doc.submittedOn,
      seqNo: l.seqNo, processLabel: gprLineLabel(l), processName: l.processName, processOtherName: l.processOtherName,
      colors: Object.keys(l.qty || {}), required: u?.required ?? 0, allocated: u?.allocated ?? 0,
      inDraft: u?.inDraft ?? 0, balance: u?.balance ?? 0, status: usage.status,
    };
  })).filter((r) => r.required > 0).sort((x, y) => x.gprNo.localeCompare(y.gprNo) || x.seqNo - y.seqNo);
};

/**
 * Add selected to PO lines (PRD FR-05, §9): one PO line per GPR line × colour × size with
 * balance, in the order's colour and size sequence. Cells already on the PO are skipped
 * (V9); so are cells with nothing left to order.
 */
export const gpoFetchLines = async ({ rowKeys, existing, firstKeyNo, uom }) => {
  const live = await liveGprs();
  const have = new Set(existing.map((l) => `${l.gprId}|${l.gprLineKey}|${l.color}|${l.size}`));
  const out = [];
  let onPo = 0;
  let noBalance = 0;
  let k = firstKeyNo;
  for (const rowKey of rowKeys) {
    const [gprId, lineKey] = rowKey.split('|');
    const c = live.find((x) => x.doc.id === Number(gprId));
    const line = c?.doc.lines.find((l) => l.key === lineKey);
    if (!line) continue;
    const order = await getGprOrderContext(c.doc.orderId);
    order.colors.map((o) => o.name).filter((color) => line.qty?.[color]).forEach((color) => order.sizes
      .filter((size) => Number(line.qty[color][size]) > 0)
      .forEach((size) => {
        if (have.has(`${c.doc.id}|${line.key}|${color}|${size}`)) { onPo += 1; return; }
        const cell = c.usage.cells.find((x) => x.cellId === cellId(REQUIREMENT_SOURCE.GPR, c.doc.id, line.key, gprCell(color, size)));
        if (!(cell?.balance > 0)) { noBalance += 1; return; }
        out.push(gpoLineFromGpr({ key: `L${k}`, gpr: c.doc, line, color, size, order, prevPoQty: cell.allocated, uom }));
        k += 1;
      }));
  }
  return { lines: out, onPo, noBalance };
};

/** The GPRs a PO draws on, as they are now: status, lines and per-cell usage (V12, V15). */
export const gpoRequirementState = async (gprIds) => {
  const docs = await Promise.all(gprIds.map((id) => getGpr(id).catch(() => null)));
  const inputs = usageInputs(REQUIREMENT_SOURCE.GPR);
  return Object.fromEntries(gprIds.map((id, i) => {
    const doc = docs[i];
    if (!doc) return [id, null];
    const usage = requirementUsage(REQUIREMENT_SOURCE.GPR, doc, inputs);
    return [id, { status: usage.status, doc, usage }];
  }));
};
