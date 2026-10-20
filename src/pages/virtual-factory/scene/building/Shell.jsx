import { useEffect, useMemo } from 'react';
import { BUILDING, RECEIVING_DOORS, SHIPPING_DOORS, ZONES } from '../../engine/layout';
import { box, merge } from '../geometry/merge';

const T = 0.35;
const DOOR = 4.4;

/** Wall pieces along one side, with dock openings cut out (a lintel bridges each opening). */
const wallWithDoors = (axis, fixed, from, to, height, doors) => {
  const parts = [];
  let start = from;
  [...doors].sort((a, b) => a - b).forEach((d) => {
    const end = d - DOOR / 2;
    if (end > start) parts.push([start, end, height]);
    start = d + DOOR / 2;
    parts.push([d - DOOR / 2, d + DOOR / 2, height, true]);
  });
  if (to > start) parts.push([start, to, height]);
  return parts.flatMap(([a, b, h, lintel]) => {
    if (lintel && h < 4) return [];
    const len = b - a;
    const mid = (a + b) / 2;
    const y0 = lintel ? Math.min(4.2, h - 0.4) : 0;
    const hh = lintel ? Math.max(0, h - y0) : h;
    if (hh <= 0) return [];
    return [axis === 'x' ? box(len, hh, T, [mid, y0 + hh / 2, fixed]) : box(T, hh, len, [fixed, y0 + hh / 2, mid])];
  });
};

/** Dock levellers outside each door, at truck-bed height. */
const docks = (x, doors, outward) => doors.flatMap((z) => [box(2.4, 1.1, 3.6, [x + outward * 1.2, 0.55, z]), box(0.3, 0.5, 0.4, [x + outward * 2.45, 1.1, z - 1.4]), box(0.3, 0.5, 0.4, [x + outward * 2.45, 1.1, z + 1.4])]);

const buildShell = () => {
  const { x0, x1, z0, z1, wall } = BUILDING;
  const walls = merge([
    ...wallWithDoors('x', z0, x0, x1, wall, []),
    ...wallWithDoors('z', x0, z0, z1, wall, RECEIVING_DOORS),
    ...wallWithDoors('z', x1, z0, z1, 1.4, SHIPPING_DOORS),
    ...wallWithDoors('x', z1, x0, x1, 0.9, []),
    ...[-48, -36, -24, -12, 0, 12, 24, 36, 48].map((x) => box(0.7, 6.2, 0.7, [x, 3.1, z0 + 0.1])),
    ...[-24, -12, 0, 12, 24].map((z) => box(0.7, 6.2, 0.7, [x0 + 0.1, 3.1, z])),
  ]);
  const dockGear = merge([...docks(x0, RECEIVING_DOORS, -1), ...docks(x1, SHIPPING_DOORS, 1), ...RECEIVING_DOORS.map((z) => box(0.5, 0.55, DOOR, [x0, 4.5, z]))]);
  const lamps = merge(Object.values(ZONES).flatMap((zone) => {
    const out = [];
    for (let x = zone.x0 + 3; x < zone.x1 - 1; x += 7) for (let z = zone.z0 + 4; z < zone.z1 - 1; z += 8) out.push(box(2.6, 0.07, 0.28, [x, 6.4, z]));
    return out;
  }));
  return { walls, dockGear, lamps };
};

/** The building: floor slab, a cut-away shell (tall at the back, low at the viewer's side), docks, lights. */
export default function Shell({ night }) {
  const g = useMemo(() => buildShell(), []);
  useEffect(() => () => Object.values(g).forEach((geo) => geo.dispose()), [g]);
  const { x0, x1, z0, z1 } = BUILDING;
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, -0.15, (z0 + z1) / 2]} receiveShadow>
        <boxGeometry args={[x1 - x0 + 0.8, 0.3, z1 - z0 + 0.8]} />
        <meshStandardMaterial color={night ? '#3a414c' : '#e3e6e9'} roughness={0.55} />
      </mesh>
      <mesh geometry={g.walls} castShadow receiveShadow>
        <meshStandardMaterial color={night ? '#2d343d' : '#f2f4f6'} roughness={0.9} />
      </mesh>
      <mesh geometry={g.dockGear} castShadow receiveShadow>
        <meshStandardMaterial color={night ? '#3a414b' : '#8e98a3'} roughness={0.8} />
      </mesh>
      {night && (
        <mesh geometry={g.lamps}>
          <meshStandardMaterial color="#f7f8fa" emissive="#fff3d6" emissiveIntensity={1.8} />
        </mesh>
      )}
    </group>
  );
}
