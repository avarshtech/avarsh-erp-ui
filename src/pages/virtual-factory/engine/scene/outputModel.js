import { fabricColour } from '../colours.js';
import { FG_RACK_SPAN, FG_RACK_X, IRONING_X, IRONING_Z, PACKING_STATIONS, QC_TABLES, SHIPPING_DOORS } from '../layout.js';
import { formatQty } from '../util.js';
import { makeWorker } from './appearance.js';

const FG_BAYS = 6;
const FG_LEVELS = [0.15, 1.45, 2.75];
const FG_PER_PALLET = 8;

const qcModel = (out, { inspected, passed, rework, colour, active }) => {
  QC_TABLES.forEach(([x, z], t) => {
    [-0.8, 0.8].forEach((dx, i) => {
      if (active || t < 1) out.workers.push(makeWorker(`qc-${t}-${i}`, 'qc', active ? 'inspect' : 'stand', [x + dx, 0, z + 1.05, Math.PI], { select: { type: 'zone', id: 'qc' } }));
    });
    for (let g = 0; g < (active ? 3 : 1); g += 1) out.garments.push({ x: x - 1 + g, y: 0.86, z, ry: 0, color: colour, pose: 'flat' });
  });
  const passPile = Math.min(10, Math.ceil(passed / 80));
  for (let g = 0; g < passPile; g += 1) out.garments.push({ x: 28.7, y: 0.42 + g * 0.045, z: -18.6, ry: 0.2, color: colour, pose: 'stack' });
  const reworkPile = Math.min(8, Math.ceil(rework / 6));
  for (let g = 0; g < reworkPile; g += 1) out.garments.push({ x: 36.4, y: 0.42 + g * 0.05, z: -18.6, ry: -0.3, color: colour, pose: 'stack' });
  out.qc = { inspected, passed, rework };
};

const finishingModel = (out, finishing, colour, active) => {
  const s = finishing.stations;
  const on = (qty) => active ?? qty > 0;
  const station = (key, dept, activity, pos, live) => {
    if (live) out.workers.push(makeWorker(key, dept, activity, pos, { select: { type: 'zone', id: 'finishing' } }));
  };
  [[25, -9], [25, -4.5]].forEach(([x, z], t) => [-0.9, 0.9].forEach((dx, i) => station(`trim-${t}-${i}`, 'finishing', 'trim', [x + dx, 0, z + 0.95, Math.PI], on(s.trimmed))));
  [31.5, 33.1, 34.7, 36.3].forEach((x, i) => {
    out.machines.push({ key: `kaja-${i}`, x, z: -8.6, ry: 0, type: 'KAJA', status: on(s.kaja) ? 'RUNNING' : 'IDLE', thread: colour, select: { type: 'zone', id: 'finishing' } });
    station(`kaja-op-${i}`, 'finishing', on(s.kaja) ? 'sew' : 'sew-idle', [x, 0, -7.7, Math.PI], on(s.kaja));
  });
  IRONING_Z.forEach((z, row) => IRONING_X.forEach((x, i) => {
    const live = on(s.ironed) && (row === 0 || i % 2 === 0);
    station(`iron-${row}-${i}`, 'finishing', 'iron', [x, 0, z + 0.85, Math.PI], live);
    if (live) out.steam.push({ x: x - 0.1, y: 0.95, z });
  }));
  [[26, 14], [34, 14]].forEach(([x, z], t) => [-0.8, 0.8].forEach((dx, i) => station(`chk-${t}-${i}`, 'qc', 'inspect', [x + dx, 0, z + 0.95, Math.PI], on(s.checked))));
  [[-0.7, 'tag'], [0.7, 'tag']].forEach(([dx, act], i) => station(`tag-${i}`, 'finishing', act, [26 + dx, 0, 21.45, Math.PI], on(s.ironed)));
  [[34, 20.5], [34, 26]].forEach(([x, z], t) => [-0.7, 0.7].forEach((dx, i) => station(`fold-${t}-${i}`, 'finishing', 'fold', [x + dx, 0, z + 0.95, Math.PI], on(s.checked))));
  const carts = Math.min(6, Math.ceil(finishing.fromSewing.pending / 150));
  for (let c = 0; c < carts; c += 1) for (let g = 0; g < 4; g += 1) out.garments.push({ x: 24 + c * 2.2, y: 0.75 + g * 0.06, z: 31, ry: 0, color: colour, pose: 'stack' });
  if (finishing.atVendors.length) {
    const v = finishing.atVendors[0];
    out.trucks.push({ key: `van-${v.no}`, kind: 'van', state: 'parked-van', label: `${formatQty(v.pending)} pcs at ${v.vendor}`, select: { type: 'zone', id: 'finishing' } });
  }
};

const packingModel = (out, packing, simActive) => {
  const busy = simActive ?? (packing.open.length > 0 || packing.today.pieces > 0);
  const stations = busy ? Math.min(PACKING_STATIONS.length, 2 + packing.open.length * 2) : 0;
  PACKING_STATIONS.forEach(([x, z], i) => {
    const live = i < stations;
    if (live) {
      out.workers.push(makeWorker(`pack-${i}`, 'packing', i % 2 ? 'fold' : 'pack', [x, 0, z + 1, Math.PI], { select: { type: 'zone', id: 'packing' } }));
      out.cartons.push({ x: x + 0.7, y: 0.98, z, w: 0.6, h: 0.4, d: 0.4, open: true });
      out.garments.push({ x: x - 0.5, y: 0.86, z, ry: 0, color: '#d7dce3', pose: 'flat' });
    }
  });
  const sealed = Math.min(36, simActive != null ? (simActive ? 24 : 4) : packing.today.cartons);
  for (let c = 0; c < sealed; c += 1) out.cartons.push({ x: 54 + (c % 3) * 0.62, y: 0.38 + Math.floor((c % 9) / 3) * 0.42, z: -14.5 + Math.floor(c / 9) * 1.4, w: 0.6, h: 0.4, d: 0.4 });
  if (sealed) out.workers.push(makeWorker('seal-1', 'packing', 'pack', [50.6, 0, -13.2, Math.PI / 2], { select: { type: 'zone', id: 'packing' } }));
};

const fgModel = (out, fg, cartonsOverride) => {
  const total = cartonsOverride ?? fg.cartons;
  const capacity = FG_RACK_X.length * FG_BAYS * FG_LEVELS.length * FG_PER_PALLET;
  let left = Math.min(capacity, total);
  FG_RACK_X.forEach((x) => FG_LEVELS.forEach((y) => {
    for (let bay = 0; bay < FG_BAYS && left > 0; bay += 1) {
      const z = FG_RACK_SPAN[0] + 1.3 + bay * 2.6;
      out.pallets.push({ key: `fg-${x}-${y}-${bay}`, x, y, z, rolls: 0, select: { type: 'zone', id: 'fg' } });
      for (let c = 0; c < FG_PER_PALLET && left > 0; c += 1, left -= 1) {
        out.cartons.push({ x: x - 0.32 + (c % 2) * 0.64, y: y + 0.36 + Math.floor(c / 4) * 0.42, z: z - 0.32 + (Math.floor(c / 2) % 2) * 0.64, w: 0.6, h: 0.4, d: 0.6 });
      }
    }
  }));
  out.workers.push(makeWorker('fg-forklift', 'store', 'drive', [47, 0, 0], { path: [[47, -2], [47, 18], [52, 18], [52, -2], [56.5, -10]], speed: 1.6, vehicle: 'forklift', select: { type: 'zone', id: 'fg' } }));
  fg.byDestination.slice(0, FG_RACK_X.length).forEach((group, i) => out.boards.push({
    key: `fg-dest-${i}`, x: FG_RACK_X[i], y: 4.3, z: FG_RACK_SPAN[1] + 0.6, small: true, title: group.destination,
    subtitle: `${formatQty(group.cartons)} cartons`, rows: [], tone: 'neutral', select: { type: 'zone', id: 'fg' },
  }));
};

const shippingModel = (out, shipping, simLoading) => {
  const loading = simLoading != null
    ? (simLoading ? [{ no: 'SIM', destination: 'Customer', buyer: 'Simulated order' }] : [])
    : shipping.shipments.filter((s) => s.phase === 'loading');
  loading.slice(0, SHIPPING_DOORS.length).forEach((s, i) => {
    out.trucks.push({ key: `out-${s.no}`, kind: 'dispatch', door: i, state: 'parked', label: `→ ${s.destination}`, sub: [s.buyer, shipping.demo && 'Demo data'].filter(Boolean).join(' · '), select: { type: 'shipment', id: s.no } });
    for (let c = 0; c < 18; c += 1) out.cartons.push({ x: 47 + (c % 6) * 0.7, y: 0.38 + Math.floor(c / 6) * 0.42, z: SHIPPING_DOORS[i] - 1.6, w: 0.6, h: 0.4, d: 0.6 });
    out.workers.push(makeWorker(`load-${i}`, 'shipping', 'carry', [50, 0, SHIPPING_DOORS[i]], { path: [[48, SHIPPING_DOORS[i] - 0.4], [59.4, SHIPPING_DOORS[i] - 0.4]], speed: 0.9, select: { type: 'shipment', id: s.no } }));
  });
  out.workers.push(makeWorker('dispatch-1', 'shipping', 'supervise', [45, 0, 34.5, Math.PI], { select: { type: 'zone', id: 'shipping' } }));
};

/** QC, finishing, packing, finished goods and shipping. `sim` overrides the live activity in simulation. */
export const buildOutputModel = (snapshot, { leadColour, sim }) => {
  const out = { workers: [], machines: [], garments: [], cartons: [], pallets: [], trucks: [], boards: [], steam: [] };
  const colour = fabricColour(leadColour);
  const qc = snapshot.qc;
  qcModel(out, {
    inspected: sim ? sim.passed : qc.inspected, passed: sim ? sim.passed : qc.inspected - qc.defects,
    rework: sim ? sim.rework : qc.rework, colour, active: sim ? sim.active.qc : qc.inspected > 0 || snapshot.sewing.lines.some((l) => l.active),
  });
  finishingModel(out, snapshot.finishing, colour, sim ? sim.active.finishing : undefined);
  packingModel(out, snapshot.packing, sim ? sim.active.packing : undefined);
  fgModel(out, snapshot.fg, sim ? sim.fgCartons : undefined);
  shippingModel(out, snapshot.shipping, sim ? sim.loading : undefined);
  return out;
};
