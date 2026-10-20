import { fabricColour } from '../colours.js';
import { SEWING_LINE_X0, SEWING_LINE_Z, STATION_PITCH, STATIONS_PER_SIDE, stationSlot } from '../layout.js';
import { formatQty, round } from '../util.js';
import { makeWorker } from './appearance.js';

const MAX_STATIONS = STATIONS_PER_SIDE * 2;
const IDLE_PATTERN = ['SNLS', 'OVERLOCK', 'SNLS', 'SNLS', 'FLATLOCK', 'OVERLOCK', 'SNLS', 'BARTACK', 'SNLS', 'SNLS', 'OVERLOCK', 'SNLS'];
const BUNDLE_PCS = 25;
const lineEndX = SEWING_LINE_X0 + (STATIONS_PER_SIDE - 1) * STATION_PITCH;

const boardTone = (line) => {
  if (line.down) return 'down';
  if (line.maintenance) return 'maintenance';
  if (line.isNew) return 'new';
  if (!line.active) return 'idle';
  if (line.bottleneck || line.traffic === 'RED') return 'red';
  return line.traffic === 'YELLOW' ? 'amber' : 'green';
};

const boardRows = (line) => {
  if (line.down) return [['Status', 'Unavailable'], ['Plan', line.style || '—']];
  if (line.maintenance) return [['Status', 'Planned maintenance'], ['Running', 'Half the machines']];
  if (line.illustrative) return [['Status', line.reason?.status || 'Not set up'], ['Shown as', 'A typical line']];
  if (!line.active) return [['Status', 'No plan running'], ['Next', line.queuedOrders?.[0] || '—']];
  return [
    ['Target', formatQty(line.targetPerDay)],
    ['Output', formatQty(line.output)],
    ['Efficiency', line.efficiencyPct == null ? '—' : `${round(line.efficiencyPct)}%`],
  ];
};

/** Stations of one line: the plan's operations, or a typical idle line when no plan runs. */
const stationsOf = (line, z) => {
  const ops = line.stations?.length ? line.stations.slice(0, MAX_STATIONS)
    : IDLE_PATTERN.map((machine, i) => ({ seq: i + 1, operation: 'Not planned', machine, status: 'IDLE', operator: null, bottleneck: false }));
  return ops.map((op, i) => {
    const slot = stationSlot(z, i);
    let status = op.status || 'IDLE';
    if (line.down) status = 'DOWN';
    else if (line.maintenance && i % 2 === 1) status = 'MAINTENANCE';
    else if (line.simRunning != null) status = line.simRunning ? 'RUNNING' : 'IDLE';
    return { ...op, index: i, x: slot.x, z: slot.z, side: slot.side, status };
  });
};

/**
 * Sewing lines on the floor: one slot per production line (up to eight), each with its machines,
 * seated operators, a helper, a supervisor, bundles waiting on the centre table and a line board.
 */
export const buildSewingModel = (lines, { bottlenecks, orderColour }) => {
  const out = { lines: [], machines: [], chairs: [], workers: [], bundles: [], garments: [], boards: [] };
  lines.slice(0, SEWING_LINE_Z.length).forEach((source, slot) => {
    const z = SEWING_LINE_Z[slot];
    const bottleneck = bottlenecks?.get(source.id) || null;
    const line = { ...source, slot, z, bottleneck };
    const stations = stationsOf(line, z);
    const thread = fabricColour(orderColour(line.orderNo));
    out.lines.push({ ...line, stations, tone: boardTone(line) });

    stations.forEach((st) => {
      const select = { type: 'station', id: `${line.id}:${st.index}` };
      out.machines.push({ key: `m-${line.id}-${st.index}`, x: st.x, z: st.z, ry: st.side < 0 ? Math.PI : 0, type: st.machine, status: st.status, thread, select });
      out.chairs.push({ x: st.x, z: z + st.side * 1.95, ry: st.side < 0 ? 0 : Math.PI });
    });

    const seated = line.down ? [] : stations.filter((st, i) => (st.operator ? st.status !== 'DOWN'
      : line.active && !line.hasSheet && i < Math.max(line.operatorsPresent || 0, 0)));
    seated.forEach((st) => out.workers.push(makeWorker(`op-${line.id}-${st.index}`, 'sewing',
      st.status === 'RUNNING' ? 'sew' : 'sew-idle', [st.x, 0, z + st.side * 1.85, st.side < 0 ? 0 : Math.PI],
      { name: st.operator?.name || null, station: st.operation, select: { type: 'station', id: `${line.id}:${st.index}` } })));

    if (line.active && !line.down) {
      out.workers.push(makeWorker(`sup-${line.id}`, 'supervisor', 'supervise', [-2.6, 0, z + 2.6, Math.PI * 0.75],
        { select: { type: 'line', id: line.id } }));
      out.workers.push(makeWorker(`help-${line.id}`, 'helper', 'carry', [SEWING_LINE_X0, 0, z],
        { path: [[-1.2, z + 0.6], [lineEndX + 0.6, z + 0.6]], speed: 0.9, select: { type: 'line', id: line.id } }));
    }

    const wipBundles = Math.min(12, Math.ceil((line.wip || 0) / BUNDLE_PCS));
    for (let b = 0; b < wipBundles; b += 1) {
      out.bundles.push({ x: SEWING_LINE_X0 + 0.4 + (b % 6) * 2.4, y: 0.82 + Math.floor(b / 6) * 0.13, z, color: thread });
    }
    if (bottleneck) {
      for (let b = 0; b < 9; b += 1) out.bundles.push({ x: -1.4 + (b % 3) * 0.42, y: 0.08 + Math.floor(b / 3) * 0.13, z: z - 0.5, color: thread });
    }
    const outputRows = Math.min(8, Math.ceil((line.output || 0) / 60));
    for (let g = 0; g < outputRows; g += 1) out.garments.push({ x: lineEndX + 1.6, y: 0.75 + g * 0.05, z, ry: Math.PI / 2, color: thread, pose: 'stack' });

    out.boards.push({
      key: `board-${line.id}`, x: -1.2, y: 2.3, z: z - 1.7, title: line.name,
      subtitle: line.illustrative ? line.reason?.note : line.active ? `${line.style || ''}${line.orderNo ? ` · ${line.orderNo}` : ''}` : (line.isNew ? 'New line' : ''),
      rows: boardRows(line), tone: line.tone || boardTone(line), select: { type: 'line', id: line.id },
      badge: bottleneck ? 'BOTTLENECK' : line.urgent ? 'URGENT ORDER' : null,
    });
  });
  return out;
};
