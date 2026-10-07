import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Shape } from 'three';
import { box, merge, place } from './merge';

/** A fabric roll of radius 1 and length 1 along y; instances scale and turn it. */
export const rollGeometry = () => new CylinderGeometry(1, 1, 1, 18);

/** A unit box, scaled per carton. */
export const cartonGeometry = () => new BoxGeometry(1, 1, 1);

/** A bundle of cut panels tied with its ticket. */
export const bundleGeometry = () => merge([box(0.42, 0.12, 0.3, [0, 0.06, 0]), box(0.08, 0.004, 0.12, [0.12, 0.122, 0.04])]);

const teeShape = () => {
  const s = new Shape();
  s.moveTo(-0.18, -0.32);
  s.lineTo(0.18, -0.32);
  s.lineTo(0.18, 0.1);
  s.lineTo(0.29, 0.05);
  s.lineTo(0.35, 0.19);
  s.lineTo(0.2, 0.31);
  s.lineTo(0.08, 0.31);
  s.quadraticCurveTo(0, 0.23, -0.08, 0.31);
  s.lineTo(-0.2, 0.31);
  s.lineTo(-0.35, 0.19);
  s.lineTo(-0.29, 0.05);
  s.lineTo(-0.18, 0.1);
  s.closePath();
  return s;
};

/** A T-shirt lying flat (front up), 0.7 m across the sleeves. */
export const teeGeometry = () => {
  const g = new ExtrudeGeometry(teeShape(), { depth: 0.012, bevelEnabled: false, curveSegments: 6 });
  return place(g, [0, 0.006, 0], [-Math.PI / 2, 0, 0]);
};

/** A folded garment, for stacks. */
export const foldedGeometry = () => box(0.34, 0.045, 0.27, [0, 0.0225, 0]);

/** A timber pallet, 1.2 × 1.0 m. */
export const palletGeometry = () => merge([
  box(1.2, 0.025, 0.24, [0, 0.135, -0.38]),
  box(1.2, 0.025, 0.24, [0, 0.135, 0]),
  box(1.2, 0.025, 0.24, [0, 0.135, 0.38]),
  box(0.12, 0.12, 1.0, [-0.5, 0.06, 0]),
  box(0.12, 0.12, 1.0, [0, 0.06, 0]),
  box(0.12, 0.12, 1.0, [0.5, 0.06, 0]),
]);
