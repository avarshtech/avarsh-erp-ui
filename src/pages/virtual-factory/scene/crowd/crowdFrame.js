import { Color, Matrix4 } from 'three';
import { BODY } from './bodyParts';
import { walkerAt } from './motion';
import { poseFor } from './poses';

/** Body parts drawn once per worker; limbs are drawn twice (left at index 2i, right at 2i + 1). */
export const SINGLE_PARTS = ['head', 'hairCap', 'bun', 'braid', 'torso', 'carry'];
export const PAIRED_PARTS = ['thigh', 'shin', 'upperArm', 'forearm'];

const ZERO = new Matrix4().makeScale(0, 0, 0);
const root = new Matrix4();
const pelvis = new Matrix4();
const torso = new Matrix4();
const head = new Matrix4();
const joint = new Matrix4();
const local = new Matrix4();
const turn = new Matrix4();
const limb = new Matrix4();

/** out = parent × T(x, y, z) × Rx(rx) × Rz(rz) × Ry(ry) */
const at = (out, parent, x, y, z, rx = 0, rz = 0, ry = 0) => {
  local.makeRotationX(rx);
  if (rz) local.multiply(turn.makeRotationZ(rz));
  if (ry) local.multiply(turn.makeRotationY(ry));
  local.setPosition(x, y, z);
  return out.multiplyMatrices(parent, local);
};

const arm = (meshes, i, side, sh, roll, el) => {
  const x = side * BODY.shoulderX;
  at(limb, torso, x, BODY.shoulderY, 0, sh, roll);
  meshes.upperArm.setMatrixAt(2 * i + (side > 0 ? 0 : 1), limb);
  at(joint, limb, 0, -BODY.upperArm, 0, el);
  meshes.forearm.setMatrixAt(2 * i + (side > 0 ? 0 : 1), joint);
};

const leg = (meshes, i, side, hip, knee) => {
  at(limb, pelvis, side * BODY.hipX, 0, 0, hip);
  meshes.thigh.setMatrixAt(2 * i + (side > 0 ? 0 : 1), limb);
  at(joint, limb, 0, -BODY.thigh, 0, knee);
  meshes.shin.setMatrixAt(2 * i + (side > 0 ? 0 : 1), joint);
};

/** Writes every worker's part matrices for time `t` into the instanced meshes. */
export const writeCrowdFrame = (meshes, workers, t) => {
  workers.forEach((w, i) => {
    const walk = w.path ? walkerAt(w, t) : null;
    const p = poseFor(w.activity, (t + w.phase) * w.tempo, walk?.moving, w.speed);
    root.makeRotationY(walk ? walk.heading : w.ry);
    root.setPosition(walk ? walk.x : w.x, w.y, walk ? walk.z : w.z);
    at(pelvis, root, 0, (p.seated ? BODY.seatedHipY : BODY.hipY) + p.bob, 0);
    at(torso, pelvis, 0, 0, 0, p.lean, 0, p.twist);
    at(head, torso, 0, BODY.neckY, 0, p.headPitch, 0, p.headYaw);
    meshes.torso.setMatrixAt(i, torso);
    meshes.head.setMatrixAt(i, head);
    meshes.hairCap.setMatrixAt(i, head);
    meshes.bun.setMatrixAt(i, w.hairStyle === 'bun' && !w.cap ? head : ZERO);
    meshes.braid.setMatrixAt(i, w.hairStyle === 'braid' ? head : ZERO);
    meshes.carry.setMatrixAt(i, p.carry ? torso : ZERO);
    arm(meshes, i, 1, p.lSh, p.lRoll, p.lEl);
    arm(meshes, i, -1, p.rSh, p.rRoll, p.rEl);
    leg(meshes, i, 1, p.lHip, p.lKnee);
    leg(meshes, i, -1, p.rHip, p.rKnee);
  });
  [...SINGLE_PARTS, ...PAIRED_PARTS].forEach((part) => { meshes[part].instanceMatrix.needsUpdate = true; });
};

const colour = new Color();
const COLOUR_OF = {
  head: (w) => w.skin, hairCap: (w) => w.cap || w.hair, bun: (w) => w.hair, braid: (w) => w.hair,
  torso: (w) => w.shirt, carry: (w) => w.carryColor || '#c49a6c',
  thigh: (w) => w.pants, shin: (w) => w.pants, upperArm: (w) => w.shirt, forearm: (w) => w.skin,
};

/** Paints each worker's skin, hair, uniform and trousers onto the instanced meshes. */
export const writeCrowdColours = (meshes, workers) => {
  workers.forEach((w, i) => {
    SINGLE_PARTS.forEach((part) => meshes[part].setColorAt(i, colour.set(COLOUR_OF[part](w))));
    PAIRED_PARTS.forEach((part) => {
      colour.set(COLOUR_OF[part](w));
      meshes[part].setColorAt(2 * i, colour);
      meshes[part].setColorAt(2 * i + 1, colour);
    });
  });
  [...SINGLE_PARTS, ...PAIRED_PARTS].forEach((part) => {
    const mesh = meshes[part];
    mesh.count = PAIRED_PARTS.includes(part) ? workers.length * 2 : workers.length;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });
};
