import { BoxGeometry, CapsuleGeometry, CylinderGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const matrix = new Matrix4();
const quaternion = new Quaternion();
const euler = new Euler();
const position = new Vector3();
const scaleVec = new Vector3();

/** Moves, turns and scales a primitive into its place in a part's own frame. */
export const place = (geometry, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) => {
  euler.set(rot[0], rot[1], rot[2]);
  quaternion.setFromEuler(euler);
  matrix.compose(position.set(at[0], at[1], at[2]), quaternion, scaleVec.set(scale[0], scale[1], scale[2]));
  geometry.applyMatrix4(matrix);
  return geometry;
};

export const box = (w, h, d, at, rot) => place(new BoxGeometry(w, h, d), at, rot);
export const cylinder = (rTop, rBottom, h, at, rot, segments = 14) => place(new CylinderGeometry(rTop, rBottom, h, segments), at, rot);
export const sphere = (r, at, segments = 12) => place(new SphereGeometry(r, segments, Math.max(6, segments - 4)), at);
export const capsule = (r, length, at, rot) => place(new CapsuleGeometry(r, Math.max(0.001, length - 2 * r), 4, 10), at, rot);

/** Paints a whole primitive one vertex colour, so one instanced mesh can carry two tones. */
export const tint = (geometry, shade) => {
  const count = geometry.attributes.position.count;
  geometry.setAttribute('color', new Float32BufferAttribute(new Array(count * 3).fill(shade), 3));
  return geometry;
};

/** Paints a whole primitive one RGB vertex colour (for merged meshes of many colours). */
export const paint = (geometry, hex) => {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map((c) => c ** 2.2);
  const count = geometry.attributes.position.count;
  const data = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) data.set(rgb, i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(data, 3));
  return geometry;
};

/** Merges primitives into one geometry (one draw call); the inputs are disposed. */
export const merge = (parts) => {
  const flat = parts.map((part) => (part.index ? part.toNonIndexed() : part));
  const merged = mergeGeometries(flat, false);
  parts.forEach((part) => part.dispose());
  flat.forEach((part) => part.dispose());
  merged.computeBoundingSphere();
  return merged;
};
