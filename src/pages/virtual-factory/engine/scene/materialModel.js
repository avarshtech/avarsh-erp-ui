import { dayDiff, formatQty } from '../util.js';
import { RECEIVING_DOORS, STORE_RACK_SPANS, STORE_RACK_X } from '../layout.js';
import { makeWorker } from './appearance.js';

const ROLL_PITCH = 0.42;
const RACK_LEVELS = [0.42, 1.32, 2.22];
const MAX_STORE_ROLLS = 360;
const TRIM_ROWS = [21.5, 25.5, 29.5, 33.5];

/** Rack slots in the fabric store, filled lot by lot so colours cluster like a real store. */
const storeSlots = () => {
  const slots = [];
  STORE_RACK_X.forEach((x) => STORE_RACK_SPANS.forEach(([z0, z1]) => RACK_LEVELS.forEach((y) => {
    for (let z = z0 + 0.3; z <= z1 - 0.3; z += ROLL_PITCH) slots.push({ x, y, z });
  })));
  return slots;
};
const SLOTS = storeSlots();

const storeRolls = (lots) => {
  const rolls = [];
  const total = lots.reduce((s, lot) => s + Math.max(1, lot.rolls || Math.ceil(lot.qty / 120)), 0);
  const scale = total > MAX_STORE_ROLLS ? MAX_STORE_ROLLS / total : 1;
  lots.forEach((lot) => {
    const count = Math.max(1, Math.round(Math.max(1, lot.rolls || Math.ceil(lot.qty / 120)) * scale));
    for (let i = 0; i < count && rolls.length < SLOTS.length; i += 1) {
      const slot = SLOTS[rolls.length];
      rolls.push({ ...slot, axis: 'x', len: 1.5, r: 0.17, color: lot.hex, select: { type: 'lot', id: lot.key } });
    }
  });
  return rolls;
};

/** Receiving dock, fabric store, trims store and the order office. */
export const buildMaterialModel = (snapshot) => {
  const out = { rolls: [], cartons: [], workers: [], trucks: [], pallets: [], boards: [], inspecting: false };
  const today = snapshot.today;

  const arrived = snapshot.grns.filter((g) => g.date === today).slice(0, RECEIVING_DOORS.length);
  arrived.forEach((grn, i) => out.trucks.push({
    key: `in-${grn.no}`, kind: 'supplier', door: i, state: 'parked', label: grn.supplier, plate: grn.vehicle,
    select: { type: 'grn', id: grn.no },
  }));
  const coming = snapshot.purchaseOrders.filter((po) => po.stage === 'sent' && po.due && dayDiff(today, po.due) <= 2).slice(0, 2);
  coming.forEach((po, i) => out.trucks.push({
    key: `transit-${po.no}`, kind: 'supplier', door: i, state: 'transit', label: po.supplier, select: { type: 'po', id: po.no },
  }));

  const waitingQc = snapshot.grns.filter((g) => g.status === 'QC_Pending' || g.status === 'Draft').slice(0, 6);
  waitingQc.forEach((grn, i) => out.pallets.push({ key: `p-${grn.no}`, x: -55 + (i % 3) * 3.2, z: -33 + Math.floor(i / 3) * 4, rolls: 6, tag: 'QC', select: { type: 'grn', id: grn.no } }));
  out.inspecting = snapshot.fabricQc.some((q) => /draft|pending/i.test(q.status));
  out.workers.push(makeWorker('fqc-1', 'qc', out.inspecting ? 'inspect' : 'stand', [-46.5, 0, -18.2, Math.PI], { select: { type: 'zone', id: 'receiving' } }));
  if (arrived.length) {
    out.workers.push(makeWorker('unload-1', 'store', 'carry', [-58, 0, -30], { path: [[-58.5, -31], [-53, -31], [-53, -26]], speed: 0.9, select: { type: 'zone', id: 'receiving' } }));
    out.workers.push(makeWorker('unload-2', 'store', 'carry', [-58, 0, -22], { path: [[-58.5, -22], [-50, -22], [-50, -27]], speed: 0.85, select: { type: 'zone', id: 'receiving' } }));
  }

  out.rolls.push(...storeRolls(snapshot.fabricStock));
  out.workers.push(makeWorker('store-1', 'store', 'walk', [-50.2, 0, -8], { path: [[-50.2, -12], [-50.2, 18]], speed: 0.7, select: { type: 'zone', id: 'store' } }));
  out.workers.push(makeWorker('store-2', 'store', 'carry', [-45.7, 0, 10], { path: [[-45.7, 18], [-45.7, 4], [-39, 4]], speed: 0.8, select: { type: 'zone', id: 'store' } }));

  const trimBoxes = Math.min(TRIM_ROWS.length * 2 * 20, snapshot.trimStock.length * 5);
  for (let i = 0; i < trimBoxes; i += 1) {
    const row = Math.floor(i / 40) % TRIM_ROWS.length;
    const level = Math.floor(i / 20) % 2;
    out.cartons.push({ x: -33.5 + (i % 20) * 1.25, y: 0.42 + level * 0.9, z: TRIM_ROWS[row], w: 0.9, h: 0.5, d: 0.6, select: { type: 'zone', id: 'trims' } });
  }
  out.workers.push(makeWorker('trims-1', 'store', 'stand', [-8.2, 0, 31, -Math.PI / 2], { select: { type: 'zone', id: 'trims' } }));

  [[-56, 27], [-51, 27], [-46, 27], [-56, 32]].forEach(([x, z], i) => out.workers.push(makeWorker(`office-${i}`, 'office', 'office', [x, 0, z + 0.75, Math.PI], { select: { type: 'zone', id: 'office' } })));
  const open = snapshot.orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'IN_PRODUCTION');
  const awaiting = snapshot.purchaseOrders.filter((po) => po.stage === 'approval').length;
  out.boards.push({
    key: 'order-board', x: -50, y: 3.1, z: 22.6, wide: true, title: 'Orders in work',
    subtitle: `${formatQty(open.length)} open orders · ${awaiting} POs awaiting approval`,
    rows: open.slice(0, 4).map((o) => [o.no, `${formatQty(o.qty)} pcs · due ${o.due || '—'}`]),
    tone: 'neutral', select: { type: 'zone', id: 'office' },
  });
  return out;
};
