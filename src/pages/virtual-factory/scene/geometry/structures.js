import { box, cylinder, merge } from './merge';

/** A plain work table: top at height h, four legs. */
export const tableGeometry = (w, d, h = 0.86) => merge([
  box(w, 0.05, d, [0, h - 0.025, 0]),
  ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box(0.05, h - 0.05, 0.05, [sx * (w / 2 - 0.06), (h - 0.05) / 2, sz * (d / 2 - 0.06)])),
]);

/** A long cutting table (top at 0.89 m) with legs every two metres. */
export const cuttingTableGeometry = (length, width) => {
  const legs = [];
  for (let x = -length / 2 + 0.3; x <= length / 2 - 0.2; x += 2) legs.push(box(0.07, 0.83, 0.07, [x, 0.415, -width / 2 + 0.12]), box(0.07, 0.83, 0.07, [x, 0.415, width / 2 - 0.12]));
  return merge([box(length, 0.06, width, [0, 0.86, 0]), box(length, 0.02, 0.04, [0, 0.9, -width / 2 + 0.02]), ...legs]);
};

/** Cantilever racks for fabric rolls: uprights with arms both sides at three levels, one row along z. */
export const rollRackGeometry = (x, z0, z1) => {
  const parts = [];
  for (let z = z0; z <= z1 + 0.01; z += 2) {
    parts.push(box(0.14, 2.75, 0.14, [x, 1.375, z]), box(1.9, 0.08, 0.14, [x, 0.04, z]));
    [0.24, 1.14, 2.04].forEach((y) => parts.push(box(1.8, 0.06, 0.08, [x, y, z])));
  }
  return parts;
};

/** Pallet racking for finished cartons: blue frames every bay, orange beams at three levels. */
export const palletRackGeometry = (x, z0, bays, bay = 2.6) => {
  const frames = [];
  const beams = [];
  for (let i = 0; i <= bays; i += 1) {
    const z = z0 + i * bay;
    frames.push(box(0.09, 4.1, 0.09, [x - 0.55, 2.05, z]), box(0.09, 4.1, 0.09, [x + 0.55, 2.05, z]), box(1.1, 0.05, 0.05, [x, 1.0, z]), box(1.1, 0.05, 0.05, [x, 3.0, z]));
  }
  for (let i = 0; i < bays; i += 1) {
    const z = z0 + i * bay + bay / 2;
    [0.12, 1.42, 2.72].forEach((y) => beams.push(box(0.08, 0.12, bay, [x - 0.55, y, z]), box(0.08, 0.12, bay, [x + 0.55, y, z])));
  }
  return { frames, beams };
};

/** Two-level shelving along x for bundles and trims cartons. */
export const shelvingGeometry = (x0, x1, z, depth = 0.8) => {
  const parts = [];
  const length = x1 - x0;
  [0.36, 1.16, 1.96].forEach((y) => parts.push(box(length, 0.04, depth, [x0 + length / 2, y, z])));
  for (let x = x0; x <= x1 + 0.01; x += 2.4) parts.push(box(0.06, 2.0, 0.06, [x, 1.0, z - depth / 2]), box(0.06, 2.0, 0.06, [x, 1.0, z + depth / 2]));
  return parts;
};

/** An ironing board with its iron, along x, 0.9 m high. */
export const ironingBoardGeometry = () => merge([
  box(1.2, 0.03, 0.38, [0, 0.9, 0]),
  cylinder(0.19, 0.19, 0.03, [0.6, 0.9, 0], [0, 0, 0], 14),
  box(0.05, 0.9, 0.05, [-0.35, 0.45, 0], [0, 0, 0.35]),
  box(0.05, 0.9, 0.05, [0.25, 0.45, 0], [0, 0, -0.35]),
  box(0.22, 0.08, 0.12, [0.1, 0.96, 0.02]),
]);

/** Fabric inspection frame: rollers over a lit board, where incoming rolls are checked. */
export const inspectionFrameGeometry = () => merge([
  box(0.1, 2.2, 0.1, [-1, 1.1, 0]), box(0.1, 2.2, 0.1, [1, 1.1, 0]),
  cylinder(0.12, 0.12, 2.0, [0, 2.15, 0], [0, 0, Math.PI / 2], 14),
  cylinder(0.06, 0.06, 2.0, [0, 0.55, 0.45], [0, 0, Math.PI / 2], 10),
]);
