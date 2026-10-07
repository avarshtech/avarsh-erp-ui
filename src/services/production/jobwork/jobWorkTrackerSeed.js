/**
 * Demo data for the Job Work Tracker mock (UI mock round 1). Every date is seeded relative to
 * "today", so overdue / at-risk / stale show live whenever the demo is opened or reset.
 *
 * Ten jobs cover every tracker state: at risk with an approved pull-back (J1), on track (J3, J8),
 * stale with an expired vendor approval (J4), stalled (J5), no due date (J6), completed (J7),
 * overdue with a pending pull-back (J9), ready to close (J10) and short-closed with a settled
 * pull-back (J11). Order O1 is split between in-house and a CMT vendor. Order O6 is work we do for a
 * principal (mock round 2); its Pink panels are printed by Bright Prints (J12, "principal's goods").
 */
import dayjs from 'dayjs';
import {
  DAMAGE_SOURCE, DOC_TYPE, FINISHING_STAGES, FLAG, ISSUE_CATEGORY, JOB_STATUS, MATERIAL_CONDITION, MATERIAL_KIND,
  NOT_STARTED, PULLBACK_REASON, PULLBACK_STATUS, RECEIPT_STATUS, REJECT_SOURCE, RETURN_STATUS, SOURCE, STAGE,
} from '../../../utils/jobWorkTracker/constants';
import { colourTotals, docPlan, jobStages, netPlan } from '../../../utils/jobWorkTracker/planRules';
import { addWorkingDays, iso, subtractWorkingDays } from '../../../utils/jobWorkTracker/workingDays';
import { defaultShares } from '../../../utils/jobWorkTracker/earnings';
import { SHARED_ORDER } from './principalOrderShared';

export const TRACKER_SEED_VERSION = 2;
export const COORDINATOR = 'Priya S (coordinator)';
export const MANAGER = 'Ramesh K (production manager)';
const STORES = 'Arun (stores)';

const fyOf = (today) => {
  const d = dayjs(today);
  const y = d.month() >= 3 ? d.year() : d.year() - 1;
  return `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
};
const planned = (qty, pct) => Math.ceil(qty * (1 + pct / 100) - 1e-9);

/** Order lines for the given colours: { colour: fraction of the colour (1 = all) }. */
const linesFor = (order, fractions, pct) => order.colours.flatMap(({ colour, qty }) => (
  fractions[colour] ? Object.entries(qty).map(([size, q]) => ({ colour, size, plannedQty: planned(Math.round(q * fractions[colour]), pct) })) : []
));

/**
 * Cumulative progress on every working day from `from` to `to`: each stage moves `rate` a day after a
 * `lag`, never ahead of the stage before it nor above its plan; split over colours by plan weight.
 */
const genEntries = ({ jobId, from, to, stages, plan, rate, lag = {}, stallAfter, notes = [], source = SOURCE.CALL }) => {
  const caps = Object.fromEntries(stages.map((s) => [s, colourTotals(plan[s])]));
  const colours = Object.keys(caps[stages[stages.length - 1]] || caps[stages[0]]);
  // Each stage splits over colours by its own plan, so every colour can reach its plan.
  const weightTotals = Object.fromEntries(stages.map((s) => [s, colours.reduce((a, c) => a + (caps[s][c] || 0), 0) || 1]));
  const days = [];
  for (let i = 0; ; i += 1) {
    const date = addWorkingDays(from, i);
    if (dayjs(date).isAfter(dayjs(to))) break;
    days.push(date);
  }
  let frozen = null;
  return days.map((date, i) => {
    let cells;
    if (stallAfter && dayjs(date).isAfter(dayjs(stallAfter)) && frozen) cells = frozen;
    else {
      cells = Object.fromEntries(colours.map((c) => [c, {}]));
      let prevStage = null;
      stages.forEach((s) => {
        const total = Math.max(0, (i - (lag[s] || 0) + 1) * (rate[s] || 0));
        colours.forEach((c) => {
          let v = Math.floor((total * (caps[s][c] || 0)) / weightTotals[s]);
          v = Math.min(v, caps[s][c] || 0);
          if (prevStage) v = Math.min(v, cells[c][prevStage]);
          cells[c][s] = v;
        });
        prevStage = s;
      });
      frozen = cells;
    }
    const note = [...notes].reverse().find((n) => !dayjs(date).isBefore(dayjs(n.from))) || {};
    return {
      jobId,
      date,
      flag: note.flag || FLAG.ON_TRACK,
      issueCategory: note.issue || ISSUE_CATEGORY.NONE,
      remarks: note.remarks || '',
      revisedDue: note.revisedDue || null,
      revisedDueWas: null,
      source: i % 4 === 3 ? SOURCE.VISIT : source,
      enteredBy: COORDINATOR,
      cells: JSON.parse(JSON.stringify(cells)),
    };
  });
};

export const buildTrackerSeed = (todayInput) => {
  const today = iso(todayInput || dayjs());
  const fy = fyOf(today);
  const wd = (n) => subtractWorkingDays(today, n);
  const fwd = (n) => addWorkingDays(today, n);
  const cal = (n) => iso(dayjs(today).add(n, 'day'));
  const no = (prefix, n) => `${prefix}/${fy}/${n}`;

  const branches = [{ id: 1, name: 'Tiruppur — Unit 1' }, { id: 2, name: 'Avinashi — Unit 2' }];
  const vendors = [
    { id: 501, name: 'Sri Murugan Garments', city: 'Tiruppur', gstin: '33AAKFS1234M1Z5', contactPerson: 'Murugan', phone: '98430 11223', processes: ['Cutting', 'Sewing', 'Finishing', 'Packing'], jobWorkApprovedUntil: cal(200) },
    { id: 502, name: 'Kavin Apparels', city: 'Tiruppur', gstin: '33BBKPK5678L1Z2', contactPerson: 'Kavin', phone: '94422 33445', processes: ['Cutting', 'Sewing', 'Finishing', 'Packing'], jobWorkApprovedUntil: cal(-12) },
    { id: 503, name: 'Lakshmi Stitching Unit', city: 'Palladam', gstin: '33CCLPL9012K1Z8', contactPerson: 'Lakshmi', phone: '97877 55667', processes: ['Sewing'], jobWorkApprovedUntil: cal(150) },
    { id: 504, name: 'Vel Cutting Works', city: 'Tiruppur', gstin: '33DDVPV3456J1Z1', contactPerson: 'Velmurugan', phone: '99944 77889', processes: ['Cutting'], jobWorkApprovedUntil: cal(90) },
    { id: 505, name: 'Bright Prints', city: 'Tiruppur', gstin: '33EEBPB7890H1Z4', contactPerson: 'Senthil', phone: '90039 99001', processes: ['Panel Printing', 'Panel Embroidery'], jobWorkApprovedUntil: cal(300) },
    { id: 506, name: 'Aqua Wash Process', city: 'Karur', gstin: '33FFAPA2345G1Z7', contactPerson: 'Anand', phone: '98652 12121', processes: ['Enzyme Washing', 'Stone Washing'], jobWorkApprovedUntil: cal(60) },
    { id: 507, name: 'Sakthi Finishers', city: 'Avinashi', gstin: '33GGSPS6789F1Z0', contactPerson: 'Sakthivel', phone: '96006 34343', processes: ['Checking', 'Ironing', 'Packing'], jobWorkApprovedUntil: cal(120) },
  ];
  const S4 = ['S', 'M', 'L', 'XL'];
  const orders = [
    { id: 1, orderNo: no('SG', 1012), buyer: 'Nordic Basics AB', styleNo: 'NB-TEE-221', styleName: 'Crew neck tee', shipDate: fwd(16), branchId: 1, sizes: S4,
      colours: [{ colour: 'Navy', qty: { S: 300, M: 500, L: 500, XL: 200 } }, { colour: 'Black', qty: { S: 200, M: 350, L: 300, XL: 150 } }, { colour: 'White', qty: { S: 100, M: 150, L: 150, XL: 100 } }] },
    { id: 2, orderNo: no('SG', 1015), buyer: 'Kids Planet GmbH', styleNo: 'KP-DRS-118', styleName: 'Printed dress', shipDate: fwd(22), branchId: 1, sizes: ['2Y', '4Y', '6Y', '8Y'],
      colours: [{ colour: 'Pink', qty: { '2Y': 300, '4Y': 400, '6Y': 300, '8Y': 200 } }, { colour: 'Yellow', qty: { '2Y': 200, '4Y': 250, '6Y': 200, '8Y': 150 } }] },
    { id: 3, orderNo: no('SG', 1009), buyer: 'Urban Denim Co', styleNo: 'UD-JKT-07', styleName: 'Denim jacket', shipDate: fwd(7), branchId: 2, sizes: S4,
      colours: [{ colour: 'Indigo', qty: { S: 200, M: 300, L: 250, XL: 150 } }, { colour: 'Stone', qty: { S: 120, M: 200, L: 180, XL: 100 } }] },
    { id: 4, orderNo: no('SG', 1018), buyer: 'Coastal Wear Ltd', styleNo: 'CW-POLO-55', styleName: 'Pique polo', shipDate: fwd(26), branchId: 1, sizes: S4,
      colours: [{ colour: 'Red', qty: { S: 150, M: 250, L: 250, XL: 150 } }, { colour: 'Grey', qty: { S: 120, M: 230, L: 220, XL: 130 } }] },
    { id: 5, orderNo: no('SG', 1004), buyer: 'Alpine Sports', styleNo: 'AS-JOG-12', styleName: 'Fleece jogger', shipDate: fwd(3), branchId: 1, sizes: S4,
      colours: [{ colour: 'Black', qty: { S: 300, M: 400, L: 350, XL: 150 } }] },
    { id: SHARED_ORDER.outwardOrderId, orderNo: no('SG', SHARED_ORDER.orderN), buyer: `${SHARED_ORDER.principal} (job work)`, type: 'JOB_WORK',
      principal: SHARED_ORDER.principal, styleNo: SHARED_ORDER.styleNo, styleName: SHARED_ORDER.styleName,
      shipDate: fwd(SHARED_ORDER.dueInWorkingDays), branchId: 1, sizes: SHARED_ORDER.sizes, colours: SHARED_ORDER.colours },
  ];
  const O = Object.fromEntries(orders.map((o) => [o.id, o]));

  let docSeq = 0;
  const doc = (docType, n, orderId, vendorId, extra) => {
    docSeq += 1;
    const prefix = { CUTTING_PO: 'CPO', WORK_ORDER: 'WO', FINISHING_PO: 'FPO', CUT_PANEL_PO: 'CPPO', GARMENT_PROCESS_PO: 'GPPO' }[docType];
    return { key: `${docType}:${docSeq}`, docType, docId: docSeq, docNo: no(prefix, n), orderId, vendorId, allowancePct: 0, ...extra };
  };
  const all = { Navy: 1, Black: 1, White: 1, Pink: 1, Yellow: 1, Indigo: 1, Stone: 1, Red: 1, Grey: 1 };
  const J1L = linesFor(O[1], { Navy: 1, Black: 0.5 }, 3);
  const docs = [
    doc(DOC_TYPE.CUTTING_PO, 1041, 1, 501, { allowancePct: 3, rate: 6, approvedOn: wd(15), plannedDelivery: wd(4), lines: J1L }),
    doc(DOC_TYPE.WORK_ORDER, 1052, 1, 501, { allowancePct: 3, rate: 62, approvedOn: wd(14), plannedStart: wd(12), plannedDelivery: fwd(5), lines: J1L }),
    doc(DOC_TYPE.CUT_PANEL_PO, 1003, 2, 505, { processName: 'Panel Printing', rate: 7, approvedOn: wd(8), plannedStart: wd(6), plannedDelivery: fwd(4), lines: linesFor(O[2], { Pink: 1 }, 0) }),
    doc(DOC_TYPE.CUT_PANEL_PO, 1004, 2, 505, { processName: 'Panel Embroidery', rate: 11, approvedOn: wd(8), plannedStart: wd(6), plannedDelivery: fwd(6), lines: linesFor(O[2], { Yellow: 1 }, 0) }),
    doc(DOC_TYPE.CUTTING_PO, 1049, 2, 502, { allowancePct: 3, rate: 5, approvedOn: wd(13), plannedDelivery: wd(6), lines: linesFor(O[2], all, 3) }),
    doc(DOC_TYPE.WORK_ORDER, 1060, 2, 502, { allowancePct: 3, rate: 72, approvedOn: wd(12), plannedStart: wd(10), plannedDelivery: fwd(14), lines: linesFor(O[2], all, 3) }),
    doc(DOC_TYPE.GARMENT_PROCESS_PO, 1002, 3, 506, { processName: 'Enzyme Wash', rate: 18, approvedOn: wd(11), plannedStart: wd(9), plannedDelivery: fwd(2), lines: linesFor(O[3], all, 0) }),
    doc(DOC_TYPE.FINISHING_PO, 1021, 3, 507, { allowancePct: 3, rate: 9, processes: ['CHECKING', 'IRONING', 'PACKING'], approvedOn: wd(6), plannedStart: wd(4), plannedDelivery: null, lines: linesFor(O[3], all, 3) }),
    doc(DOC_TYPE.CUTTING_PO, 1036, 4, 504, { allowancePct: 3, rate: 4.5, approvedOn: wd(16), plannedStart: wd(14), plannedDelivery: wd(3), lines: linesFor(O[4], all, 3) }),
    doc(DOC_TYPE.WORK_ORDER, 1050, 4, 503, { allowancePct: 3, rate: 34, approvedOn: wd(7), plannedStart: wd(5), plannedDelivery: fwd(10), lines: linesFor(O[4], all, 3) }),
    doc(DOC_TYPE.CUTTING_PO, 1047, 5, 501, { allowancePct: 3, rate: 6, approvedOn: wd(13), plannedDelivery: wd(6), lines: linesFor(O[5], all, 3) }),
    doc(DOC_TYPE.WORK_ORDER, 1058, 5, 501, { allowancePct: 3, rate: 58, approvedOn: wd(12), plannedStart: wd(11), plannedDelivery: wd(1), lines: linesFor(O[5], all, 3) }),
    doc(DOC_TYPE.CUT_PANEL_PO, 1001, 5, 505, { processName: 'Panel Printing', rate: 6.5, approvedOn: wd(10), plannedStart: wd(8), plannedDelivery: wd(2), lines: linesFor(O[5], all, 3) }),
    doc(DOC_TYPE.CUTTING_PO, 1031, 3, 504, { allowancePct: 3, rate: 4.5, approvedOn: wd(20), plannedStart: wd(18), plannedDelivery: wd(12), lines: linesFor(O[3], all, 3) }),
    doc(DOC_TYPE.CUT_PANEL_PO, SHARED_ORDER.printingDocN, SHARED_ORDER.outwardOrderId, 505, {
      processName: 'Panel Printing', rate: 6, approvedOn: wd(10), plannedStart: wd(9), plannedDelivery: fwd(3),
      lines: Object.entries(SHARED_ORDER.printSent).map(([size, plannedQty]) => ({ colour: 'Pink', size, plannedQty })),
    }),
  ];
  const D = (n) => docs.find((d) => d.docNo.endsWith(`/${n}`));
  // Work Order stage shares: a CMT vendor (also holds the Cutting PO) 15/60/25, a sewing-only vendor rescaled.
  D(1052).shares = defaultShares({ cuts: true, finishingScope: FINISHING_STAGES });
  D(1060).shares = defaultShares({ cuts: true, finishingScope: FINISHING_STAGES });
  D(1058).shares = defaultShares({ cuts: true, finishingScope: FINISHING_STAGES });
  D(1050).shares = defaultShares({ cuts: false, finishingScope: [] });
  // In-house POs of the split order (the rates a pull-back PO pre-fills with).
  const inhouseDocs = [
    { docType: DOC_TYPE.WORK_ORDER, docNo: no('WO', 1053), orderId: 1, unitName: 'Unit 1 · Line 3', rate: 38, lines: linesFor(O[1], { Black: 0.5, White: 1 }, 3) },
    { docType: DOC_TYPE.CUTTING_PO, docNo: no('CPO', 1042), orderId: 1, unitName: 'Unit 1 · Cutting', rate: 4, lines: linesFor(O[1], { Black: 0.5, White: 1 }, 3) },
  ];
  const inhouseRates = {
    1: { CUTTING_PO: 4, WORK_ORDER: 38, FINISHING_PO: 9 },
    2: { CUTTING_PO: 4.5, WORK_ORDER: 44, FINISHING_PO: 10 },
    3: { CUTTING_PO: 4.5, WORK_ORDER: 52, FINISHING_PO: 11 },
    4: { CUTTING_PO: 4, WORK_ORDER: 30, FINISHING_PO: 8 },
    5: { CUTTING_PO: 4, WORK_ORDER: 36, FINISHING_PO: 8 },
  };

  const jobDefs = [
    { id: 1, n: 1001, orderId: 1, vendorId: 501, branchId: 1, docs: [1041, 1052], scope: FINISHING_STAGES, status: JOB_STATUS.IN_PROGRESS },
    { id: 3, n: 1003, orderId: 2, vendorId: 505, branchId: 1, docs: [1003, 1004], status: JOB_STATUS.IN_PROGRESS },
    { id: 4, n: 1004, orderId: 2, vendorId: 502, branchId: 1, docs: [1049, 1060], scope: FINISHING_STAGES, status: JOB_STATUS.IN_PROGRESS },
    { id: 5, n: 1005, orderId: 3, vendorId: 506, branchId: 2, docs: [1002], status: JOB_STATUS.IN_PROGRESS },
    { id: 6, n: 1006, orderId: 3, vendorId: 507, branchId: 2, docs: [1021], status: JOB_STATUS.IN_PROGRESS },
    { id: 7, n: 1007, orderId: 4, vendorId: 504, branchId: 1, docs: [1036], status: JOB_STATUS.COMPLETED, completedAt: wd(5) },
    { id: 8, n: 1008, orderId: 4, vendorId: 503, branchId: 1, docs: [1050], scope: [], status: JOB_STATUS.IN_PROGRESS },
    { id: 9, n: 1009, orderId: 5, vendorId: 501, branchId: 1, docs: [1047, 1058], scope: FINISHING_STAGES, status: JOB_STATUS.IN_PROGRESS },
    { id: 10, n: 1010, orderId: 5, vendorId: 505, branchId: 1, docs: [1001], status: JOB_STATUS.IN_PROGRESS },
    { id: 11, n: 1011, orderId: 3, vendorId: 504, branchId: 2, docs: [1031], status: JOB_STATUS.CLOSED, closedAt: wd(10), closedReason: 'Vendor ran one roll short; the balance 67 pcs were cut in-house.' },
    { id: SHARED_ORDER.outwardJobId, n: 1012, orderId: SHARED_ORDER.outwardOrderId, vendorId: 505, branchId: 1, docs: [SHARED_ORDER.printingDocN], status: JOB_STATUS.IN_PROGRESS },
  ];
  const jobs = jobDefs.map((j) => {
    const jd = j.docs.map(D);
    return {
      id: j.id,
      jobNo: no('JW', j.n),
      orderId: j.orderId,
      vendorId: j.vendorId,
      branchId: j.branchId,
      docKeys: jd.map((d) => d.key),
      finishingScope: j.scope || [],
      status: j.status,
      startDate: jd.map((d) => d.approvedOn).sort()[0],
      revisedDue: null,
      prevRevisedDue: null,
      closedReason: j.closedReason || null,
      closedAt: j.closedAt || null,
      completedAt: j.completedAt || null,
      progressSeq: 0,
      version: 0,
      events: jd.map((d) => ({ at: d.approvedOn, by: 'System', text: `${d.docNo} linked on approval` })),
    };
  });
  const J = (id) => jobs.find((j) => j.id === id);
  const jobPlan = (id) => {
    const jd = J(id).docKeys.map((k) => docs.find((d) => d.key === k));
    const stages = jobStages(jd, J(id).finishingScope);
    return { stages, plan: docPlan(jd, stages) };
  };

  // ── Pull-back returns that shape the net plan (J1 approved, J11 settled) ──
  const pullBackReturns = [
    { id: 1, prNo: no('JPR', 1001), pullBackId: 1, jobId: 1, date: wd(1), vendorDcNo: 'SMG/DC/2211', status: RETURN_STATUS.POSTED, createdBy: STORES,
      lines: [
        { colour: 'Navy', size: 'S', stage: STAGE.CUT, good: 50, damaged: 0, damageSource: null },
        { colour: 'Navy', size: 'M', stage: STAGE.CUT, good: 85, damaged: 5, damageSource: DAMAGE_SOURCE.TRANSIT },
        { colour: 'Navy', size: 'L', stage: STAGE.CUT, good: 85, damaged: 5, damageSource: DAMAGE_SOURCE.TRANSIT },
        { colour: 'Navy', size: 'XL', stage: STAGE.CUT, good: 30, damaged: 0, damageSource: null },
        { colour: 'Black', size: 'S', stage: STAGE.CUT, good: 20, damaged: 0, damageSource: null },
        { colour: 'Black', size: 'M', stage: STAGE.CUT, good: 35, damaged: 0, damageSource: null },
        { colour: 'Black', size: 'L', stage: STAGE.CUT, good: 30, damaged: 0, damageSource: null },
        { colour: 'Black', size: 'XL', stage: STAGE.CUT, good: 15, damaged: 0, damageSource: null },
      ] },
    { id: 2, prNo: no('JPR', 1000), pullBackId: 3, jobId: 11, date: wd(11), vendorDcNo: 'VCW/DC/0877', status: RETURN_STATUS.POSTED, createdBy: STORES,
      lines: [
        { colour: 'Indigo', size: 'M', stage: NOT_STARTED, good: 34, damaged: 0, damageSource: null },
        { colour: 'Stone', size: 'M', stage: NOT_STARTED, good: 16, damaged: 0, damageSource: null },
      ] },
  ];

  // ── Progress entries ──
  const entriesFor = (id, opts) => {
    const { stages, plan } = jobPlan(id);
    const returns = pullBackReturns.filter((r) => r.jobId === id && r.status === RETURN_STATUS.POSTED).flatMap((r) => r.lines);
    return genEntries({ jobId: id, stages, plan: netPlan(plan, stages, returns), ...opts });
  };
  const entryLists = [
    entriesFor(1, { from: wd(12), to: today, rate: { CUT: 230, LOADED: 150, STITCHED: 120, TRIMMED: 110, CHECKED: 105, IRONED: 100, PACKED: 95 }, lag: { LOADED: 2, STITCHED: 3, TRIMMED: 5, CHECKED: 6, IRONED: 6, PACKED: 7 },
      notes: [{ from: wd(3), flag: FLAG.AT_RISK, issue: ISSUE_CATEGORY.LABOUR_SHORTAGE, remarks: '12 tailors on leave this week; asked them to send back 400 cut sets.' }] }),
    entriesFor(3, { from: wd(6), to: today, rate: { PANEL_PROCESSED: 210 } }),
    entriesFor(4, { from: wd(10), to: wd(4), rate: { CUT: 260, LOADED: 120, STITCHED: 100, TRIMMED: 90, CHECKED: 90, IRONED: 80, PACKED: 80 }, lag: { LOADED: 4, STITCHED: 5, TRIMMED: 7, CHECKED: 7, IRONED: 8, PACKED: 8 },
      notes: [{ from: wd(5), issue: ISSUE_CATEGORY.AWAITING_TRIMS, remarks: 'Zip pullers not sent yet — stores to issue.' }] }),
    entriesFor(5, { from: wd(9), to: today, rate: { GARMENT_PROCESSED: 150 }, stallAfter: wd(5),
      notes: [{ from: wd(4), issue: ISSUE_CATEGORY.MACHINE_BREAKDOWN, remarks: 'Washer 2 down, spare part awaited.' }] }),
    entriesFor(6, { from: wd(4), to: today, rate: { CHECKED: 80, IRONED: 70, PACKED: 60 }, lag: { IRONED: 1, PACKED: 2 } }),
    entriesFor(7, { from: wd(14), to: wd(6), rate: { CUT: 200 } }),
    entriesFor(8, { from: wd(5), to: today, rate: { LOADED: 160, STITCHED: 140 }, lag: { STITCHED: 1 } }),
    entriesFor(9, { from: wd(11), to: today, rate: { CUT: 180, LOADED: 110, STITCHED: 90, TRIMMED: 85, CHECKED: 80, IRONED: 80, PACKED: 75 }, lag: { LOADED: 2, STITCHED: 3, TRIMMED: 5, CHECKED: 6, IRONED: 6, PACKED: 7 },
      notes: [{ from: wd(2), flag: FLAG.DELAYED, issue: ISSUE_CATEGORY.VENDOR_CAPACITY, remarks: 'Vendor moved two lines to another buyer.' }] }),
    entriesFor(10, { from: wd(8), to: wd(1), rate: { PANEL_PROCESSED: 160 } }),
    entriesFor(11, { from: wd(18), to: wd(11), rate: { CUT: 200 } }),
    entriesFor(SHARED_ORDER.outwardJobId, { from: wd(9), to: today, rate: { PANEL_PROCESSED: 130 } }),
  ];
  let entrySeq = 0;
  const entries = entryLists.flat().map((e) => { entrySeq += 1; return { id: entrySeq, version: 0, ...e }; });
  // J11's cutting stopped one roll short.
  entries.filter((e) => e.jobId === 11).forEach((e) => {
    if (e.cells.Indigo.CUT > 880) e.cells.Indigo.CUT = 880;
    if (e.cells.Stone.CUT > 600) e.cells.Stone.CUT = 600;
  });
  jobs.forEach((j) => { j.progressSeq = entries.filter((e) => e.jobId === j.id).length; });

  // ── Receipts ──
  let receiptSeq = 0;
  const receipt = (jobId, stage, date, dc, lines, extra = {}) => {
    receiptSeq += 1;
    return { id: receiptSeq, receiptNo: no('JWR', 1000 + receiptSeq), jobId, stage, receiptDate: date, vendorDcNo: dc, vendorDcDate: date,
      status: RECEIPT_STATUS.POSTED, cancelReason: null, createdBy: STORES, lines, ...extra };
  };
  const ln = (colour, size, good, rejected = 0, alter = 0, rejectSource = null) => ({ colour, size, good, rejected, alter, rejectSource: rejected ? rejectSource || REJECT_SOURCE.VENDOR_WORKMANSHIP : null });
  const receipts = [
    receipt(1, STAGE.PACKED, wd(2), 'SMG/DC/2190', [ln('Navy', 'S', 40), ln('Navy', 'M', 70, 3, 5), ln('Navy', 'L', 70, 2, 3), ln('Navy', 'XL', 20)]),
    receipt(1, STAGE.PACKED, today, 'SMG/DC/2215', [ln('Navy', 'M', 30), ln('Black', 'S', 25), ln('Black', 'M', 45, 2), ln('Black', 'L', 40), ln('Black', 'XL', 10)]),
    receipt(3, STAGE.PANEL_PROCESSED, wd(1), 'BP/DC/0431', [ln('Pink', '2Y', 150), ln('Pink', '4Y', 200, 4), ln('Pink', '6Y', 150, 2), ln('Pink', '8Y', 94)]),
    receipt(5, STAGE.GARMENT_PROCESSED, wd(3), 'AWP/DC/118', [ln('Indigo', 'S', 70), ln('Indigo', 'M', 100), ln('Indigo', 'L', 80), ln('Indigo', 'XL', 50)]),
    receipt(7, STAGE.CUT, wd(9), 'VCW/DC/0901', [ln('Red', 'S', 155), ln('Red', 'M', 258), ln('Red', 'L', 258), ln('Red', 'XL', 155)]),
    receipt(7, STAGE.CUT, wd(6), 'VCW/DC/0914', [ln('Grey', 'S', 124), ln('Grey', 'M', 237), ln('Grey', 'L', 227), ln('Grey', 'XL', 134)]),
    receipt(8, STAGE.STITCHED, wd(1), 'LSU/DC/0057', [ln('Red', 'S', 40), ln('Red', 'M', 70, 2, 6, REJECT_SOURCE.FABRIC), ln('Red', 'L', 60, 2), ln('Red', 'XL', 30)]),
    receipt(10, STAGE.PANEL_PROCESSED, wd(5), 'BP/DC/0402', [ln('Black', 'S', 150), ln('Black', 'M', 200), ln('Black', 'L', 150)]),
    receipt(10, STAGE.PANEL_PROCESSED, wd(3), 'BP/DC/0417', [ln('Black', 'S', 159), ln('Black', 'M', 212), ln('Black', 'L', 129)]),
    // 1,202 of the 1,237 planned panels are back: past the 1,200 share (ready to close), short of the plan.
    receipt(10, STAGE.PANEL_PROCESSED, wd(1), 'BP/DC/0429', [ln('Black', 'L', 79, 3), ln('Black', 'XL', 120, 0)]),
    receipt(11, STAGE.CUT, wd(11), 'VCW/DC/0880', [ln('Indigo', 'S', 200), ln('Indigo', 'M', 290), ln('Indigo', 'L', 245), ln('Indigo', 'XL', 145), ln('Stone', 'S', 120), ln('Stone', 'M', 190), ln('Stone', 'L', 190), ln('Stone', 'XL', 100)]),
    ...SHARED_ORDER.printBackTrips.map((trip, i) => receipt(SHARED_ORDER.outwardJobId, STAGE.PANEL_PROCESSED, wd([5, 2][i]), ['BP/DC/0441', 'BP/DC/0452'][i],
      Object.entries(trip).map(([size, q]) => ln('Pink', size, q)))),
  ];

  // ── Pull-backs ──
  const pullBacks = [
    { id: 1, pbNo: no('JPB', 1002), jobId: 1, status: PULLBACK_STATUS.APPROVED, reason: PULLBACK_REASON.SLOW_PROGRESS,
      remarks: 'Line 2 short of tailors; finish 400 cut sets on our Line 3.', targetDate: fwd(5), vendorNewDue: fwd(6), prevRevisedDue: null, earnedEstimate: 0,
      requestedBy: COORDINATOR, requestedAt: wd(3),
      history: [
        { action: 'SUBMITTED', by: COORDINATOR, at: wd(3), comment: 'Suggested 410; asked for 400.' },
        { action: 'APPROVED', by: MANAGER, at: wd(2), comment: 'Approved. Keep Line 3 free from Monday.' },
      ],
      lines: [
        { id: 1, colour: 'Navy', stage: STAGE.CUT, suggested: 310, requested: 300, approved: 300, backToVendor: 0, writtenOff: 0, writeOffReason: null },
        { id: 2, colour: 'Black', stage: STAGE.CUT, suggested: 100, requested: 100, approved: 100, backToVendor: 0, writtenOff: 0, writeOffReason: null },
      ],
      withdrawals: [], settledAt: null },
    { id: 2, pbNo: no('JPB', 1003), jobId: 9, status: PULLBACK_STATUS.PENDING_APPROVAL, reason: PULLBACK_REASON.SHIP_DATE_RISK,
      remarks: 'Ship date in 3 days; vendor cannot finish. Pull back what is not stitched.', targetDate: fwd(1), vendorNewDue: fwd(2), prevRevisedDue: null, earnedEstimate: 0,
      requestedBy: COORDINATOR, requestedAt: today,
      history: [{ action: 'SUBMITTED', by: COORDINATOR, at: today, comment: '' }],
      lines: [
        { id: 3, colour: 'Black', stage: STAGE.CUT, suggested: 140, requested: 130, approved: null, backToVendor: 0, writtenOff: 0, writeOffReason: null },
        { id: 4, colour: 'Black', stage: STAGE.LOADED, suggested: 210, requested: 200, approved: null, backToVendor: 0, writtenOff: 0, writeOffReason: null },
      ],
      withdrawals: [], settledAt: null },
    { id: 3, pbNo: no('JPB', 1001), jobId: 11, status: PULLBACK_STATUS.SETTLED, reason: PULLBACK_REASON.OTHER,
      remarks: 'Vendor short of fabric for the last lay; take the uncut balance back.', targetDate: wd(12), vendorNewDue: wd(11), prevRevisedDue: null, earnedEstimate: 0,
      requestedBy: COORDINATOR, requestedAt: wd(13),
      history: [
        { action: 'SUBMITTED', by: COORDINATOR, at: wd(13), comment: '' },
        { action: 'APPROVED', by: MANAGER, at: wd(13), comment: '' },
        { action: 'SETTLED', by: COORDINATOR, at: wd(10), comment: '17 pcs worth of fabric not returned — written off.' },
      ],
      lines: [
        { id: 5, colour: 'Indigo', stage: NOT_STARTED, suggested: 48, requested: 48, approved: 48, backToVendor: 0, writtenOff: 14, writeOffReason: 'Fabric short at vendor' },
        { id: 6, colour: 'Stone', stage: NOT_STARTED, suggested: 19, requested: 19, approved: 19, backToVendor: 0, writtenOff: 3, writeOffReason: 'Fabric short at vendor' },
      ],
      withdrawals: [], settledAt: wd(10) },
  ];
  J(1).revisedDue = fwd(6);
  J(1).events.push({ at: wd(2), by: MANAGER, text: `Pull-back ${pullBacks[0].pbNo} approved: 400 cut sets back; vendor's new date ${fwd(6)}` });
  J(11).events.push({ at: wd(10), by: COORDINATOR, text: 'Short-closed: vendor ran one roll short' });

  // ── Materials sent to vendors (Material Issues) and vendor material returns ──
  let misSeq = 0;
  const mis = (jobId, docNo, kind, itemCode, itemName, uom, qty, date) => {
    misSeq += 1;
    return { id: misSeq, misNo: no('MIS', 2100 + misSeq), jobId, docNo, kind, itemCode, itemName, uom, qty, date };
  };
  const materials = [
    mis(1, D(1041).docNo, MATERIAL_KIND.FABRIC, 'FAB-SJ180-NVY', 'Single jersey 180 GSM — Navy', 'kg', 1240, wd(14)),
    mis(1, D(1041).docNo, MATERIAL_KIND.FABRIC, 'FAB-SJ180-BLK', 'Single jersey 180 GSM — Black', 'kg', 415, wd(14)),
    mis(1, D(1052).docNo, MATERIAL_KIND.TRIM, 'TRM-THR-40S', 'Polyester thread 40s', 'cone', 180, wd(13)),
    mis(1, D(1052).docNo, MATERIAL_KIND.TRIM, 'TRM-LBL-MAIN', 'Main label', 'pcs', 2062, wd(13)),
    mis(1, D(1052).docNo, MATERIAL_KIND.TRIM, 'TRM-LBL-CARE', 'Care label', 'pcs', 2062, wd(13)),
    mis(1, D(1052).docNo, MATERIAL_KIND.PACKING, 'PKG-POLY-S', 'Polybag 30×40', 'pcs', 2062, wd(8)),
    mis(1, D(1052).docNo, MATERIAL_KIND.PACKING, 'PKG-CTN-7P', 'Carton 7-ply', 'pcs', 86, wd(8)),
    mis(4, D(1049).docNo, MATERIAL_KIND.FABRIC, 'FAB-CMB-PNK', 'Cotton cambric — Pink', 'm', 2150, wd(12)),
    mis(4, D(1049).docNo, MATERIAL_KIND.FABRIC, 'FAB-CMB-YLW', 'Cotton cambric — Yellow', 'm', 1430, wd(12)),
    mis(8, D(1050).docNo, MATERIAL_KIND.TRIM, 'TRM-THR-40S', 'Polyester thread 40s', 'cone', 95, wd(6)),
    mis(8, D(1050).docNo, MATERIAL_KIND.TRIM, 'TRM-BTN-4H', 'Button 4-hole 18L', 'pcs', 4650, wd(6)),
    mis(6, D(1021).docNo, MATERIAL_KIND.PACKING, 'PKG-POLY-L', 'Polybag 40×55', 'pcs', 1545, wd(5)),
    mis(6, D(1021).docNo, MATERIAL_KIND.PACKING, 'PKG-HTG', 'Hang tag', 'pcs', 1545, wd(5)),
    mis(7, D(1036).docNo, MATERIAL_KIND.FABRIC, 'FAB-PQ220-RED', 'Pique 220 GSM — Red', 'kg', 470, wd(15)),
    mis(7, D(1036).docNo, MATERIAL_KIND.FABRIC, 'FAB-PQ220-GRY', 'Pique 220 GSM — Grey', 'kg', 410, wd(15)),
    mis(9, D(1047).docNo, MATERIAL_KIND.FABRIC, 'FAB-FLC300-BLK', 'Fleece 300 GSM — Black', 'kg', 1050, wd(12)),
    mis(9, D(1058).docNo, MATERIAL_KIND.TRIM, 'TRM-DRW-120', 'Drawcord 120 cm', 'pcs', 1237, wd(11)),
    mis(9, D(1058).docNo, MATERIAL_KIND.TRIM, 'TRM-THR-40S', 'Polyester thread 40s', 'cone', 110, wd(11)),
    mis(11, D(1031).docNo, MATERIAL_KIND.FABRIC, 'FAB-DNM12-IND', 'Denim 12 oz — Indigo', 'm', 1650, wd(19)),
  ];
  const vendorReturns = [
    { id: 1, vmrNo: no('VMR', 1001), jobId: 1, pullBackId: 1, date: wd(1), vendorDcNo: 'SMG/DC/2211', createdBy: STORES,
      lines: [
        { materialId: 3, qty: 12, condition: MATERIAL_CONDITION.GOOD },
        { materialId: 4, qty: 350, condition: MATERIAL_CONDITION.GOOD },
        { materialId: 5, qty: 340, condition: MATERIAL_CONDITION.GOOD },
        { materialId: 5, qty: 10, condition: MATERIAL_CONDITION.DAMAGED },
      ] },
    { id: 2, vmrNo: no('VMR', 1000), jobId: 11, pullBackId: 3, date: wd(11), vendorDcNo: 'VCW/DC/0877', createdBy: STORES,
      lines: [{ materialId: 19, qty: 52, condition: MATERIAL_CONDITION.GOOD }] },
  ];

  // ── In-house output of the split order (O1) ──
  const inhouse = {
    1: {
      units: ['Unit 1 · Cutting', 'Unit 1 · Line 3'],
      cut: [wd(6), wd(5), wd(4), wd(3), wd(2), wd(1)].map((date, i) => ({ date, qty: [180, 220, 200, 210, 190, 200][i] })),
      sewn: [wd(4), wd(3), wd(2), wd(1), today].map((date, i) => ({ date, qty: [150, 170, 160, 170, 170][i] })),
      packed: [
        ...[wd(3), wd(2), wd(1), today].map((date, i) => ({ date, colour: 'White', qty: [90, 100, 95, 95][i] })),
        ...[wd(2), wd(1), today].map((date, i) => ({ date, colour: 'Black', qty: [70, 90, 90][i] })),
      ],
    },
  };

  return {
    seedVersion: TRACKER_SEED_VERSION,
    seededOn: today,
    seq: { job: 12, entry: entrySeq, receipt: receiptSeq, pullBack: 3, pullBackLine: 6, pullBackReturn: 2, vendorReturn: 2, material: misSeq, doc: docSeq },
    counters: { JWR: 1000 + receiptSeq, JPB: 1003, JPR: 1001, VMR: 1001, MIS: 2100 + misSeq, CPO: 1060, WO: 1070, FPO: 1030 },
    branches,
    vendors,
    orders,
    docs,
    inhouseDocs,
    inhouseRates,
    jobs,
    entries,
    receipts,
    pullBacks,
    pullBackReturns,
    materials,
    vendorReturns,
    inhouse,
    draftPos: [],
  };
};
