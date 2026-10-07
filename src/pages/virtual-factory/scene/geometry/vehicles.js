import { box, cylinder, merge } from './merge';

/**
 * Vehicles face +z (cab or mast forward), like the workers, so one heading formula drives them all.
 * Each is split by material: body (tinted per use), dark running gear, glass, load bed.
 */
const wheel = (x, z, r = 0.5, w = 0.34) => cylinder(r, r, w, [x, r, z], [0, 0, Math.PI / 2], 16);

export const truckGeometries = () => ({
  gear: merge([
    box(2.1, 0.32, 9.6, [0, 0.82, 0.3]),
    ...[-3.8, -2.6, 3.9].flatMap((z) => [wheel(-1.02, z), wheel(1.02, z)]),
    box(2.3, 0.28, 0.25, [0, 0.62, 5.42]),
  ]),
  cab: merge([box(2.3, 2.05, 2.1, [0, 2.02, 4.25]), box(2.2, 0.5, 1.9, [0, 3.25, 4.15])]),
  glass: merge([box(2.0, 0.85, 0.06, [0, 2.55, 5.31]), box(0.06, 0.7, 1.1, [1.16, 2.55, 4.55]), box(0.06, 0.7, 1.1, [-1.16, 2.55, 4.55])]),
  container: box(2.4, 2.75, 7.6, [0, 2.36, -0.95]),
  stripe: box(2.42, 0.32, 7.62, [0, 1.35, -0.95]),
});

/** A small panel van for garments going out to a process vendor (washing, printing, embroidery). */
export const vanGeometries = () => ({
  gear: merge([box(1.8, 0.25, 4.6, [0, 0.55, 0]), wheel(-0.88, -1.5, 0.36, 0.26), wheel(0.88, -1.5, 0.36, 0.26), wheel(-0.88, 1.5, 0.36, 0.26), wheel(0.88, 1.5, 0.36, 0.26)]),
  cab: merge([box(1.85, 1.75, 4.2, [0, 1.5, -0.25]), box(1.85, 1.0, 0.9, [0, 1.12, 2.1])]),
  glass: merge([box(1.6, 0.55, 0.05, [0, 1.95, 1.88]), box(0.05, 0.5, 0.8, [0.94, 1.95, 1.4]), box(0.05, 0.5, 0.8, [-0.94, 1.95, 1.4])]),
  container: null,
  stripe: box(1.87, 0.22, 3.0, [0, 1.25, -0.7]),
});

/** A counterbalance forklift; the driver sits at y ≈ 0.6 so a seated worker fits. */
export const forkliftGeometries = () => ({
  body: merge([box(1.1, 0.75, 1.6, [0, 0.55, -0.1]), box(1.1, 0.55, 0.45, [0, 0.95, -0.85])]),
  gear: merge([
    wheel(-0.52, 0.45, 0.28, 0.2), wheel(0.52, 0.45, 0.28, 0.2), wheel(-0.5, -0.65, 0.24, 0.2), wheel(0.5, -0.65, 0.24, 0.2),
    ...[[-0.5, 0.45], [0.5, 0.45], [-0.5, -0.55], [0.5, -0.55]].map(([x, z]) => box(0.06, 1.25, 0.06, [x, 1.55, z])),
    box(1.08, 0.05, 1.12, [0, 2.17, -0.05]),
    box(0.1, 2.3, 0.1, [-0.35, 1.2, 0.85]), box(0.1, 2.3, 0.1, [0.35, 1.2, 0.85]),
    box(0.12, 0.05, 1.05, [-0.3, 0.12, 1.42]), box(0.12, 0.05, 1.05, [0.3, 0.12, 1.42]),
    box(0.9, 0.5, 0.06, [0, 0.4, 0.92]),
  ]),
});
