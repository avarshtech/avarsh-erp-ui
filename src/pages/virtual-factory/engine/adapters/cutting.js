import { fabricColour, firstColourName } from '../colours.js';
import { dayOf, num, text } from '../util.js';

/** Cut POs (/cutting/cut-pos): approved cutting work and the order each one belongs to. */
export const adaptCutPos = (list) => (list || []).map((raw) => ({
  id: raw.id,
  no: text(raw.cutPoNo),
  orderId: raw.orderId ?? null,
  orderNo: text(raw.orderNo),
  style: text(raw.styleNo),
  buyer: text(raw.buyer),
  colour: firstColourName(raw.color),
  fabric: text(raw.fabricName),
  orderQty: num(raw.orderQty),
  unit: text(raw.unitName),
}));

const markersOnTables = (plans) => (plans || [])
  .filter((plan) => plan.status === 'IN_PROGRESS')
  .flatMap((plan) => (plan.markers || []).filter((m) => m.cuttingTableId != null).map((marker) => ({ plan, marker })));

/** The stage a table is at today, from the lays audited on it and the marker's planned dates. */
const tableStage = (assigned, laysToday, today) => {
  if (!assigned) return 'idle';
  const lays = laysToday.filter((lay) => lay.markerId === assigned.marker.id);
  if (lays.some((lay) => !lay.endTime)) return 'spreading';
  if (lays.length) return 'cutting';
  if (dayOf(assigned.marker.cutPlanDate) === today) return 'cutting';
  if (dayOf(assigned.marker.layPlanDate) === today) return 'spreading';
  return 'ready';
};

/** Pick, per table, the marker planned closest to today. */
const pickForTable = (candidates, today) => candidates
  .map((c) => ({ c, d: Math.abs(new Date(dayOf(c.marker.cutPlanDate) || dayOf(c.marker.layPlanDate) || today) - new Date(today)) }))
  .sort((a, b) => a.d - b.d)[0]?.c || null;

export const adaptCutting = ({ dashboard, cutPos, markerPlans, layAudits, tables }, today) => {
  const d = dashboard || {};
  const cutPoByNo = new Map(cutPos.map((po) => [po.no, po]));
  const placed = markersOnTables(markerPlans);
  const laysToday = (layAudits || []).filter((lay) => dayOf(lay.layDate) === today && lay.status !== 'REJECTED');
  const tableList = (tables || []).length ? tables : [];

  return {
    output: num(d.todayOutput),
    totalCut: num(d.totalCut),
    reCutPct: num(d.reCutPct),
    tmbPassPct: d.tmbPassPct == null ? null : num(d.tmbPassPct),
    bundled: num(d.bundleStatus?.BUNDLED),
    issuedToSewing: num(d.bundleStatus?.ISSUED_SEWING),
    dailyCut: (d.dailyCut || []).map((day) => ({ date: dayOf(day.date), qty: num(day.qty) })),
    alerts: (d.alerts || []).map((a) => ({ type: text(a.type), text: text(a.text) })),
    relaxing: (d.pendingRelaxations || []).map((r) => ({
      id: r.id,
      no: text(r.relaxationNo),
      cutPoNo: text(r.cuttingPoNo),
      fabricType: text(r.fabricType),
      readyAt: text(r.readyAt),
      remainingHours: num(r.remainingHours),
      minHours: num(r.minRelaxHours),
    })),
    progress: (d.progress || []).map((p) => ({
      cutPoNo: text(p.cutPoNo),
      orderNo: cutPoByNo.get(text(p.cutPoNo))?.orderNo || '',
      style: text(p.styleNo),
      colour: firstColourName(p.color),
      orderQty: num(p.orderQty),
      cut: num(p.cut),
      pct: num(p.pct),
    })),
    tables: tableList.map((table) => {
      const assigned = pickForTable(placed.filter((c) => c.marker.cuttingTableId === table.id), today);
      const cutPo = assigned ? cutPoByNo.get(text(assigned.plan.cuttingPoNo)) : null;
      return {
        id: table.id,
        name: text(table.name),
        stage: tableStage(assigned, laysToday, today),
        planNo: assigned ? text(assigned.plan.planNo) : '',
        markerNo: assigned ? text(assigned.marker.markerNo) : '',
        cutPoNo: assigned ? text(assigned.plan.cuttingPoNo) : '',
        orderNo: cutPo?.orderNo || '',
        style: assigned ? text(assigned.plan.styleNo) : '',
        colour: cutPo?.colour || '',
        hex: fabricColour(cutPo?.colour),
        plies: assigned ? num(assigned.marker.markerHeight) : 0,
        layLength: assigned ? num(assigned.marker.markerLength) : 0,
        piecesPerLay: assigned ? num(assigned.marker.piecesPerMarker) * num(assigned.marker.markerHeight) : 0,
      };
    }),
  };
};
