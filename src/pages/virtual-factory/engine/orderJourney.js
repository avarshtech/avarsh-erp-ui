import { STAGE_META, STAGES } from './orderProgress.js';
import { formatQty, round, sum, unique } from './util.js';

/** The zones an order's stitched route passes through, in floor order. */
export const ROUTE_ZONES = ['office', 'receiving', 'store', 'cutting', 'staging', 'sewing', 'qc', 'finishing', 'packing', 'fg', 'shipping'];

const STEP_STAGE = {
  order: 'planning', planning: 'planning', material: 'material', purchase: 'material', cutting: 'cutting',
  sewing: 'sewing', qc: 'sewing', finishing: 'finishing', packing: 'packing', shipping: 'shipping',
};

const stageIndex = (stage) => (stage === 'planning' ? -1 : STAGES.indexOf(stage));

const stateOf = (step, current, blocked) => {
  if (blocked) return 'blocked';
  const at = stageIndex(STEP_STAGE[step]);
  const now = stageIndex(current);
  if (step === 'order') return 'done';
  if (at < now) return 'done';
  return at === now ? 'active' : 'pending';
};

/** Everything the ERP knows about one order's way through the factory, as ordered steps. */
export const buildJourney = (snapshot, orderNo) => {
  const order = snapshot.orders.find((o) => o.no === orderNo);
  const progress = snapshot.progress.get(orderNo);
  if (!order || !progress) return null;
  const pos = snapshot.purchaseOrders.filter((po) => po.orderRefs.some((r) => r.orderNo === orderNo));
  const poNos = new Set(pos.map((po) => po.no));
  const grns = snapshot.grns.filter((g) => poNos.has(g.poNo));
  const cutPos = snapshot.cutPos.filter((c) => c.orderNo === orderNo);
  const cut = sum(snapshot.cutting.progress.filter((c) => c.orderNo === orderNo), (c) => c.cut);
  const relaxing = snapshot.cutting.relaxing.filter((r) => cutPos.some((c) => c.no === r.cutPoNo));
  const lines = snapshot.sewing.lines.filter((l) => l.active && l.orderNo === orderNo);
  const qcLines = lines.filter((l) => l.qc);
  const gi = snapshot.garmentIssues.filter((g) => g.orderNo === orderNo);
  const vendors = snapshot.processIssues.filter((p) => p.orderNo === orderNo && p.pending > 0);
  const packing = [...snapshot.packing.open, ...snapshot.packing.completed].filter((e) => e.orderNo === orderNo);
  const production = snapshot.productionOrders.filter((x) => x.orderNo === orderNo);
  const shortages = progress.shortages;
  const current = progress.current;
  const qty = order.qty;
  const stage = (key) => progress.stages.find((s) => s.key === key);

  const steps = [
    { key: 'order', icon: '📋', title: 'Order received', zone: 'office', date: order.orderDate,
      detail: `${order.buyer} · ${order.style} · ${formatQty(qty)} pcs · delivery ${order.due || 'not set'}` },
    { key: 'planning', icon: '🧠', title: 'Planning', zone: 'office',
      detail: production.length ? production.map((p) => `${p.no} (${p.status.replaceAll('_', ' ').toLowerCase()})`).join(', ') : 'No cutting PO or work order yet' },
    { key: 'material', icon: '🧵', title: 'Material', zone: 'store',
      detail: shortages.length ? `Short: ${shortages.map((s) => `${s.item} ${formatQty(s.short)} ${s.uom}`).join('; ')}`
        : `Material ${progress.material === 'none' ? 'not ordered yet' : progress.material}` },
    { key: 'purchase', icon: '📤', title: 'Purchase orders', zone: 'receiving',
      detail: pos.length ? pos.map((po) => `${po.no} · ${po.supplier} · ${po.status.replaceAll('_', ' ')}`).join('; ') : 'No supplier PO linked',
      extra: grns.length ? `Received: ${grns.map((g) => g.no).join(', ')}` : null },
    { key: 'cutting', icon: '✂️', title: 'Cutting', zone: 'cutting',
      detail: `${formatQty(cut)} of ${formatQty(qty)} cut${relaxing.length ? ` · fabric relaxing (${round(relaxing[0].remainingHours, 1)} h left)` : ''}` },
    { key: 'sewing', icon: '🪡', title: 'Sewing', zone: 'sewing',
      detail: lines.length ? `${lines.map((l) => `${l.name} ${formatQty(l.output)} today`).join(', ')} · ${formatQty(stage('sewing')?.qty)} sewn`
        : `${formatQty(stage('sewing')?.qty)} sewn` },
    { key: 'qc', icon: '🔍', title: 'Quality check', zone: 'qc',
      detail: qcLines.length ? qcLines.map((l) => `${l.name}: ${formatQty(l.qc.inspected)} inspected, DHU ${round(l.qc.dhuPct, 1)}%`).join('; ') : 'No end-line inspection today' },
    { key: 'finishing', icon: '🔥', title: 'Finishing', zone: 'finishing',
      detail: `${formatQty(sum(gi, (g) => g.received))} received from sewing${vendors.length ? ` · ${formatQty(sum(vendors, (v) => v.pending))} pcs at ${unique(vendors.map((v) => v.vendor)).join(', ')}` : ''}` },
    { key: 'packing', icon: '📦', title: 'Packing', zone: 'packing',
      detail: packing.length ? `${formatQty(sum(packing, (e) => e.cartons))} cartons · ${formatQty(sum(packing, (e) => e.pieces))} pcs` : 'Not packed yet' },
    { key: 'shipping', icon: '🚚', title: 'Shipping', zone: 'shipping',
      detail: `${order.destination || 'Destination not set'} · due ${order.due || 'not set'}${progress.daysToDue != null ? ` (${progress.daysToDue} days)` : ''}` },
  ].map((step) => ({
    ...step,
    state: stateOf(step.key, current, (step.key === 'material' && shortages.length > 0)
      || (step.key === 'sewing' && lines.some((l) => l.traffic === 'RED'))),
  }));

  return { order, progress, steps, lineIds: lines.map((l) => l.id), currentZone: STAGE_META[current]?.zone || 'office' };
};
