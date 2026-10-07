import { MAINTENANCE_SHARE } from '../simulation/scenarios.js';

/**
 * Simulation frames applied to the scene: `sim` is { scenario, capacities, result, frame, readyHour }.
 * The live floor's layout stays; what moves, what runs and how much waits follows the frame.
 */
const LOADING_SHARE = 0.8;

export const simLines = ({ scenario, capacities, frame }, snapshot) => {
  const running = Boolean(frame?.active.sewing);
  const live = new Map(snapshot.sewing.lines.map((l) => [l.id, l]));
  const chosen = capacities.lines.filter((l) => scenario.lineIds.includes(l.id) && l.id !== scenario.lineDown);
  const typical = capacities.lines.length ? capacities.lines.reduce((s, l) => s + l.perDay, 0) / capacities.lines.length : 600;
  const working = (l) => l.perDay * (l.id === scenario.maintenanceLine ? MAINTENANCE_SHARE : 1);
  const totalPerDay = chosen.reduce((s, l) => s + working(l), 0) + (scenario.addLine ? typical : 0);
  const shareOf = (perDay) => (totalPerDay > 0 ? perDay / totalPerDay : 0);
  const sewn = frame?.sewn || 0;
  const waiting = frame?.queues.sewing || 0;

  const urgent = scenario.urgentQty > 0 && Boolean(frame) && !frame.urgentShipped;
  const lines = capacities.lines.map((cap) => {
    const down = scenario.lineDown === cap.id;
    const active = scenario.lineIds.includes(cap.id) && !down;
    return {
      id: cap.id, name: cap.name, active, down, isNew: false, hasSheet: false, urgent: active && urgent,
      maintenance: active && scenario.maintenanceLine === cap.id,
      stations: live.get(cap.id)?.stations || [], operatorsPresent: active ? 20 : 0,
      simRunning: active && running, targetPerDay: cap.perDay, output: Math.round(sewn * (active ? shareOf(working(cap)) : 0)),
      efficiencyPct: null, traffic: null, style: scenario.orderNo ? live.get(cap.id)?.style || '' : '', orderNo: scenario.orderNo || '',
      queuedOrders: [], wip: active ? waiting * shareOf(working(cap)) : 0,
    };
  });
  if (scenario.addLine) {
    lines.push({
      id: 'sim-new-line', name: 'New line', active: true, down: false, isNew: true, hasSheet: false, stations: [],
      operatorsPresent: 20, simRunning: running, targetPerDay: Math.round(typical), output: Math.round(sewn * shareOf(typical)),
      efficiencyPct: null, traffic: null, style: '', orderNo: scenario.orderNo || '', queuedOrders: [], wip: waiting * shareOf(typical),
    });
  }
  return lines;
};

export const simCuttingActive = ({ frame }) => Boolean(frame?.active.cutting);

export const simOutput = ({ frame, result, capacities }) => {
  const shipped = Boolean(frame?.shipped);
  const packed = frame?.packed || 0;
  return {
    passed: Math.round(frame?.passed || 0),
    rework: Math.round(frame?.queues.rework || 0),
    active: frame?.active || {},
    fgCartons: Math.max(0, Math.floor((shipped ? 0 : packed) / capacities.pcsPerCarton)),
    loading: !shipped && packed >= result.total * LOADING_SHARE,
  };
};

/** The supplier truck: on the road until the fabric is due, at the dock for half a day after. */
export const simMaterialTrucks = ({ frame, readyHour }) => {
  if (!frame) return [];
  if (!frame.material) return [{ key: 'sim-fabric', kind: 'supplier', door: 0, state: 'transit', label: 'Fabric for this order', select: { type: 'zone', id: 'receiving' } }];
  return frame.h - readyHour < 4
    ? [{ key: 'sim-fabric', kind: 'supplier', door: 0, state: 'parked', label: 'Fabric arrived', select: { type: 'zone', id: 'receiving' } }]
    : [];
};
