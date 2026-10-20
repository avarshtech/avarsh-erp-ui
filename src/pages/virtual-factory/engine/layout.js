/**
 * The factory floor plan in metres (x east, z south toward the viewer, y up). The garment flows west
 * to east: receiving → fabric store → cutting → cut-part supermarket → sewing → QC → finishing →
 * packing → finished goods → shipping dock. One main aisle crosses the building at z = AISLE_Z.
 */
export const BUILDING = { x0: -60, x1: 60, z0: -36, z1: 36, wall: 5 };
export const AISLE_Z = -0.5;
export const VERTICAL_AISLES = [-38, -4, 20, 40];

export const ZONES = {
  office: { label: 'Order office', x0: -60, x1: -40, z0: 22, z1: 36, accent: '#5b6573' },
  receiving: { label: 'Receiving dock', x0: -60, x1: -40, z0: -36, z1: -16, accent: '#b8892b' },
  store: { label: 'Fabric store', x0: -60, x1: -40, z0: -14, z1: 20, accent: '#b8892b' },
  cutting: { label: 'Cutting room', x0: -36, x1: -6, z0: -36, z1: -4, accent: '#4c6eb1' },
  staging: { label: 'Cut-part supermarket', x0: -36, x1: -6, z0: 2, z1: 14, accent: '#4c6eb1' },
  trims: { label: 'Trims store', x0: -36, x1: -6, z0: 18, z1: 36, accent: '#b8892b' },
  sewing: { label: 'Sewing floor', x0: -2, x1: 18, z0: -36, z1: 36, accent: '#2e8c86' },
  qc: { label: 'Quality control', x0: 22, x1: 38, z0: -36, z1: -16, accent: '#7a5ba6' },
  finishing: { label: 'Finishing', x0: 22, x1: 38, z0: -12, z1: 36, accent: '#d9922e' },
  packing: { label: 'Packing', x0: 42, x1: 60, z0: -36, z1: -8, accent: '#5e9a4b' },
  fg: { label: 'Finished goods', x0: 42, x1: 60, z0: -4, z1: 20, accent: '#b8892b' },
  shipping: { label: 'Shipping dock', x0: 42, x1: 60, z0: 24, z1: 36, accent: '#3e5c76' },
};

export const ZONE_ORDER = ['office', 'receiving', 'store', 'cutting', 'staging', 'trims', 'sewing', 'qc', 'finishing', 'packing', 'fg', 'shipping'];

export const zoneCentre = (id) => {
  const z = ZONES[id];
  return [(z.x0 + z.x1) / 2, 0, (z.z0 + z.z1) / 2];
};

/** Where a zone meets the main aisle (or its own access aisle), for routes between zones. */
export const ZONE_DOORS = {
  office: [-50, AISLE_Z], receiving: [-50, AISLE_Z], store: [-50, AISLE_Z], cutting: [-20, AISLE_Z],
  staging: [-20, AISLE_Z], trims: [-20, AISLE_Z], sewing: [8, AISLE_Z], qc: [30, AISLE_Z],
  finishing: [30, AISLE_Z], packing: [51, AISLE_Z], fg: [51, AISLE_Z], shipping: [51, AISLE_Z],
};

// ─── Docks and roads ─────────────────────────────────────────────────────────

export const RECEIVING_DOORS = [-31, -22];
export const SHIPPING_DOORS = [27, 33];
export const TRUCK_LENGTH = 11;

export const ROADS = [
  { x0: -90, x1: -82, z0: -120, z1: 54 },
  { x0: -260, x1: 260, z0: 46, z1: 54 },
  { x0: 82, x1: 90, z0: -60, z1: 54 },
];
export const YARD = { x0: -82, x1: 82, z0: -46, z1: 46 };

/** Supplier trucks come in from the west along the front road and reverse into a receiving door. */
export const inboundRoute = (doorIndex) => {
  const z = RECEIVING_DOORS[doorIndex % RECEIVING_DOORS.length];
  return [[-250, 50], [-86, 50], [-86, z - 0.01], [-60.6 - TRUCK_LENGTH / 2 - 9, z], [-60.6 - TRUCK_LENGTH / 2, z, 'reverse']];
};

/** Dispatch trucks wait nose-out at a shipping door and leave east along the front road. */
export const outboundRoute = (doorIndex) => {
  const z = SHIPPING_DOORS[doorIndex % SHIPPING_DOORS.length];
  return [[60.6 + TRUCK_LENGTH / 2, z], [86, z], [86, 50], [250, 50]];
};

/** Process vans (garments to an outside vendor) leave from the finishing side door. */
export const vanRoute = () => [[39, 34], [39, 42], [70, 42], [86, 42], [86, 50], [250, 50]];

export const SUPPLIER_GATE = [-250, 50];
export const CUSTOMER_GATE = [250, 50];

// ─── Station slots ───────────────────────────────────────────────────────────

/** Up to eight sewing lines, each a centre table along x with machines on both sides. */
export const SEWING_LINE_Z = [-30, -22, -14, -6, 5, 13, 21, 29];
export const SEWING_LINE_X0 = 0.6;
export const STATION_PITCH = 1.6;
export const STATIONS_PER_SIDE = 10;

/** Station `i` of a line: alternating sides so short lines still look balanced. */
export const stationSlot = (lineZ, i) => {
  const side = i % 2 === 0 ? -1 : 1;
  const col = Math.floor(i / 2);
  return { x: SEWING_LINE_X0 + col * STATION_PITCH, z: lineZ + side * 1.25, side };
};

export const CUTTING_TABLE_Z = [-32, -26, -20, -14];
export const CUTTING_TABLE = { x0: -29, x1: -9, width: 2 };
export const RELAXATION_RACKS = { x: -33.5, z0: -34, z1: -10 };
export const BUNDLING_TABLE = { x0: -28, x1: -10, z: -7 };

export const STORE_RACK_X = [-57, -52.5, -48, -43.5];
export const STORE_RACK_SPANS = [[-13, -4], [3, 19]];

export const FG_RACK_X = [44.5, 49.5, 54.5, 59];
export const FG_RACK_SPAN = [3, 19];

export const QC_TABLES = [[26, -31], [34, -31], [26, -23], [34, -23]];
export const PACKING_STATIONS = [[45.5, -31], [51, -31], [56.5, -31], [45.5, -24], [51, -24], [56.5, -24]];
export const IRONING_X = [24.5, 27, 29.5, 32, 34.5, 37];
export const IRONING_Z = [3, 8];

/**
 * Clear floor points where material leaves or enters a zone, each beside a vertical aisle, so a
 * route from port to port never crosses a table, a rack or a sewing line.
 */
export const PORTS = {
  dock: [-44, -26],
  store: [-39.2, 6],
  relax: [-31, -8.6],
  cuttingTable: (i) => [-7.6, CUTTING_TABLE_Z[i % CUTTING_TABLE_Z.length]],
  bundling: [-7.6, -7],
  staging: [-7.4, 8],
  trims: [-7.4, 26],
  lineHead: (lineZ) => [-1.6, lineZ],
  lineEnd: (lineZ) => [17.6, lineZ],
  qc: [23, -20],
  finishingIn: [23, -11],
  finishingOut: [37.2, 33],
  packing: [41.2, -20],
  fg: [41.2, 10],
  shipping: [44, 30],
  office: [-41, 28],
};

const nearestAisle = (x, towardX) => {
  const side = towardX >= x ? VERTICAL_AISLES.filter((a) => a >= x - 0.01) : VERTICAL_AISLES.filter((a) => a <= x + 0.01);
  if (!side.length) return null;
  return towardX >= x ? Math.min(...side) : Math.max(...side);
};

/** A floor route between two ports: out to a vertical aisle, along the main aisle, in from the other side. */
export const routeBetween = (from, to) => {
  const points = [from];
  const out = nearestAisle(from[0], to[0]);
  const back = nearestAisle(to[0], from[0]);
  if (out != null) points.push([out, from[1]], [out, AISLE_Z]);
  else points.push([from[0], AISLE_Z]);
  if (back != null) points.push([back, AISLE_Z], [back, to[1]]);
  else points.push([to[0], AISLE_Z]);
  points.push(to);
  return points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 0.05);
};
