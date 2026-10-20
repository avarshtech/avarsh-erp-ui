import { capsule, merge, place, sphere, tint, box } from '../geometry/merge';
import { SphereGeometry } from 'three';

/**
 * A low-poly worker, 1.7 m tall, built from parts whose origin sits at their joint so a pose is a
 * handful of joint angles. The figure faces +z; its right side is −x.
 */
export const BODY = {
  hipY: 0.92,
  seatedHipY: 0.6,
  hipX: 0.09,
  thigh: 0.43,
  shin: 0.43,
  shoulderX: 0.2,
  shoulderY: 0.48,
  upperArm: 0.28,
  forearm: 0.27,
  neckY: 0.56,
};

/** Geometry per part; limbs hang down (−y) from their joint, the torso rises from the hip. */
export const buildBodyGeometries = () => ({
  head: sphere(0.105, [0, 0.13, 0.005], 14),
  hairCap: place(new SphereGeometry(0.114, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), [0, 0.142, -0.01]),
  bun: sphere(0.058, [0, 0.17, -0.105], 10),
  braid: capsule(0.03, 0.3, [0, 0.0, -0.105]),
  torso: place(capsule(0.16, 0.58, [0, 0.29, 0]), [0, 0, 0], [0, 0, 0], [1.08, 1, 0.74]),
  thigh: capsule(0.068, BODY.thigh, [0, -BODY.thigh / 2, 0]),
  shin: merge([
    tint(capsule(0.056, BODY.shin, [0, -BODY.shin / 2, 0]), 1),
    tint(box(0.1, 0.075, 0.25, [0, -BODY.shin - 0.01, 0.06]), 0.2),
  ]),
  upperArm: capsule(0.05, BODY.upperArm, [0, -BODY.upperArm / 2, 0]),
  forearm: merge([capsule(0.044, BODY.forearm, [0, -BODY.forearm / 2, 0]), sphere(0.05, [0, -BODY.forearm - 0.02, 0.01], 8)]),
  carry: box(0.44, 0.22, 0.3, [0, 0.24, 0.34]),
});

export const disposeBody = (geometries) => Object.values(geometries).forEach((g) => g.dispose());
