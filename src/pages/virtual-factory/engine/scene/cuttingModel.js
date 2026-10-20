import { fabricColour } from '../colours.js';
import { BUNDLING_TABLE, CUTTING_TABLE, CUTTING_TABLE_Z, RELAXATION_RACKS } from '../layout.js';
import { clamp, formatQty, round } from '../util.js';
import { makeWorker } from './appearance.js';

const STAGING_ROWS = [4.5, 8, 11.5];
const STAGING_SLOTS = 22;

/** The tables to draw: the cutting-table master, or three illustrative tables when it is empty. */
const tablesFor = (cutting, reason) => {
  if (cutting.tables.length) return cutting.tables.slice(0, CUTTING_TABLE_Z.length);
  return [1, 2, 3].map((n) => ({
    id: `table-${n}`, name: `Table ${n}`, illustrative: true, reason,
    stage: n === 1 && cutting.output > 0 ? 'cutting' : 'idle', hex: fabricColour(cutting.progress[0]?.colour), plies: 40, layLength: 12,
    style: n === 1 ? cutting.progress[0]?.style || '' : '', orderNo: n === 1 ? cutting.progress[0]?.orderNo || '' : '',
  }));
};

const crew = (table, z, len) => {
  const x0 = CUTTING_TABLE.x0 + 0.6;
  const x1 = CUTTING_TABLE.x0 + len - 0.6;
  const select = { type: 'cuttingTable', id: table.id };
  if (table.stage === 'spreading') {
    return [
      makeWorker(`spr1-${table.id}`, 'cutting', 'spread', [x0, 0, z - 1.35], { path: [[x0, z - 1.35], [x1, z - 1.35]], speed: 0.55, select }),
      makeWorker(`spr2-${table.id}`, 'cutting', 'spread', [x0, 0, z + 1.35, Math.PI], { path: [[x0, z + 1.35], [x1, z + 1.35]], speed: 0.55, select }),
    ];
  }
  if (table.stage === 'cutting') {
    return [
      makeWorker(`cut-${table.id}`, 'cutting', 'cut', [x0, 0, z + 1.3, Math.PI], { path: [[x0, z + 1.3], [x1, z + 1.3]], speed: 0.25, select }),
      makeWorker(`bun-${table.id}`, 'cutting', 'bundle', [CUTTING_TABLE.x1 + 1.1, 0, z, -Math.PI / 2], { select }),
    ];
  }
  if (table.stage === 'ready' || table.stage === 'bundling') {
    return [makeWorker(`rdy-${table.id}`, 'cutting', table.stage === 'bundling' ? 'bundle' : 'stand', [CUTTING_TABLE.x1 + 1.1, 0, z, -Math.PI / 2], { select })];
  }
  return [];
};

/** Cutting room, relaxation racks and the cut-part supermarket. */
export const buildCuttingModel = (cutting, { cutPoColour, simActive, reason }) => {
  const out = { tables: [], rolls: [], bundles: [], workers: [], boards: [] };
  tablesFor(cutting, reason).forEach((source, slot) => {
    const z = CUTTING_TABLE_Z[slot];
    let stage = source.stage;
    if (simActive != null) stage = simActive ? (slot < 2 ? 'cutting' : 'spreading') : 'idle';
    // The drawing needs a lay of some height and length; the inspector shows only the real figures.
    const table = {
      ...source, stage, slot, z,
      realPlies: source.illustrative ? null : source.plies || null,
      realLength: source.illustrative ? null : source.layLength || null,
      plies: clamp(source.plies || 40, 6, 120),
      length: clamp(source.layLength || 12, 5, CUTTING_TABLE.x1 - CUTTING_TABLE.x0 - 1),
    };
    out.tables.push(table);
    out.workers.push(...crew(table, z, table.length));
    if (stage !== 'idle') {
      for (let r = 0; r < 3; r += 1) out.rolls.push({ x: CUTTING_TABLE.x0 - 1.2, y: 0.18 + r * 0.36, z: z - 0.5 + (r % 2) * 0.2, axis: 'z', len: 1.6, r: 0.17, color: table.hex });
    }
    out.boards.push({
      key: `ct-${table.id}`, x: CUTTING_TABLE.x0 - 0.4, y: 1.9, z: z - 1.2, small: true, title: table.name,
      subtitle: table.style ? `${table.style}${table.orderNo ? ` · ${table.orderNo}` : ''}` : 'Free',
      rows: stage === 'idle' ? [] : [['Stage', stage[0].toUpperCase() + stage.slice(1)], ['Plies', String(table.plies)]],
      tone: stage === 'idle' ? 'idle' : 'green', select: { type: 'cuttingTable', id: table.id },
    });
  });

  cutting.relaxing.slice(0, 6).forEach((relax, i) => {
    const z = RELAXATION_RACKS.z0 + 1.5 + i * 4;
    const color = fabricColour(cutPoColour(relax.cutPoNo));
    for (let r = 0; r < 4; r += 1) out.rolls.push({ x: RELAXATION_RACKS.x, y: 0.45 + Math.floor(r / 2) * 0.9, z: z - 0.5 + (r % 2), axis: 'x', len: 1.6, r: 0.17, color });
    out.boards.push({
      key: `rx-${relax.no}`, x: RELAXATION_RACKS.x + 1.2, y: 2.4, z, small: true, title: relax.cutPoNo,
      subtitle: `${relax.fabricType || 'Fabric'} relaxing`, rows: [['Ready in', `${round(relax.remainingHours, 1)} h`]],
      tone: relax.remainingHours > 0 ? 'amber' : 'green', select: { type: 'zone', id: 'cutting' },
    });
  });

  const bundled = simActive != null ? (simActive ? 30 : 6) : cutting.bundled;
  const onTable = Math.min(14, bundled);
  for (let b = 0; b < onTable; b += 1) out.bundles.push({ x: BUNDLING_TABLE.x0 + 0.8 + b * 1.25, y: 0.86, z: BUNDLING_TABLE.z, color: fabricColour(cutting.progress[b % Math.max(1, cutting.progress.length)]?.colour) });
  const shelved = Math.min(STAGING_ROWS.length * STAGING_SLOTS * 2, Math.max(0, bundled - onTable));
  for (let b = 0; b < shelved; b += 1) {
    const row = Math.floor(b / (STAGING_SLOTS * 2)) % STAGING_ROWS.length;
    const level = Math.floor(b / STAGING_SLOTS) % 2;
    out.bundles.push({ x: -33 + (b % STAGING_SLOTS) * 1.1, y: 0.5 + level * 0.8, z: STAGING_ROWS[row], color: fabricColour(cutting.progress[b % Math.max(1, cutting.progress.length)]?.colour) });
  }
  if (bundled > 0) out.workers.push(makeWorker('staging-1', 'cutting', 'carry', [-30, 0, 6.3], { path: [[-32, 6.3], [-10, 6.3], [-10, 9.8], [-32, 9.8]], speed: 0.8, select: { type: 'zone', id: 'staging' } }));
  out.summary = { bundled, label: `${formatQty(bundled)} bundles ready` };
  return out;
};
