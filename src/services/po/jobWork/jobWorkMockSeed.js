/**
 * Seed POs for the job-work mock (UI mock phase). Dates are relative to the seeding day.
 *
 * Cut Panel POs
 *   CPP-2026-00031  CPR-2026-00005 Panel Printing, Navy 2Y / 4Y (800) — Sent to Vendor.
 *                   The PO PRD §13.4 worked example starts from here: 3,160 pcs still open.
 *   CPP-2026-00032  CPR-2026-00003 Panel Printing, Black (4,120) — Partially Completed, overdue.
 *   CPP-2026-00033  CPR-2026-00003 Panel Printing, Navy (3,091) — Submitted by Karthik S:
 *                   approving it makes CPR-2026-00003 Fully Used.
 *   CPP-2026-00034  CPR-2026-00005 Panel Embroidery — Draft by Karthik S with a pending
 *                   over-allocation override (White 2Y +6).
 * Garment Process POs
 *   GPO-2026-00001  GPR-2026-00004 Softener Washing, White (1,500) — Completed.
 *   GPO-2026-00002  GPR-2026-00003 Garment Dyeing, White 2Y / 4Y (276) — Sent to Vendor.
 *   GPO-2026-00003  GPR-2026-00003 Garment Dyeing, White 6Y (138) — Submitted by Karthik S.
 * CPR-2026-00001 and GPR-2026-00001 stay untouched.
 */
import { buildCprSeed } from '../../bom/cutPanel/cutPanelMockData';
import { buildGprSeed } from '../../bom/garmentProcess/garmentProcessMockData';
import { getMockOrderContext } from '../../bom/requirementMockOrders';
import { seedVendorSnapshot, seedDay as day } from './jobWorkSeedVendors';
import { cppLineFromCpr, gpoLineFromGpr } from '../../../utils/jobWorkPoLines';
import { LEDGER_ENTRY, poLineRequirementCell } from '../../../utils/jobWorkAllocation';
import { JW_PO_STATUS as S, JOB_WORK_PO_TYPE as T, allocatingStatuses } from '../../../utils/jobWorkPoStatus';

const ANITHA = { name: 'Anitha R', username: 'anitha.r' };
const KARTHIK = { name: 'Karthik S', username: 'karthik.s' };
const MEENA = { name: 'Meena V', username: 'meena.v' };

const at = (offset, time = '10:00:00') => `${day(offset)}T${time}`;

const INSTRUCTIONS = {
  'Panel Printing': 'Print to the approved strike-off; placement within ±2 mm of the placement sheet.',
  'Panel Embroidery': 'Use the approved thread card; trim all jump stitches; no puckering.',
  'Softener Washing': 'Silicone softener wash; tumble dry; hand-feel to match the approved sample.',
  'Garment Dyeing': 'Dye to the approved lab dip; shade band A only; no patchiness at seams.',
};

/** The shape utils/jobWorkPoLines processSnapshot gives; ids are the live master's, unknown to the seed. */
const processSnapshot = (name, category) => ({
  id: null, name, label: name, otherName: null, category, sacCode: '998821', gstRatePercent: 5, defaultUom: 'PIECE',
  artworkRequired: false, defaultInstructions: INSTRUCTIONS[name], fromMaster: false,
});

const po = ({ type, id, poNo, status, dateOffset, vendor, processName, category, lines, by = ANITHA, ...rest }) => {
  const snapshot = seedVendorSnapshot(vendor);
  return {
    id, type, poNo, status, poDate: day(dateOffset), currency: 'INR', branchId: null, branchName: 'Head Office',
    process: processSnapshot(processName, category), vendor: snapshot, paymentTerms: snapshot.paymentTerms,
    deliveryTerms: 'Door delivery', discountType: 'AMOUNT', discountValue: 0, otherCharges: 0,
    instructions: INSTRUCTIONS[processName], remarks: '', references: [], overrides: [], approvals: [],
    requiredLevels: 1, lines, createdBy: by.name, createdByUser: by.username, createdOn: at(dateOffset, '09:30:00'),
    version: 1, ...rest,
  };
};

const approved = (offset) => ({
  submittedBy: ANITHA.name, submittedByUser: ANITHA.username, submittedOn: at(offset, '11:00:00'),
  approvedBy: MEENA.name, approvedOn: at(offset, '16:00:00'),
  approvals: [{ level: 1, by: MEENA.name, byUser: MEENA.username, at: at(offset, '16:00:00'), remark: '' }],
});

const cppLines = (cpr, processName, picks) => picks.map(([color, size, extra = {}], i) => ({
  ...cppLineFromCpr({
    key: `L${i + 1}`, cpr, size, order: getMockOrderContext(cpr.orderId),
    line: cpr.lines.find((l) => l.colorName === color && l.processName === processName),
  }),
  ...extra,
}));

const gpoLines = (gpr, picks) => picks.map(([color, size, extra = {}], i) => ({
  ...gpoLineFromGpr({ key: `L${i + 1}`, gpr, line: gpr.lines[0], color, size, order: getMockOrderContext(gpr.orderId) }),
  ...extra,
}));

const SIZES_418 = ['3-4Y', '5-6Y', '7-8Y', '9-10Y'];
const SIZES_TEE = ['2Y', '4Y', '6Y', '8Y'];

const buildDocs = () => {
  const cprs = buildCprSeed().docs;
  const gprs = buildGprSeed().docs;
  const cpr3 = cprs.find((d) => d.id === 3);
  const cpr5 = cprs.find((d) => d.id === 5);
  const gpr3 = gprs.find((d) => d.id === 3);
  const gpr4 = gprs.find((d) => d.id === 4);
  const rate = (r) => ({ rate: r });
  const cppDates = (offset) => ({
    requiredDeliveryDate: day(offset + 14), expectedCompletionDate: day(offset + 11), panelIssueDate: day(offset + 2),
    processingLocation: 'VENDOR_PREMISES', returnTo: 'CUTTING', returnToOther: '', returnBranchName: 'Head Office',
    freight: 'VENDOR', revisionNo: 0, pendingRevision: null,
  });
  const gpoDates = (offset, gpr) => ({
    requiredDate: getMockOrderContext(gpr.orderId).deliveryDate, plannedSendDate: day(offset + 1),
    expectedReturnDate: day(offset + 10), returnTo: 'FINISHING', returnToOther: '',
  });

  return [
    po({ type: T.CPP, id: 1, poNo: 'CPP-2026-00031', status: S.SENT_TO_VENDOR, dateOffset: -8, vendor: 'murugan',
      processName: 'Panel Printing', category: 'Cut Panel', ...cppDates(-8), ...approved(-8), sentOn: at(-7),
      references: [{ title: 'ST-4388 front print artwork', url: 'https://example.com/artwork/ST-4388-front.pdf' }],
      lines: cppLines(cpr5, 'Panel Printing', [['Navy', '2Y', rate(7)], ['Navy', '4Y', rate(7.5)]]) }),
    po({ type: T.CPP, id: 2, poNo: 'CPP-2026-00032', status: S.PARTIALLY_COMPLETED, dateOffset: -20, vendor: 'murugan',
      processName: 'Panel Printing', category: 'Cut Panel', ...cppDates(-20), ...approved(-19), sentOn: at(-19),
      lines: cppLines(cpr3, 'Panel Printing', SIZES_418.map((s, i) => ['Black', s, { rate: 6.5, receivedQty: [927, 600, 0, 0][i] }])) }),
    po({ type: T.CPP, id: 3, poNo: 'CPP-2026-00033', status: S.SUBMITTED, dateOffset: -1, vendor: 'murugan', by: KARTHIK,
      processName: 'Panel Printing', category: 'Cut Panel', ...cppDates(-1),
      submittedBy: KARTHIK.name, submittedByUser: KARTHIK.username, submittedOn: at(-1, '12:00:00'),
      lines: cppLines(cpr3, 'Panel Printing', SIZES_418.map((s) => ['Navy', s, rate(6.5)])) }),
    po({ type: T.CPP, id: 4, poNo: 'CPP-2026-00034', status: S.DRAFT, dateOffset: 0, vendor: 'classic', by: KARTHIK,
      processName: 'Panel Embroidery', category: 'Cut Panel', ...cppDates(0),
      overrides: [{ id: 'O1', type: 'OVER_ALLOCATION', lineKey: 'L5', excessQty: 6, reasonCode: 'PROCESS_WASTAGE',
        justification: 'Embroidery rejects run at 2% on this design.', requestedBy: KARTHIK.name,
        requestedByUser: KARTHIK.username, requestedAt: at(0, '10:15:00'), status: 'REQUESTED' }],
      lines: cppLines(cpr5, 'Panel Embroidery', ['Navy', 'White', 'Grey Melange']
        .flatMap((c) => SIZES_TEE.map((s) => [c, s, c === 'White' && s === '2Y' ? { rate: 12, poQty: 306 } : rate(12)]))) }),
    po({ type: T.GPO, id: 5, poNo: 'GPO-2026-00001', status: S.COMPLETED, dateOffset: -15, vendor: 'bluewave',
      processName: 'Softener Washing', category: 'Garment', ...gpoDates(-15, gpr4), ...approved(-15), sentOn: at(-14),
      lines: gpoLines(gpr4, ['S', 'M', 'L'].map((s, i) => ['White', s, { rate: 9.5, receivedQty: [400, 600, 500][i] }])) }),
    po({ type: T.GPO, id: 6, poNo: 'GPO-2026-00002', status: S.SENT_TO_VENDOR, dateOffset: -10, vendor: 'colourtex',
      processName: 'Garment Dyeing', category: 'Garment', ...gpoDates(-10, gpr3), ...approved(-10), sentOn: at(-9),
      lines: gpoLines(gpr3, [['White', '2Y', rate(22)], ['White', '4Y', rate(22)]]) }),
    po({ type: T.GPO, id: 7, poNo: 'GPO-2026-00003', status: S.SUBMITTED, dateOffset: -1, vendor: 'colourtex', by: KARTHIK,
      processName: 'Garment Dyeing', category: 'Garment', ...gpoDates(-1, gpr3),
      submittedBy: KARTHIK.name, submittedByUser: KARTHIK.username, submittedOn: at(-1, '15:00:00'),
      lines: gpoLines(gpr3, [['White', '6Y', rate(22)]]) }),
  ];
};

/** Ledger rows for the seeded POs: allocation where their status holds it, completion for receipts. */
const buildLedger = (docs) => {
  const ledger = [];
  const post = (doc, line, type, qty, when) => ledger.push({
    id: `E${ledger.length + 1}`, ...poLineRequirementCell(doc.type, line), poType: doc.type, poId: doc.id,
    poLineKey: line.key, type, qty, at: when, by: 'System', reasonCode: null, remark: '',
  });
  docs.filter((d) => allocatingStatuses(d.type).includes(d.status)).forEach((d) => d.lines.forEach((l) => {
    post(d, l, LEDGER_ENTRY.ALLOCATE, l.poQty, d.type === T.GPO ? d.submittedOn : d.approvedOn);
    if (l.receivedQty > 0) post(d, l, LEDGER_ENTRY.COMPLETE, l.receivedQty, d.sentOn);
  }));
  return ledger;
};

const audit = (id, user, action, details, timestamp) => ({ id, type: 'user', user, action, details, timestamp });

const buildAudits = (docs) => Object.fromEntries(docs.map((d) => [d.id, [
  ...(d.sentOn ? [audit(`${d.id}-4`, d.createdBy, 'sent the PO to the vendor', d.vendor.name, d.sentOn)] : []),
  ...(d.approvedOn ? [audit(`${d.id}-3`, d.approvedBy, 'approved the PO', 'Level 1', d.approvedOn)] : []),
  ...(d.submittedOn ? [audit(`${d.id}-2`, d.submittedBy, 'submitted the PO for approval', '', d.submittedOn)] : []),
  audit(`${d.id}-1`, d.createdBy, `created ${d.poNo}`, `${d.process.name} · ${d.vendor.name}`, d.createdOn),
]]));

export const buildJobWorkSeed = () => {
  const docs = buildDocs();
  const ledger = buildLedger(docs);
  return {
    docs, ledger, audits: buildAudits(docs), issuedNos: docs.map((d) => d.poNo),
    nextId: docs.length + 1, nextEntryId: ledger.length + 1,
  };
};
