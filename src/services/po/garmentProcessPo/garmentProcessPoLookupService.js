/**
 * Garment Process PO lookups: the requirement rows and cells the picker lists, the context the screen's checks
 * run on (gathered by the server), the vendor's last rates, and Add to PO, built here from the requirement and
 * its usage as the server reports them.
 */
import { get, post } from '../jobWork/jobWorkApi';
import { getGprOrderContext } from '../../bom/garmentProcess/garmentProcessService';
import { REQUIREMENT_SOURCE, cellId, gprCell } from '../../../utils/jobWorkAllocation';
import { gpoLineFromGpr } from '../../../utils/jobWorkPoLines';
import { getColorHex } from '../../../utils/colorConstants';

const BASE = '/garment-process-pos';

const lineRef = (l) => ({ key: l.key, gprId: l.gprId, gprLineKey: l.gprLineKey, color: l.color, size: l.size });

/** Requirement selection rows (PRD §9, S3): one per GPR process line with its allocation. */
export const gpoRequirementRows = () => get(`${BASE}/lookups/requirement-rows`);

/** The picker's cells of one requirement: line × colour × size with required, PO'd, in-draft and balance. */
export const gpoRequirementCells = async (gprId) => (await get(`${BASE}/lookups/requirements/${gprId}/cells`))
  .map((c) => ({ ...c, colorHex: getColorHex(c.color) }));

/** What validateGpo needs — requirements as they are now, order facts, vendor eligibility and last rates. */
export const gpoContext = (doc, { requirementIds } = {}) => post(`${BASE}/lookups/context`, {
  id: doc.id ?? null, vendorId: doc.vendor?.id ?? null, requirementIds: requirementIds ?? null,
  lines: (doc.lines || []).map(lineRef),
});

/** The vendor's last rates per UOM for the process the lines are for (§14). */
export const lastRates = async ({ vendor, lines }) => {
  if (!vendor?.id || !lines?.length) return { byKey: {}, recent: [] };
  const ctx = await gpoContext({ vendor, lines });
  return { byKey: ctx.lastRates || {}, recent: ctx.recentRates || [] };
};

/**
 * Add to PO (PRD FR-05, §9): one PO line per ticked cell (`gprId|lineKey|colour|size`), in the order given.
 * Cells already on the PO are skipped (V9); so are cells with nothing left to order.
 */
export const gpoFetchLines = async ({ cellKeys, existing, firstKeyNo, uom }) => {
  const gprIds = [...new Set(cellKeys.map((k) => Number(k.split('|')[0])))];
  const { state } = await gpoContext({ lines: [] }, { requirementIds: gprIds });
  const have = new Set(existing.map((l) => `${l.gprId}|${l.gprLineKey}|${l.color}|${l.size}`));
  const orders = new Map();
  const out = [];
  let onPo = 0;
  let noBalance = 0;
  let k = firstKeyNo;
  for (const cellKey of cellKeys) {
    const [gprId, lineKey, color, size] = cellKey.split('|');
    const s = state?.[gprId];
    const line = s?.doc?.lines.find((l) => l.key === lineKey);
    if (!line || !(Number(line.qty?.[color]?.[size]) > 0)) continue;
    if (have.has(cellKey)) { onPo += 1; continue; }
    const cell = s.usage.cells.find((x) => x.cellId === cellId(REQUIREMENT_SOURCE.GPR, s.doc.id, line.key, gprCell(color, size)));
    if (!(Number(cell?.balance) > 0)) { noBalance += 1; continue; }
    if (!orders.has(s.doc.orderId)) orders.set(s.doc.orderId, await getGprOrderContext(s.doc.orderId));
    out.push(gpoLineFromGpr({ key: `L${k}`, gpr: s.doc, line, color, size, order: orders.get(s.doc.orderId), prevPoQty: Number(cell.allocated), uom }));
    k += 1;
  }
  return { lines: out, onPo, noBalance };
};
