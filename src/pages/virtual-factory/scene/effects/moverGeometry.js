import { box, cylinder, merge } from '../geometry/merge';
import { forkliftGeometries, truckGeometries, vanGeometries } from '../geometry/vehicles';

/** Shared shapes for everything that moves on an event: carts and their loads, forklifts, trucks, vans. */
export const buildMoverGeometries = () => ({
  cart: merge([
    box(1.3, 0.22, 0.85, [0, 0.34, 0]),
    box(0.06, 0.7, 0.06, [-0.62, 0.7, 0]),
    box(0.06, 0.06, 0.6, [-0.62, 1.05, 0]),
    ...[[-0.5, -0.36], [0.5, -0.36], [-0.5, 0.36], [0.5, 0.36]].map(([x, z]) => cylinder(0.13, 0.13, 0.08, [x, 0.13, z], [Math.PI / 2, 0, 0], 12)),
  ]),
  loads: {
    bundles: merge([0, 1, 2, 3, 4, 5].map((i) => box(0.38, 0.12, 0.28, [-0.4 + (i % 3) * 0.4, 0.52 + Math.floor(i / 3) * 0.13, 0]))),
    rolls: merge([-0.2, 0, 0.2].map((z, i) => cylinder(0.15, 0.15, 1.2, [0, 0.6 + (i === 1 ? 0.24 : 0), z * 1.4], [0, 0, Math.PI / 2], 14))),
    garments: merge([0, 1, 2, 3].map((i) => box(0.36, 0.05, 0.28, [-0.2 + (i % 2) * 0.42, 0.48 + Math.floor(i / 2) * 0.06, 0]))),
    cartons: merge([0, 1, 2, 3].map((i) => box(0.5, 0.36, 0.36, [-0.27 + (i % 2) * 0.54, 0.64, -0.2 + Math.floor(i / 2) * 0.4]))),
  },
  forklift: forkliftGeometries(),
  truck: truckGeometries(),
  van: vanGeometries(),
});

export const disposeMoverGeometries = (g) => {
  g.cart.dispose();
  Object.values(g.loads).forEach((x) => x.dispose());
  [g.forklift, g.truck, g.van].forEach((set) => Object.values(set).forEach((x) => x?.dispose()));
};
