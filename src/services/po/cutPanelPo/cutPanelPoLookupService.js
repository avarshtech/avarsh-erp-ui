/**
 * Cut Panel PO lookups: the processes released requirements carry, the requirements for one, the context the
 * screen's checks run on (gathered by the server), and Add to Grid, built here from the requirement and its
 * usage as the server reports them.
 */
import { get, post } from '../jobWork/jobWorkApi';
import { getCprOrderContext } from '../../bom/cutPanel/cutPanelService';
import { REQUIREMENT_SOURCE, cellId } from '../../../utils/jobWorkAllocation';
import { processLabel } from '../../../utils/cutPanelCalc';
import { cppLineFromCpr } from '../../../utils/jobWorkPoLines';

const LOOKUPS = '/cut-panel-pos/lookups';

/** Processes carried by released requirements, each with how many still have balance for it (FR-07). */
export const cppProcessOptions = () => get(`${LOOKUPS}/processes`);

/** The requirements for one process (FR-08/09): fully allocated ones stay listed, not selectable. */
export const cppEligibleCprs = (label) => get(`${LOOKUPS}/requirements`, { process: label });

/** What validateCpp needs — requirements as they are now, order dates, vendor, rates, duplicates. */
export const cppContext = (doc, { requirementIds } = {}) => post(`${LOOKUPS}/context`, {
  id: doc.id ?? null, vendorId: doc.vendor?.id ?? null, processName: doc.process?.name ?? null,
  processOtherName: doc.process?.otherName ?? null, poDate: doc.poDate ?? null, requirementIds: requirementIds ?? null,
  lines: (doc.lines || []).map((l) => ({ key: l.key, cprId: l.cprId, cprLineKey: l.cprLineKey, size: l.size })),
});

/**
 * Add to Grid (PRD §13.1): one PO line per CPR line × size for the PO's process, with the allocation at fetch
 * as "previously PO'd". Zero-balance cells come greyed with PO qty 0. Cells already on the PO are skipped;
 * lines follow colour, then panel, then size order.
 */
export const cppFetchLines = async ({ label, cprIds, colours, sizes, existing, firstKeyNo, uom }) => {
  const { state } = await cppContext({ lines: [] }, { requirementIds: cprIds });
  const have = new Set(existing.map((l) => `${l.cprId}|${l.cprLineKey}|${l.size}`));
  const out = [];
  let skipped = 0;
  let n = firstKeyNo;
  for (const id of cprIds) {
    const s = state?.[id];
    if (!s?.doc) continue;
    const order = await getCprOrderContext(s.doc.orderId);
    const colourRank = (name) => order.colors.findIndex((o) => o.name === name);
    const lines = s.doc.lines
      .filter((l) => processLabel(l) === label && (!colours?.length || colours.includes(l.colorName)))
      .sort((a, b) => colourRank(a.colorName) - colourRank(b.colorName) || a.panelName.localeCompare(b.panelName));
    lines.forEach((line) => order.sizes.filter((size) => (!sizes?.length || sizes.includes(size)) && line.sizes[size]?.requiredQty > 0)
      .forEach((size) => {
        if (have.has(`${s.doc.id}|${line.key}|${size}`)) { skipped += 1; return; }
        const cell = s.usage.cells.find((x) => x.cellId === cellId(REQUIREMENT_SOURCE.CPR, s.doc.id, line.key, size));
        out.push(cppLineFromCpr({ key: `L${n}`, cpr: s.doc, line, size, order, prevPoQty: Number(cell?.allocated) || 0, uom }));
        n += 1;
      }));
  }
  return { lines: out, skipped };
};
