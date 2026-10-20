import { Color, Matrix4 } from 'three';
import { CONES_AT, LAMP_AT, TABLE_TOP_Y, machineKind } from '../geometry/machines';

export const STATUS_COLOURS = { RUNNING: '#22c55e', IDLE: '#f5b301', DOWN: '#ef4444', MAINTENANCE: '#3b82f6' };
export const HEAD_KINDS = ['lockstitch', 'overlock', 'kaja'];

const base = new Matrix4();
const offset = new Matrix4();
const out = new Matrix4();
const colour = new Color();
const HIDDEN = new Matrix4().makeScale(0, 0, 0);

const placeAt = (m, [x, y, z]) => out.multiplyMatrices(base.makeRotationY(m.ry).setPosition(m.x, 0, m.z), offset.makeTranslation(x, y, z));

/** Which instanced head mesh draws each machine, and its index there. */
export const groupByHead = (machines) => {
  const groups = Object.fromEntries(HEAD_KINDS.map((k) => [k, []]));
  machines.forEach((m, i) => groups[machineKind(m.type).geometry].push(i));
  return groups;
};

/** Writes everything that does not move: tables, heads, cones, lamps and their colours. */
export const writeMachines = (meshes, machines, groups) => {
  machines.forEach((m, i) => {
    base.makeRotationY(m.ry).setPosition(m.x, 0, m.z);
    meshes.top.setMatrixAt(i, base);
    meshes.stand.setMatrixAt(i, base);
    meshes.lamp.setMatrixAt(i, placeAt(m, LAMP_AT));
    meshes.lamp.setColorAt(i, colour.set(STATUS_COLOURS[m.status] || STATUS_COLOURS.IDLE));
    CONES_AT.forEach((c, k) => {
      meshes.cone.setMatrixAt(i * 2 + k, placeAt(m, c));
      meshes.cone.setColorAt(i * 2 + k, colour.set(m.thread || '#d0d4da'));
    });
    meshes.fabric.setColorAt(i, colour.set(m.thread || '#d0d4da'));
  });
  HEAD_KINDS.forEach((kind) => {
    const mesh = meshes[kind];
    groups[kind].forEach((machineIndex, j) => {
      const m = machines[machineIndex];
      mesh.setMatrixAt(j, placeAt(m, [-0.05, TABLE_TOP_Y, 0.02]));
      mesh.setColorAt(j, colour.set(machineKind(m.type).colour));
    });
    mesh.count = groups[kind].length;
  });
  ['top', 'stand', 'lamp', 'fabric'].forEach((k) => { meshes[k].count = machines.length; });
  meshes.cone.count = machines.length * 2;
  Object.values(meshes).forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
};

/**
 * The moving bits at time t: fabric sliding under running needles, blinking lamps on machines that
 * are down. With t null (a still frame, reduced motion) the fabric rests and every DOWN lamp is lit.
 */
export const animateMachines = (meshes, machines, t) => {
  const blinkOn = t == null || Math.sin(t * 9) > 0;
  machines.forEach((m, i) => {
    if (m.status === 'RUNNING') {
      const slide = t == null ? 0 : ((t * 0.09 + i * 0.37) % 0.3) - 0.15;
      meshes.fabric.setMatrixAt(i, placeAt(m, [-0.19 + slide, TABLE_TOP_Y + 0.05, 0.08]));
    } else {
      meshes.fabric.setMatrixAt(i, m.status === 'IDLE' ? placeAt(m, [0.3, TABLE_TOP_Y, 0.1]) : HIDDEN);
    }
    if (m.status === 'DOWN') meshes.lamp.setMatrixAt(i, blinkOn ? placeAt(m, LAMP_AT) : HIDDEN);
  });
  meshes.fabric.instanceMatrix.needsUpdate = true;
  meshes.lamp.instanceMatrix.needsUpdate = true;
};
