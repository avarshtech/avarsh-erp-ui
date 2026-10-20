/**
 * Demo data for inward job work (UI mock round 2): six job orders for three principals, seeded from the
 * Outward demo's date so the shared printing order agrees with it. Movements, progress and returns are
 * generated from parameters (inwardSeedActivity.js), never typed as balances.
 *
 *   JO1 CMT, part returned, at risk          JO4 CMT, all returned; an unbilled return past 30 days
 *   JO2 CMT, waiting for Navy fabric          JO5 CMT, new, no material yet
 *   JO3 stitching onwards, printing at our    JO6 old order: all returned, but leftover labels still
 *       process vendor (shared with Outward)      held for 320+ days (the one-year warning)
 */
import dayjs from 'dayjs';
import { addWorkingDays, iso, subtractWorkingDays } from '../../../utils/jobWorkTracker/workingDays';
import {
  DEFAULT_GST_PCT, DEFAULT_SAC, MATERIAL_KIND, PP_SAMPLE, SCOPE, SUPPLIED_BY, WASTE_RULE,
} from '../../../utils/jobWorkInward/inwardConstants';
import { SHARED_ORDER } from './principalOrderShared';
import { buildInwardActivity } from './inwardSeedActivity';

export const INWARD_SEED_VERSION = 1;
const { FABRIC, PANELS, TRIM } = MATERIAL_KIND;
const S4 = ['S', 'M', 'L', 'XL'];
const fyOf = (date) => {
  const d = dayjs(date);
  const y = d.month() >= 3 ? d.year() : d.year() - 1;
  return `${String(y).slice(2)}-${String(y + 1).slice(2)}`;
};
const mat = (id, kind, itemName, colour, uom, consumption, allowancePct, suppliedBy = SUPPLIED_BY.PRINCIPAL) => ({
  id, kind, itemName, colour, uom, consumption, allowancePct, suppliedBy,
});
const thread = (id, per) => mat(id, TRIM, 'Sewing thread 40s', null, 'cone', per, 0, SUPPLIED_BY.OWN);

export const buildInwardSeed = (todayInput) => {
  const today = iso(todayInput || dayjs());
  const fy = fyOf(today);
  const wd = (n) => subtractWorkingDays(today, n);
  const fwd = (n) => addWorkingDays(today, n);
  const cal = (n) => iso(dayjs(today).add(n, 'day'));
  const no = (prefix, n, year = fy) => `${prefix}/${year}/${n}`;
  const lastFy = fyOf(cal(-322));

  const branch = {
    id: 1, name: 'Tiruppur — Unit 1', city: 'Tiruppur', state: 'Tamil Nadu', stateCode: '33',
    gstin: '33AAKCA1234B1Z6', address: 'SF 112, Avinashi Road, Tiruppur 641603',
  };
  const principals = [
    { id: 1, name: 'Comfort Wear Exports', gstin: '33AAFCC4521K1Z8', stateCode: '33', state: 'Tamil Nadu', city: 'Tiruppur', address: '45 Kumar Nagar, Tiruppur', pincode: '641603',
      contactPerson: 'Karthik R', phone: '98430 55120', email: 'karthik@comfortwear.example', wasteRule: WASTE_RULE.RETURN, weightTolerancePct: 1 },
    { id: 2, name: 'Bengaluru Fashion House', gstin: '29AABCB7788M1Z2', stateCode: '29', state: 'Karnataka', city: 'Bengaluru', address: 'No. 18, 2nd Cross, Peenya Industrial Area, Bengaluru', pincode: '560058',
      contactPerson: 'Asha N', phone: '98450 22781', email: 'asha@bfh.example', wasteRule: WASTE_RULE.SELL, weightTolerancePct: 1 },
    { id: 3, name: SHARED_ORDER.principal, gstin: '32AAHCK3390P1Z5', stateCode: '32', state: 'Kerala', city: 'Kochi', address: 'Building 7, KINFRA Park, Kakkanad, Kochi', pincode: '682030',
      contactPerson: 'Joseph M', phone: '94470 61324', email: 'joseph@kochikids.example', wasteRule: WASTE_RULE.RETURN, weightTolerancePct: 0.5 },
  ];

  const order = (o) => ({
    rate: 0, ratesBySize: null, sacCode: DEFAULT_SAC, gstRatePct: DEFAULT_GST_PCT, sizes: S4, status: 'OPEN',
    ppSample: { status: PP_SAMPLE.NOT_REQUIRED, ref: '' }, closedAt: null, closedReason: null, events: [], ...o,
  });
  const jobOrders = [
    order({ id: 1, orderNo: no('SG', 1021), principalId: 1, principalRef: 'CWE/PO/2291', styleNo: 'CW-TEE-310', styleName: 'Round neck tee', scope: SCOPE.CMT, rate: 38,
      orderDate: wd(19), dueDate: fwd(8), ppSample: { status: PP_SAMPLE.APPROVED, ref: 'Karthik, mail of 22 Sep' },
      colours: [{ colour: 'White', qty: { S: 400, M: 700, L: 700, XL: 400 } }, { colour: 'Navy', qty: { S: 400, M: 700, L: 700, XL: 400 } }, { colour: 'Grey', qty: { S: 300, M: 500, L: 500, XL: 300 } }],
      materials: [mat(101, FABRIC, 'Single jersey 160 GSM — White', 'White', 'kg', 0.22, 3), mat(102, FABRIC, 'Single jersey 160 GSM — Navy', 'Navy', 'kg', 0.22, 3),
        mat(103, FABRIC, 'Single jersey 160 GSM — Grey', 'Grey', 'kg', 0.22, 3), mat(104, TRIM, 'Main label', null, 'pcs', 1, 2), mat(105, TRIM, 'Care label', null, 'pcs', 1, 2),
        mat(106, TRIM, 'Polybag 30×40', null, 'pcs', 1, 2), thread(107, 0.012)],
      production: { cuttingPos: [{ colour: 'White', docNo: no('CPO', 1081) }, { colour: 'Navy', docNo: no('CPO', 1082) }, { colour: 'Grey', docNo: no('CPO', 1083) }],
        workOrderNo: no('WO', 1091), finishingPoNo: no('FPO', 1041), unit: 'Unit 1 · Line 2', processDocs: [] } }),
    order({ id: 2, orderNo: no('SG', 1023), principalId: 2, principalRef: 'BFH-JW-0583', styleNo: 'BF-POLO-21', styleName: 'Pique polo', scope: SCOPE.CMT, rate: 52,
      orderDate: wd(11), dueDate: fwd(12),
      colours: [{ colour: 'White', qty: { S: 250, M: 400, L: 400, XL: 250 } }, { colour: 'Navy', qty: { S: 300, M: 450, L: 450, XL: 300 } }],
      materials: [mat(201, FABRIC, 'Pique 220 GSM — White', 'White', 'kg', 0.28, 3), mat(202, FABRIC, 'Pique 220 GSM — Navy', 'Navy', 'kg', 0.28, 3),
        mat(203, TRIM, 'Flat-knit collar & cuff set — White', 'White', 'sets', 1, 2), mat(204, TRIM, 'Flat-knit collar & cuff set — Navy', 'Navy', 'sets', 1, 2),
        mat(205, TRIM, 'Button 4-hole 18L', null, 'pcs', 3, 2), mat(206, TRIM, 'Main label', null, 'pcs', 1, 2), thread(207, 0.014)],
      production: { cuttingPos: [{ colour: 'White', docNo: no('CPO', 1084) }, { colour: 'Navy', docNo: no('CPO', 1085) }],
        workOrderNo: no('WO', 1092), finishingPoNo: no('FPO', 1043), unit: 'Unit 1 · Line 3', processDocs: [] } }),
    order({ id: 3, orderNo: no('SG', SHARED_ORDER.orderN), principalId: 3, principalRef: 'KKA/JW/112', styleNo: SHARED_ORDER.styleNo, styleName: SHARED_ORDER.styleName,
      scope: SCOPE.STITCHING, rate: 46, sizes: SHARED_ORDER.sizes, colours: SHARED_ORDER.colours, orderDate: wd(13), dueDate: fwd(SHARED_ORDER.dueInWorkingDays),
      ppSample: { status: PP_SAMPLE.APPROVED, ref: 'Joseph, approved sample KK-08/PP2' },
      materials: [mat(301, PANELS, 'Cut panels (front, back, sleeves) — Pink', 'Pink', 'sets', 1, 1), mat(302, PANELS, 'Cut panels (front, back, sleeves) — Lilac', 'Lilac', 'sets', 1, 1),
        mat(303, TRIM, 'Lace 12 mm', null, 'm', 1.1, 3), mat(304, TRIM, 'Main label', null, 'pcs', 1, 2), mat(305, TRIM, 'Snap button', null, 'pcs', 2, 2), thread(306, 0.01)],
      production: { cuttingPos: [], workOrderNo: no('WO', 1093), finishingPoNo: no('FPO', 1042), unit: 'Unit 1 · Line 4',
        processDocs: [{ docNo: no('CPPO', SHARED_ORDER.printingDocN), vendorName: 'Bright Prints', process: 'Panel printing (Pink)', outwardJobId: SHARED_ORDER.outwardJobId }] } }),
    order({ id: 4, orderNo: no('SG', 1006), principalId: 1, principalRef: 'CWE/PO/2244', styleNo: 'CW-JOG-05', styleName: 'Fleece jogger', scope: SCOPE.CMT, rate: 58,
      orderDate: wd(44), dueDate: wd(21), ppSample: { status: PP_SAMPLE.APPROVED, ref: 'Karthik, mail of 18 Aug' },
      colours: [{ colour: 'Black', qty: { S: 300, M: 400, L: 400, XL: 300 } }, { colour: 'Charcoal', qty: { S: 200, M: 300, L: 300, XL: 200 } }],
      materials: [mat(401, FABRIC, 'Fleece 280 GSM — Black', 'Black', 'kg', 0.42, 3), mat(402, FABRIC, 'Fleece 280 GSM — Charcoal', 'Charcoal', 'kg', 0.42, 3),
        mat(403, TRIM, 'Drawcord 120 cm', null, 'pcs', 1, 2), mat(404, TRIM, 'Main label', null, 'pcs', 1, 2), thread(405, 0.016)],
      production: { cuttingPos: [{ colour: 'Black', docNo: no('CPO', 1071) }, { colour: 'Charcoal', docNo: no('CPO', 1072) }],
        workOrderNo: no('WO', 1079), finishingPoNo: no('FPO', 1036), unit: 'Unit 1 · Line 1', processDocs: [] } }),
    order({ id: 5, orderNo: no('SG', 1029), principalId: 2, principalRef: 'BFH-JW-0611', styleNo: 'BF-TEE-44', styleName: 'V-neck tee', scope: SCOPE.CMT, rate: 36,
      orderDate: wd(1), dueDate: fwd(22),
      colours: [{ colour: 'Olive', qty: { S: 200, M: 300, L: 300, XL: 200 } }, { colour: 'Rust', qty: { S: 200, M: 300, L: 300, XL: 200 } }],
      materials: [mat(501, FABRIC, 'Single jersey 180 GSM — Olive', 'Olive', 'kg', 0.24, 3), mat(502, FABRIC, 'Single jersey 180 GSM — Rust', 'Rust', 'kg', 0.24, 3),
        mat(503, TRIM, 'Main label', null, 'pcs', 1, 2), thread(504, 0.012)],
      production: { cuttingPos: [], workOrderNo: null, finishingPoNo: null, unit: null, processDocs: [] } }),
    order({ id: 6, orderNo: no('SG', 1440, lastFy), principalId: 1, principalRef: 'CWE/PO/1902', styleNo: 'CW-SWT-02', styleName: 'Sweatshirt', scope: SCOPE.CMT, rate: 64,
      orderDate: cal(-330), dueDate: cal(-292),
      colours: [{ colour: 'Grey melange', qty: { S: 200, M: 300, L: 300, XL: 200 } }],
      materials: [mat(601, FABRIC, 'Fleece 300 GSM — Grey melange', 'Grey melange', 'kg', 0.45, 3), mat(602, TRIM, 'Brand label (old design)', null, 'pcs', 1, 2), thread(603, 0.016)],
      production: { cuttingPos: [{ colour: 'Grey melange', docNo: no('CPO', 1611, lastFy) }], workOrderNo: no('WO', 1622, lastFy), finishingPoNo: no('FPO', 1587, lastFy), unit: 'Unit 1 · Line 1', processDocs: [] } }),
  ];

  return {
    seedVersion: INWARD_SEED_VERSION,
    seededOn: today,
    branch,
    principals,
    jobOrders,
    ...buildInwardActivity({ wd, cal, no, lastFy, jobOrders }),
  };
};
