import { PORTS, routeBetween, SEWING_LINE_Z, zoneCentre } from '../layout.js';
import { buildCuttingModel } from './cuttingModel.js';
import { buildMaterialModel } from './materialModel.js';
import { buildOutputModel } from './outputModel.js';
import { buildSewingModel } from './sewingModel.js';
import { simCuttingActive, simLines, simMaterialTrucks, simOutput } from './simOverlay.js';
import { zoneStatuses } from './zoneStatus.js';

const BEACON_HEIGHT = 11.5;

/** Why the floor shows typical lines or tables instead of the master's: the master's own source state. */
export const placeholderReason = (state) => {
  if (state === 'locked') return { status: 'No access', note: 'You cannot open Production masters' };
  if (state === 'error') return { status: 'Not loaded', note: 'Production masters could not be read' };
  return { status: 'Not set up', note: 'Set up in Production masters' };
};

/** Shown when no production lines can be read, so the floor still reads as a sewing floor; marked as such. */
const illustrativeLines = (reason) => [1, 2, 3, 4].map((n) => ({
  id: `illustrative-${n}`, name: `Line ${n}`, active: false, illustrative: true, reason, stations: [], queuedOrders: [], wip: 0, output: 0,
}));

/** One beacon per zone with something high or medium to say; bottlenecks sit over their own line. */
const beaconsFor = (attention, sewingLines) => {
  const lineZ = new Map(sewingLines.map((l) => [l.id, l.z]));
  const seen = new Set();
  return attention.filter((a) => a.severity === 'high').flatMap((a) => {
    const onLine = a.kind === 'bottleneck' && lineZ.has(a.target.id);
    const key = onLine ? `line-${a.target.id}` : a.zone;
    if (seen.has(key)) return [];
    seen.add(key);
    const [x, , z] = onLine ? [-1.2, 0, lineZ.get(a.target.id)] : zoneCentre(a.zone);
    const count = attention.filter((b) => b.zone === a.zone && b.severity === 'high').length;
    return [{ key, x, y: onLine ? 4.6 : BEACON_HEIGHT, z, severity: a.severity, title: a.title, text: a.detail, count, target: a.target }];
  });
};

/** The stitched route an order takes through the floor, port to port, and where it is now. */
const routeFor = (journey, sewingLines) => {
  const line = sewingLines.find((l) => journey.lineIds.includes(l.id)) || sewingLines[0];
  const lineZ = line ? line.z : SEWING_LINE_Z[0];
  const stops = [
    ['office', PORTS.office], ['receiving', PORTS.dock], ['store', PORTS.store], ['cutting', PORTS.cuttingTable(0)],
    ['staging', PORTS.staging], ['sewing', PORTS.lineHead(lineZ)], ['qc', PORTS.qc], ['finishing', PORTS.finishingIn],
    ['packing', PORTS.packing], ['fg', PORTS.fg], ['shipping', PORTS.shipping],
  ];
  const points = [stops[0][1]];
  const stopIndex = { [stops[0][0]]: 0 };
  for (let i = 1; i < stops.length; i += 1) {
    points.push(...routeBetween(stops[i - 1][1], stops[i][1]).slice(1));
    stopIndex[stops[i][0]] = points.length - 1;
  }
  return { points, reached: stopIndex[journey.currentZone] ?? 0, zone: journey.currentZone };
};

/**
 * Everything the 3D scene draws, as plain data: who stands where doing what, which machines run,
 * how much material sits where, which trucks are at the docks, the signs, the beacons and, when an
 * order is followed, its route. In simulation the simulated frame replaces the live activity.
 */
export const buildSceneModel = ({ snapshot, insights, sim, journey }) => {
  const colourOf = (orderNo) => snapshot.orders.find((o) => o.no === orderNo)?.colours[0] || '';
  const cutPoColour = (no) => snapshot.cutPos.find((c) => c.no === no)?.colour || '';
  const lead = snapshot.orders.find((o) => o.status === 'IN_PRODUCTION')?.colours[0] || snapshot.cutting.progress[0]?.colour || 'Navy';

  const liveLines = snapshot.sewing.lines.length ? snapshot.sewing.lines
    : illustrativeLines(placeholderReason(snapshot.sources.productionLines?.state));
  const sewing = buildSewingModel(sim ? simLines(sim, snapshot) : liveLines, {
    bottlenecks: sim ? null : insights.bottlenecks, orderColour: (no) => (sim ? lead : colourOf(no)),
  });
  const cutting = buildCuttingModel(snapshot.cutting, {
    cutPoColour, simActive: sim ? simCuttingActive(sim) : null, reason: placeholderReason(snapshot.sources.cuttingTables?.state),
  });
  const material = buildMaterialModel(snapshot);
  if (sim) material.trucks = [...material.trucks.filter((t) => t.state !== 'transit' && t.kind !== 'supplier'), ...simMaterialTrucks(sim)];
  const output = buildOutputModel(snapshot, { leadColour: lead, sim: sim ? simOutput(sim) : null });
  const attention = sim ? [] : insights.attention;

  return {
    workers: [...material.workers, ...cutting.workers, ...sewing.workers, ...output.workers],
    machines: [...sewing.machines, ...output.machines],
    chairs: sewing.chairs,
    rolls: [...material.rolls, ...cutting.rolls],
    bundles: [...cutting.bundles, ...sewing.bundles],
    garments: [...sewing.garments, ...output.garments],
    cartons: [...material.cartons, ...output.cartons],
    pallets: [...material.pallets, ...output.pallets],
    trucks: [...material.trucks, ...output.trucks],
    boards: [...material.boards, ...cutting.boards, ...sewing.boards, ...output.boards],
    steam: output.steam,
    sewingLines: sewing.lines,
    cuttingTables: cutting.tables,
    inspecting: material.inspecting,
    zones: zoneStatuses(snapshot, attention),
    beacons: beaconsFor(attention, sewing.lines),
    route: journey ? routeFor(journey, sewing.lines) : null,
  };
};
