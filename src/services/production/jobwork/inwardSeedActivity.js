/**
 * Activity behind the inward demo: Material In documents and their lots (fabric rolls, trims, panel
 * sets), issues to production, end-bits back, cutting waste, daily progress and returns to the
 * principal. Everything is generated from the parameters below, so balances always agree.
 */
import { MATERIAL_KIND, RETURN_STATUS, TARGET_TYPE } from '../../../utils/jobWorkInward/inwardConstants';
import { splitBySize } from '../../../utils/jobWorkTracker/pullBackRules';
import { SHARED_ORDER, printBackBySize } from './principalOrderShared';

const STORES = 'Arun (stores)';
const WEIGHTS = [1, 0.97, 1.03, 0.99, 1.02, 0.98, 1.01, 1, 0.96, 1.04];
const r1 = (n) => Math.round(n * 10) / 10;

const rollsFor = (code, total, count, spec) => {
  const w = Array.from({ length: count }, (_, i) => WEIGHTS[i % WEIGHTS.length]);
  const sumW = w.reduce((a, b) => a + b, 0);
  let given = 0;
  return w.map((x, i) => {
    const qty = i === count - 1 ? r1(total - given) : r1((total * x) / sumW);
    given = r1(given + qty);
    return { rollNo: `${code}${String(i + 1).padStart(2, '0')}`, qty, width: spec.width, gsm: spec.gsm, shade: i % 3 === 2 ? 'B' : 'A' };
  });
};

/** Line builders: fabric with rolls, a counted trim, or panel sets per size. */
const fab = (materialId, code, received, rolls, challan, spec, declaredRate) => ({ kind: MATERIAL_KIND.FABRIC, materialId, uom: 'kg', receivedQty: received, challanQty: challan, declaredRate, rollSpec: { code, rolls, ...spec } });
const cnt = (materialId, uom, received, challan, declaredRate, defectiveQty = 0) => ({ kind: MATERIAL_KIND.TRIM, materialId, uom, receivedQty: received, challanQty: challan, declaredRate, defectiveQty });
const panels = (materialId, bySize, defectBySize, declaredRate) => Object.entries(bySize).map(([size, q]) => ({
  kind: MATERIAL_KIND.PANELS, materialId, uom: 'sets', size, receivedQty: q, challanQty: q, declaredRate, defectiveQty: defectBySize[size] || 0,
}));

export const buildInwardActivity = ({ wd, cal, no, lastFy, jobOrders }) => {
  const JO = Object.fromEntries(jobOrders.map((j) => [j.id, j]));
  const matOf = (id) => jobOrders.flatMap((j) => j.materials).find((m) => m.id === id);
  const seq = { inward: 0, lot: 0, movement: 0, ret: 0, waste: 0 };
  const inwards = [];
  const lots = [];
  const movements = [];
  const waste = [];

  // ── Material In: each line is a lot owned by the principal ──
  const inward = (n, jo, date, dc, dcDate, extra, lineDefs, year) => {
    seq.inward += 1;
    const doc = { id: seq.inward, inwardNo: no('JWI', n, year), jobOrderId: jo, principalId: JO[jo].principalId, date, theirDcNo: dc, theirDcDate: dcDate,
      dispatchedFrom: extra.from, vehicleNo: extra.vehicle, ewayBillNo: extra.eway || '', status: 'POSTED', cancelReason: null, receivedBy: STORES, defects: extra.defects || [] };
    inwards.push(doc);
    lineDefs.flat().forEach((l, i) => {
      seq.lot += 1;
      const m = matOf(l.materialId);
      lots.push({
        id: seq.lot, lotNo: `JWI${n}-${i + 1}`, inwardId: doc.id, jobOrderId: jo, materialId: l.materialId,
        kind: l.kind, colour: m.colour, size: l.size || null, uom: l.uom, challanQty: l.challanQty, receivedQty: l.receivedQty, defectiveQty: l.defectiveQty || 0,
        declaredRate: l.declaredRate, location: `Party rack P-0${JO[jo].principalId}`, date: dcDate, receivedOn: date, origin: null,
        rolls: l.rollSpec ? rollsFor(`${n}-${l.rollSpec.code}`, l.receivedQty, l.rollSpec.rolls, l.rollSpec) : null,
      });
    });
    return doc;
  };
  const SJ = { width: '72"', gsm: 160 };
  inward(1288, 6, cal(-322), 'CWE/DC/6611', cal(-323), { from: 'Comfort Wear Exports, Tiruppur', vehicle: 'TN39 AB 4410' },
    [fab(601, 'GM', 465, 8, 465, { width: '72"', gsm: 300 }, 410), cnt(602, 'pcs', 3000, 3000, 0.5)], lastFy);
  inward(1001, 4, wd(42), 'CWE/DC/7690', wd(43), { from: 'Comfort Wear Exports, Tiruppur', vehicle: 'TN39 AX 1180' },
    [fab(401, 'BK', 612, 10, 612, { width: '72"', gsm: 280 }, 390), fab(402, 'CH', 438, 7, 438, { width: '72"', gsm: 280 }, 390)]);
  inward(1002, 4, wd(41), 'CWE/DC/7697', wd(41), { from: 'Comfort Wear Exports, Tiruppur', vehicle: 'TN39 AX 1180' },
    [cnt(403, 'pcs', 2460, 2460, 4), cnt(404, 'pcs', 2460, 2460, 0.6)]);
  inward(1003, 1, wd(17), 'CWE/DC/7741', wd(18), { from: 'Comfort Wear Exports, Tiruppur', vehicle: 'TN39 BK 2201' },
    [fab(101, 'WH', 505, 8, 506, SJ, 280), fab(102, 'NV', 501, 8, 502, SJ, 280)]);
  inward(1004, 1, wd(15), 'CWE/DC/7768', wd(15), { from: 'Comfort Wear Exports, Tiruppur', vehicle: 'TN39 BK 2201' },
    [fab(103, 'GR', 366, 6, 366, SJ, 280), cnt(104, 'pcs', 6150, 6150, 0.6), cnt(105, 'pcs', 6150, 6150, 0.4), cnt(106, 'pcs', 6200, 6200, 1.2)]);
  inward(1005, 3, wd(12), 'KKA/DC/0315', wd(13), { from: 'Kochi Kids Apparel, Kochi', vehicle: 'KL07 CD 5521', eway: '7712 0045 3390',
    defects: [{ text: 'Pink: 6 sets with a sleeve short (2Y 1, 4Y 2, 6Y 2, 8Y 1)' }] },
  [panels(301, { '2Y': 303, '4Y': 404, '6Y': 404, '8Y': 303 }, { '2Y': 1, '4Y': 2, '6Y': 2, '8Y': 1 }, 120),
    panels(302, { '2Y': 253, '4Y': 354, '6Y': 354, '8Y': 251 }, {}, 120)]);
  inward(1006, 3, wd(11), 'KKA/DC/0322', wd(12), { from: 'Kochi Kids Apparel, Kochi', vehicle: 'KL07 CD 5521', eway: '7712 0045 3517' },
    [cnt(303, 'm', 3000, 3000, 9), cnt(304, 'pcs', 2660, 2660, 0.6), cnt(305, 'pcs', 5320, 5320, 1.1)]);
  inward(1007, 2, wd(9), 'BFH/DC/1187', wd(11), { from: 'Sri Balaji Dyeing, Tiruppur (their dyer)', vehicle: 'TN39 CJ 7788', eway: '3611 2290 4471',
    defects: [{ text: 'Navy roll 1007-NV07: 4 holes in the first 2 m' }, { text: 'White collars: 12 sets with broken tipping' }] },
  [fab(201, 'WH', 378, 9, 379, { width: '68"', gsm: 220 }, 340), fab(202, 'NV', 290, 7, 300, { width: '68"', gsm: 220 }, 340),
    cnt(203, 'sets', 1330, 1330, 18, 12), cnt(204, 'sets', 1000, 1000, 18), cnt(205, 'pcs', 8600, 8600, 0.4), cnt(206, 'pcs', 2860, 2860, 0.6)]);

  const lotOf = (materialId, size) => lots.find((l) => l.materialId === materialId && (!size || l.size === size));
  const usable = (l) => l.receivedQty - l.defectiveQty;

  // ── Movements: issues to production (MIS), end-bits back (FRT), write-offs (PSW) ──
  const move = (type, date, docNo, lotId, qty, extra = {}) => {
    seq.movement += 1;
    movements.push({ id: seq.movement, type, date, docNo, lotId, qty, cancelled: false, ...extra });
  };
  const cpo = (jo, colour) => JO[jo].production.cuttingPos.find((c) => c.colour === colour).docNo;
  const T = {
    cpo: (jo, colour) => ({ type: TARGET_TYPE.CUTTING_PO, docNo: cpo(jo, colour), name: 'Unit 1 · Cutting' }),
    wo: (jo) => ({ type: TARGET_TYPE.WORK_ORDER, docNo: JO[jo].production.workOrderNo, name: JO[jo].production.unit }),
    fpo: (jo) => ({ type: TARGET_TYPE.FINISHING_PO, docNo: JO[jo].production.finishingPoNo, name: 'Unit 1 · Finishing' }),
    print: () => ({ type: TARGET_TYPE.PROCESS_PO, docNo: no('CPPO', SHARED_ORDER.printingDocN), name: 'Bright Prints (printing)' }),
  };
  const back = printBackBySize();
  const issues = [
    [cal(-321), 6, [[601, 465, T.cpo(6, 'Grey melange')]], lastFy, 2741],
    [cal(-318), 6, [[602, 1020, T.wo(6)]], lastFy, 2752],
    [wd(40), 4, [[401, 612, T.cpo(4, 'Black')], [402, 438, T.cpo(4, 'Charcoal')]]],
    [wd(36), 4, [[403, 2400, T.wo(4)], [404, 2400, T.wo(4)]]],
    [wd(16), 1, [[101, 505, T.cpo(1, 'White')], [102, 501, T.cpo(1, 'Navy')]]],
    [wd(14), 1, [[103, 366, T.cpo(1, 'Grey')]]],
    [wd(12), 1, [[104, 4000, T.wo(1)], [105, 4000, T.wo(1)]]],
    [wd(10), 3, SHARED_ORDER.sizes.map((s) => [301, usable(lotOf(301, s)), T.print(), s, back[s]])],
    [wd(9), 3, [...SHARED_ORDER.sizes.map((s) => [302, usable(lotOf(302, s)), T.wo(3), s]), [303, 2000, T.wo(3)], [304, 1800, T.wo(3)], [305, 3600, T.wo(3)]]],
    [wd(8), 2, [[201, 378, T.cpo(2, 'White')]]],
    [wd(7), 2, [[205, 4000, T.wo(2)], [206, 1400, T.wo(2)], [203, 1318, T.wo(2)]]],
    [wd(6), 1, [[106, 3500, T.fpo(1)]]],
    [wd(5), 1, [[104, 2100, T.wo(1)], [105, 2100, T.wo(1)]]],
    [wd(5), 2, [[202, 150, T.cpo(2, 'Navy')]]],
    [wd(2), 1, [[106, 2600, T.fpo(1)]]],
  ];
  let mis = 2189;
  issues.forEach(([date, , lines, year, n]) => {
    const docNo = year ? no('MIS', n, year) : no('MIS', (mis += 1));
    lines.forEach(([materialId, qty, target, size, backFromVendor]) => move('ISSUE', date, docNo, lotOf(materialId, size).id, qty, { target, backFromVendor: backFromVendor ?? null }));
  });
  [[cal(-301), [[601, 7.5]], 1690, lastFy], [wd(30), [[401, 8.5], [402, 6]], 1071], [wd(8), [[101, 6.2], [102, 5.4], [103, 4.1]], 1078]].forEach(([date, lines, n, year]) => {
    lines.forEach(([materialId, qty]) => move('BACK', date, no('FRT', n, year), lotOf(materialId).id, qty, { reason: 'End-bits back from the cutting room' }));
  });
  move('WRITE_OFF', wd(3), no('PSW', 1001), lotOf(106).id, 30, { reason: 'Torn in our store — principal informed' });

  // ── Cutting waste per fabric line: held after cutting, then returned or sold per the principal's rule ──
  const wasteRow = (jobOrderId, materialId, date, type, kg, extra = {}) => {
    seq.waste += 1;
    waste.push({ id: seq.waste, jobOrderId, materialId, date, type, kg, ...extra });
  };
  [[6, 601, cal(-305), 12.4], [4, 401, wd(31), 14.2], [4, 402, wd(31), 10.1], [1, 101, wd(8), 11.8], [1, 102, wd(8), 12.3], [1, 103, wd(8), 8.6],
    [2, 201, wd(5), 9.4], [2, 202, wd(3), 3.1]].forEach(([jo, m, date, kg]) => wasteRow(jo, m, date, 'HELD', kg));
  wasteRow(2, 201, wd(2), 'SOLD', 9.4, { docNo: no('WST', 1001), buyer: 'Tiruppur Waste Traders', invoiceNo: 'AV/SC/0091', consentRef: 'Asha N, mail of 3 Oct' });
  const fabricUse = [[6, 601, 445.1], [4, 401, 584], [4, 402, 418], [1, 101, 484.5], [1, 102, 480.1], [1, 103, 349.2], [2, 201, 362.1], [2, 202, 144]]
    .map(([jobOrderId, materialId, usedInLays]) => ({ jobOrderId, materialId, usedInLays }));

  // ── Daily progress (increments), from working-day offsets ──
  const progress = [];
  const genProgress = (jo, { cut = [], stitched, packed = [], rejects = [] }) => {
    const o = JO[jo];
    const colourQty = Object.fromEntries(o.colours.map((c) => [c.colour, Object.values(c.qty).reduce((a, b) => a + b, 0)]));
    const tot = { cut: {}, stitched: 0, packed: {}, rejects: {} };
    const start = Math.max(...[...cut, ...packed, ...rejects, stitched || { from: 0 }].map((x) => x.from));
    for (let n = start; n >= 0; n -= 1) {
      const row = { jobOrderId: jo, date: wd(n), cut: {}, stitched: 0, packed: {}, rejects: {} };
      cut.filter((c) => n <= c.from).forEach((c) => {
        const q = Math.min(c.perDay, (c.cap ?? colourQty[c.colour]) - (tot.cut[c.colour] || 0));
        if (q > 0) { row.cut[c.colour] = q; tot.cut[c.colour] = (tot.cut[c.colour] || 0) + q; }
      });
      const cutTotal = Object.values(tot.cut).reduce((a, b) => a + b, 0);
      if (stitched && n <= stitched.from) {
        const capTotal = Math.min(stitched.cap ?? Infinity, o.scope === 'CMT' ? cutTotal : Infinity, Object.values(colourQty).reduce((a, b) => a + b, 0));
        row.stitched = Math.max(0, Math.min(stitched.perDay, capTotal - tot.stitched));
        tot.stitched += row.stitched;
      }
      rejects.filter((x) => n <= x.from).forEach((x) => {
        const q = Math.min(x.perDay, (x.cap ?? Infinity) - (tot.rejects[x.colour] || 0));
        if (q > 0) { row.rejects[x.colour] = q; tot.rejects[x.colour] = (tot.rejects[x.colour] || 0) + q; }
      });
      packed.filter((p) => n <= p.from).forEach((p) => {
        const cap = colourQty[p.colour] - (tot.rejects[p.colour] || 0);
        const q = Math.min(p.perDay, cap - (tot.packed[p.colour] || 0));
        if (q > 0) { row.packed[p.colour] = q; tot.packed[p.colour] = (tot.packed[p.colour] || 0) + q; }
      });
      if (Object.keys(row.cut).length || row.stitched || Object.keys(row.packed).length) progress.push(row);
    }
  };
  genProgress(4, { cut: [{ colour: 'Black', from: 40, perDay: 280 }, { colour: 'Charcoal', from: 40, perDay: 200 }], stitched: { from: 37, perDay: 200 },
    packed: [{ colour: 'Black', from: 33, perDay: 117 }, { colour: 'Charcoal', from: 33, perDay: 83 }],
    rejects: [{ colour: 'Black', from: 33, perDay: 1, cap: 10 }, { colour: 'Charcoal', from: 33, perDay: 1, cap: 8 }] });
  genProgress(1, { cut: [{ colour: 'White', from: 15, perDay: 220 }, { colour: 'Navy', from: 15, perDay: 220 }, { colour: 'Grey', from: 15, perDay: 160 }],
    stitched: { from: 12, perDay: 330 }, packed: [{ colour: 'White', from: 10, perDay: 110 }, { colour: 'Navy', from: 10, perDay: 110 }, { colour: 'Grey', from: 10, perDay: 80 }],
    rejects: [{ colour: 'White', from: 10, perDay: 1 }, { colour: 'Navy', from: 10, perDay: 1 }, { colour: 'Grey', from: 10, perDay: 1 }] });
  genProgress(2, { cut: [{ colour: 'White', from: 7, perDay: 450 }, { colour: 'Navy', from: 4, perDay: 130, cap: 520 }], stitched: { from: 5, perDay: 180 },
    packed: [{ colour: 'White', from: 3, perDay: 120 }], rejects: [{ colour: 'White', from: 3, perDay: 1 }] });
  genProgress(3, { stitched: { from: 8, perDay: 200 }, packed: [{ colour: 'Lilac', from: 6, perDay: 100 }, { colour: 'Pink', from: 6, perDay: 70 }],
    rejects: [{ colour: 'Lilac', from: 6, perDay: 1 }, { colour: 'Pink', from: 6, perDay: 1 }] });
  progress.push({ jobOrderId: 6, date: cal(-300), cut: { 'Grey melange': 1000 }, stitched: 1000, packed: { 'Grey melange': 995 }, rejects: { 'Grey melange': 5 } });

  // ── Returns to the principal, split over sizes within what was packed by that date ──
  const returns = [];
  const packedUpTo = (jo, date, key) => progress.filter((p) => p.jobOrderId === jo && p.date <= date)
    .reduce((acc, p) => { Object.entries(p[key] || {}).forEach(([c, q]) => { acc[c] = (acc[c] || 0) + q; }); return acc; }, {});
  const sent = { good: {}, rejects: {} };
  const takeLines = (jo, date, key, byColour) => {
    const have = packedUpTo(jo, date, key === 'good' ? 'packed' : 'rejects');
    return Object.entries(byColour).flatMap(([colour, qty]) => {
      const sizesQty = JO[jo].colours.find((c) => c.colour === colour).qty;
      const before = sent[key][`${jo}|${colour}`] || 0;
      const avail = splitBySize(have[colour] || 0, sizesQty);
      const prev = splitBySize(before, sizesQty);
      const next = splitBySize(before + qty, sizesQty);
      sent[key][`${jo}|${colour}`] = before + qty;
      return Object.keys(sizesQty).map((size) => ({ colour, size, qty: Math.min((next[size] || 0) - (prev[size] || 0), Math.max(0, (avail[size] || 0) - (prev[size] || 0))) }))
        .filter((l) => l.qty > 0);
    });
  };
  const ret = (n, jo, date, good, extra = {}, year) => {
    seq.ret += 1;
    const r = {
      id: seq.ret, returnNo: no('RTP', n, year), date, jobOrderId: jo, ourChallanNo: extra.challan, ewayBillNo: extra.eway || '', vehicleNo: extra.vehicle || 'TN39 AV 1002',
      shipTo: extra.shipTo || null, status: RETURN_STATUS.DISPATCHED, cancelReason: null, createdBy: STORES,
      garments: takeLines(jo, date, 'good', good), rejects: extra.rejects ? takeLines(jo, date, 'rejects', extra.rejects) : [],
      lotLines: (extra.lots || []).map(([materialId, qty]) => ({ lotId: lotOf(materialId).id, qty })), wasteKg: extra.waste || 0, tally: extra.tally || null,
    };
    returns.push(r);
    r.lotLines.forEach((l) => move('RETURN', date, r.returnNo, l.lotId, l.qty, { returnId: r.id }));
    (extra.wasteSplit || []).forEach(([materialId, kg]) => wasteRow(jo, materialId, date, 'RETURNED', kg, { docNo: r.returnNo, returnId: r.id }));
  };
  ret(1188, 6, cal(-290), { 'Grey melange': 995 }, { challan: 'AVR-0388', rejects: { 'Grey melange': 5 }, waste: 12.4, wasteSplit: [[601, 12.4]],
    lots: [[601, 7.5]], tally: { invoiceNo: 'AV/JC/25-26/0211', invoiceDate: cal(-286) } }, lastFy);
  ret(1001, 4, wd(29), { Black: 467, Charcoal: 333 }, { challan: 'AVR-0601' });
  ret(1002, 4, wd(25), { Black: 525, Charcoal: 375 }, { challan: 'AVR-0612', tally: { invoiceNo: 'AV/JC/0398', invoiceDate: wd(23) },
    shipTo: { name: 'Comfort Wear Exports — c/o Sea Cargo CFS', address: 'CFS 4, Ennore Road, Chennai 600057', principalInvoiceNo: 'CWE/EXP/2026/118' } });
  ret(1003, 4, wd(20), { Black: 398, Charcoal: 284 }, { challan: 'AVR-0626', rejects: { Black: 10, Charcoal: 8 }, waste: 24.3, wasteSplit: [[401, 14.2], [402, 10.1]],
    lots: [[401, 8.5], [402, 6], [403, 60], [404, 60]], tally: { invoiceNo: 'AV/JC/0405', invoiceDate: wd(18) } });
  ret(1004, 1, wd(6), { White: 440, Navy: 440, Grey: 320 }, { challan: 'AVR-0655', tally: { invoiceNo: 'AV/JC/0431', invoiceDate: wd(4) } });
  ret(1005, 1, wd(2), { White: 480, Navy: 480, Grey: 340 }, { challan: 'AVR-0668', rejects: { White: 4, Navy: 4, Grey: 4 } });

  return {
    inwards, lots, movements, waste, fabricUse, progress, returns,
    seq: { ...seq, jobOrder: 6, principal: 3 },
    counters: { JWI: 1007, MIS: mis, FRT: 1078, RTP: 1005, WST: 1001, PSW: 1001, PSM: 1000, SG: 1029 },
  };
};
