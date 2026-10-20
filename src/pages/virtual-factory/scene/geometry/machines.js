import { box, cylinder, merge, sphere } from './merge';

/**
 * Garment machines in their own frame: the table top is y = 0.78, the operator sits at +z and the
 * needle is on the −x side, as on a real industrial machine.
 */
export const TABLE_TOP_Y = 0.78;

export const lockstitchGeometry = () => merge([
  box(0.46, 0.05, 0.19, [0, 0.025, 0]),
  box(0.085, 0.25, 0.12, [0.17, 0.17, 0]),
  box(0.42, 0.075, 0.11, [0, 0.32, 0]),
  box(0.1, 0.2, 0.11, [-0.19, 0.23, 0]),
  cylinder(0.009, 0.009, 0.08, [-0.19, 0.09, 0.02]),
  cylinder(0.065, 0.065, 0.035, [0.235, 0.25, 0], [0, 0, Math.PI / 2], 16),
  box(0.06, 0.03, 0.05, [-0.21, 0.36, 0]),
]);

export const overlockGeometry = () => merge([
  box(0.3, 0.13, 0.24, [0, 0.065, 0]),
  box(0.24, 0.12, 0.2, [0.02, 0.19, -0.01]),
  box(0.08, 0.1, 0.08, [-0.12, 0.17, 0.06]),
  cylinder(0.055, 0.055, 0.03, [0.17, 0.17, 0], [0, 0, Math.PI / 2], 14),
]);

export const kajaGeometry = () => merge([
  box(0.36, 0.08, 0.32, [0, 0.04, 0]),
  box(0.12, 0.38, 0.22, [0.12, 0.27, -0.02]),
  box(0.38, 0.12, 0.2, [-0.02, 0.5, -0.02]),
  box(0.08, 0.14, 0.12, [-0.17, 0.39, 0]),
]);

/** Which head a machine type draws with, and its enamel. */
export const MACHINE_KINDS = {
  SNLS: { geometry: 'lockstitch', colour: '#eeeae0' },
  DNLS: { geometry: 'lockstitch', colour: '#e6e2d6' },
  BARTACK: { geometry: 'lockstitch', colour: '#dfe4e8' },
  KANSAI: { geometry: 'lockstitch', colour: '#e4e8df' },
  OVERLOCK: { geometry: 'overlock', colour: '#e3e8ec' },
  FLATLOCK: { geometry: 'overlock', colour: '#dde6e2' },
  KAJA: { geometry: 'kaja', colour: '#e9e4da' },
  IRON: { geometry: 'overlock', colour: '#d9dde2' },
};
export const machineKind = (type) => MACHINE_KINDS[type] || MACHINE_KINDS.SNLS;

export const tableTopGeometry = () => box(1.15, 0.035, 0.6, [0, TABLE_TOP_Y - 0.0175, 0]);

export const tableStandGeometry = () => merge([
  box(0.04, 0.745, 0.5, [-0.5, 0.3725, 0]),
  box(0.04, 0.745, 0.5, [0.5, 0.3725, 0]),
  box(1.0, 0.04, 0.04, [0, 0.12, 0.18]),
  box(0.3, 0.15, 0.2, [0.24, 0.63, -0.05]),
  cylinder(0.012, 0.012, 0.58, [0.47, 1.07, -0.24], [0, 0, 0], 8),
  cylinder(0.006, 0.006, 0.36, [-0.4, 0.96, -0.24], [0, 0, 0], 6),
]);

/** The status lamp on its pole, and two thread cones on the stand, in the table's frame. */
export const LAMP_AT = [0.47, 1.4, -0.24];
export const CONES_AT = [[-0.43, TABLE_TOP_Y, -0.24], [-0.36, TABLE_TOP_Y, -0.24]];
export const lampGeometry = () => sphere(0.055, [0, 0, 0], 10);
export const coneGeometry = () => cylinder(0.016, 0.034, 0.11, [0, 0.055, 0], [0, 0, 0], 10);

export const stoolGeometry = () => merge([
  cylinder(0.19, 0.19, 0.05, [0, 0.555, 0], [0, 0, 0], 16),
  cylinder(0.025, 0.025, 0.5, [0, 0.29, 0], [0, 0, 0], 8),
  cylinder(0.2, 0.22, 0.04, [0, 0.02, 0], [0, 0, 0], 12),
]);

/** A piece of fabric under the needle, slid along while the machine runs. */
export const fabricPieceGeometry = () => box(0.26, 0.008, 0.2, [0, 0.004, 0]);
