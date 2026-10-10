/**
 * Closed-order history for Analytics (mock phase). 36 orders are simulated deterministically
 * (fixed seed): each order's network is derived exactly as a live order's would be, actual
 * finishes are drawn with category-specific slips, and the result is emitted as the source
 * events the modules would have sent. Those events then go through the same replay as live
 * orders, so every analytic figure is computed, never typed.
 */
import { addWD, addCD, maxDate } from './tnaCalendar';
import { topology } from './tnaEngine';
import { deriveActivities } from './tnaDerivation';

const seeded = (seed) => {
  let s = seed;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const BUYERS = [
  ['H&M', 'Woven Tops', 'Woven Shirt'], ['Zara', 'Knits', 'Knit Top'], ['Decathlon', 'Woven Bottoms', 'Woven Shorts'],
  ['Primark', 'Kidswear', 'Kids Tee'], ['M&S', 'Knits', 'Knit Polo'], ['Uniqlo', 'Woven Tops', 'Woven Shirt'],
  ['C&A', 'Woven Dresses', 'Woven Dress'], ['Tesco F&F', 'Kidswear', 'Kids Pyjama'],
];

// Extra days (in the activity's own day type) by attribution — buyers and the mill run late most.
const SLIP = {
  BUYER: (r) => (r() < 0.3 ? 0 : 1 + Math.floor(r() * 7)),
  SUPPLIER: (r) => (r() < 0.35 ? 0 : 1 + Math.floor(r() * 9)),
  QUALITY: (r) => (r() < 0.8 ? 0 : 1 + Math.floor(r() * 3)),
  SUBCONTRACTOR: (r) => (r() < 0.5 ? 0 : 1 + Math.floor(r() * 3)),
  INTERNAL_PRE_PRODUCTION: (r) => (r() < 0.6 ? 0 : 1 + Math.floor(r() * 3)),
  INTERNAL_PRODUCTION: (r) => (r() < 0.65 ? -Math.floor(r() * 2) : 1 + Math.floor(r() * 2)),
};

const REASONS = {
  BUYER: ['Buyer comments arrived after the approval deadline', 'Buyer tech review slot moved', 'Buyer asked to re-submit within the shade band'],
  SUPPLIER: ['Mill delayed greige; dyeing slot rebooked', 'Supplier ASN revised — transport delay', 'Partial shipment from mill; balance short-shipped'],
  QUALITY: ['Re-inspection after shade variation', 'Shrinkage re-test on lot 2'],
  SUBCONTRACTOR: ['Printer capacity taken by another buyer', 'Wash plant boiler down two days', 'Embroidery rework on 6% of panels'],
  INTERNAL_PRE_PRODUCTION: ['Sampling room overloaded', 'Pattern corrections after fit comments', 'Marker re-planned for fabric width'],
  INTERNAL_PRODUCTION: ['Line changeover took longer', 'Absenteeism on line 4', 'Cutting table down for maintenance'],
};

const STAGE_TYPE = { LAB_DIP: 'Lab Dip', FIT: 'Fit', FBP: 'First Bulk Piece', PP: 'PP Sample' };

const eventFor = (a, src, n) => {
  const base = { sampleType: STAGE_TYPE[a.sampleKey], cycle: a.cycle };
  switch (a.completionEvent) {
    case 'order.confirmed': return ['order.confirmed', src.orderNo, 'K. Rao (Merchandising)', {}];
    case 'bom.version_released': return ['bom.version_released', `BOM/26-27/${n}`, 'S. Iyer (Merchandising)', {}];
    case 'purchase_order.approved': return ['purchase_order.approved', `PO/26-27/${n + (a.code === 'A07' ? 1 : 0)}`, 'S. Mehta (Purchase)', { material: a.code === 'A07' ? 'FABRIC' : 'TRIM' }];
    case 'sample.dispatched': return ['sample.dispatched', a.sampleRef, 'A. Devi (Sampling)', base];
    case 'sample.approved':
      return src.rejected && a.sampleKey === 'LAB_DIP' && a.cycle === 1
        ? ['sample.rejected', a.sampleRef, `${src.buyer} Colour Dept`, { ...base, reason: 'Shade off-standard', evidence: { record: `${a.sampleRef} feedback`, text: 'Shade off-standard' } }]
        : ['sample.approved', a.sampleRef, `${src.buyer} (recorded by A. Devi)`, base];
    case 'grn.accepted': return ['grn.posted', `GRN/26-27/${10000 + n}`, 'R. Nair (Stores)', { qty: src.fabricRequired }];
    case 'inspection.completed': return ['inspection.completed', `QC/26-27/0${n}`, 'L. Thomas (QC)', { scope: 'FABRIC', result: 'PASS' }];
    case 'pattern.released': return ['pattern.released', `BOM/26-27/${n} · pattern`, 'M. Joseph (CAD)', {}];
    case 'marker.released': return ['marker.released', `MP/26-27/0${n}`, 'P. Kumar (Cutting)', {}];
    case 'pp_meeting.recorded': return ['pp_meeting.recorded', `PPM/26-27/0${n}`, 'V. Prakash (Production Planning)', {}];
    case 'production.cut_output': return ['production.cut_output', `CR/26-27/${n}`, 'Cutting master', { qty: src.qty }];
    case 'production.sewing_output': return ['production.sewing_output', `SH/26-27/${n}`, 'Sewing supervisor', { qty: src.qty }];
    case 'production.packing_completed': return ['production.packing_completed', `PK/26-27/${n}`, 'Packing in-charge', {}];
    case 'panel.receipt_accepted': return ['panel.receipt_accepted', `CPR-RET/26-27/${n}${a.scope.seq}`, 'Cutting room stores', { seq: a.scope.seq, qty: a.requiredQty }];
    case 'process.receipt_accepted': return ['process.receipt_accepted', `GPR-RET/26-27/${n}${a.scope.seq}`, 'Finishing stores', { seq: a.scope.seq, qty: a.requiredQty }];
    case 'shipment.dispatched': return ['shipment.dispatched', `INV/26-27/${n}`, 'Shipping (Merchandising)', { lineId: 1 }];
    default: return null;
  }
};

const sampleList = (r, n) => [
  ...(r() < 0.7 ? [{ sampleType: 'Lab Dip', ref: `SR/26-27/${n}` }] : []),
  ...(r() < 0.85 ? [{ sampleType: 'Fit', ref: `SR/26-27/${n + 1}` }] : []),
  { sampleType: 'First Bulk Piece', ref: `SR/26-27/${n + 2}` },
  { sampleType: 'PP Sample', ref: `SR/26-27/${n + 3}` },
];

/** Simulated closed orders as source records with their event timelines. */
export const buildHistorySources = (ctx) => {
  const r = seeded(20261003);
  return Array.from({ length: 36 }, (_, i) => {
    const [buyer, productType, garmentType] = BUYERS[i % BUYERS.length];
    const n = 700 + i * 4;
    const qty = 3000 + Math.floor(r() * 18) * 1000;
    const orderDate = addCD('2026-03-23', i * 2);
    const lead = 76 + Math.floor(r() * 14);
    const samples = sampleList(r, 2000 + i * 4);
    const cutSteps = ['Panel Printing', 'Panel Embroidery', 'Heat Transfer'].filter(() => r() < 0.45);
    const washSteps = ['Enzyme Washing', 'Bleach Washing', 'Softener Washing'].filter(() => r() < 0.4);
    const src = {
      id: 500 + i, orderNo: `SG/26-27/0${n}`, buyer, productType, garmentType, styleNo: `${productType.slice(0, 3).toUpperCase()}-${3000 + i * 37}`,
      qty, merchandiser: ['Priya S', 'Arun K', 'Meena R', 'Sanjay V'][i % 4], orderDate, fabricRequired: Math.round(qty * 1.08), fabricUom: 'm',
      lines: [{ lineId: 1, lineNo: 1, buyerPoNo: `${buyer.slice(0, 2).toUpperCase()}-${41000 + i}`, destination: 'EU', qty, dispatchDate: addCD(orderDate, lead) }],
      bom: { ref: `BOM/26-27/${n}` },
      samples,
      cutPanel: cutSteps.length ? { ref: `CPR/26-27/0${n}`, status: 'SUBMITTED', lines: cutSteps.map((p, k) => ({ lineKey: `L${k + 1}`, seq: k + 1, process: p, panel: 'Front', colours: ['Navy'], qty })) } : null,
      garmentProcess: washSteps.length ? { ref: `GPR/26-27/0${n}`, status: 'SUBMITTED', lines: washSteps.map((p, k) => ({ lineKey: `L${k + 1}`, seq: k + 1, process: p, colours: ['Navy'], qty })) } : null,
      rejected: samples.some((s) => s.sampleType === 'Lab Dip') && r() < 0.18,
      events: [],
    };
    const snapshot = {
      samples: samples.map((s) => ({ ...s, cycles: src.rejected && s.sampleType === 'Lab Dip' ? 2 : 1 })),
      cutPanel: src.cutPanel, garmentProcess: src.garmentProcess, flags: {}, orderQty: qty, fabricRequired: src.fabricRequired,
    };
    const acts = deriveActivities(snapshot, { ...ctx.master, overrides: ctx.overrides, processSteps: ctx.processSteps }, { buyer, productType });
    const { order, byCode } = topology(acts);
    const finish = {};
    order.forEach((code) => {
      const a = byCode[code];
      const start = a.predecessors.length ? maxDate(a.predecessors.map((p) => finish[p])) : orderDate;
      const slip = code === 'A01' ? 0 : Math.max(-a.duration, SLIP[a.attribution](r));
      finish[code] = a.dayType === 'CD' ? addCD(start, a.duration + slip) : addWD(ctx.cal, start, a.duration + slip);
      if (a.sourceStatus === 'MISSING') return;
      const made = eventFor(a, src, n);
      if (!made) return;
      const [event, ref, by, extra] = made;
      const evidence = slip > 0 && r() < 0.86 && !extra.evidence ? { evidence: { record: ref, text: REASONS[a.attribution][Math.floor(r() * REASONS[a.attribution].length)] } } : {};
      src.events.push({ id: `${src.id}-${code}`, at: `${finish[code]} ${String(9 + (src.events.length % 8)).padStart(2, '0')}:00`, event, ref, by, ...extra, ...evidence });
    });
    if (r() < 0.4) {
      const moveBy = 7 + Math.floor(r() * 28);
      src.events.push({
        id: `${src.id}-commit`, at: `${addCD(orderDate, Math.floor(lead * 0.55))} 16:00`, event: 'order.dispatch_revised', ref: src.orderNo,
        by: 'K. Rao (Merchandising Mgr)', lineId: 1, date: addCD(src.lines[0].dispatchDate, moveBy), reason: `Buyer moved the shipment window by ${moveBy} days`,
      });
    }
    return src;
  });
};
