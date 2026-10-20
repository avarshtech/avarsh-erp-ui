import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

const matrix = new Matrix4();
const position = new Vector3();
const quaternion = new Quaternion();
const euler = new Euler();
const scale = new Vector3();

/** Position, turn (euler) and scale of one instance; the matrix is reused, copy it before keeping it. */
export const pose = (x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  quaternion.setFromEuler(euler.set(rx, ry, rz));
  return matrix.compose(position.set(x, y, z), quaternion, scale.set(sx, sy, sz));
};
