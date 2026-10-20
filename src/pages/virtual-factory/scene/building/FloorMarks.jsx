import { useEffect, useMemo } from 'react';
import { AISLE_Z, BUILDING, VERTICAL_AISLES, ZONES } from '../../engine/layout';
import { box, merge, paint } from '../geometry/merge';

const LINE = 0.14;

const outline = (z, hex) => {
  const w = z.x1 - z.x0;
  const d = z.z1 - z.z0;
  return [
    box(w, 0.01, LINE, [z.x0 + w / 2, 0.012, z.z0]), box(w, 0.01, LINE, [z.x0 + w / 2, 0.012, z.z1]),
    box(LINE, 0.01, d, [z.x0, 0.012, z.z0 + d / 2]), box(LINE, 0.01, d, [z.x1, 0.012, z.z0 + d / 2]),
  ].map((g) => paint(g, hex));
};

const buildMarks = () => {
  const zones = Object.values(ZONES);
  const tints = merge(zones.map((z) => paint(box(z.x1 - z.x0, 0.01, z.z1 - z.z0, [(z.x0 + z.x1) / 2, 0.006, (z.z0 + z.z1) / 2]), z.accent)));
  const outlines = merge(zones.flatMap((z) => outline(z, z.accent)));
  const length = BUILDING.x1 - BUILDING.x0;
  const depth = BUILDING.z1 - BUILDING.z0;
  const aisles = merge([
    box(length, 0.01, 0.12, [0, 0.014, AISLE_Z - 2.6]), box(length, 0.01, 0.12, [0, 0.014, AISLE_Z + 2.6]),
    ...VERTICAL_AISLES.flatMap((x) => [box(0.12, 0.01, depth, [x - 1.4, 0.014, 0]), box(0.12, 0.01, depth, [x + 1.4, 0.014, 0])]),
  ]);
  return { tints, outlines, aisles };
};

/** Painted floor: a faint tint and an accent outline per zone, yellow walkway lines along the aisles. */
export default function FloorMarks({ night, highlight }) {
  const g = useMemo(() => buildMarks(), []);
  useEffect(() => () => Object.values(g).forEach((geo) => geo.dispose()), [g]);
  const zone = highlight ? ZONES[highlight] : null;
  return (
    <group>
      <mesh geometry={g.tints}>
        <meshBasicMaterial vertexColors transparent opacity={night ? 0.16 : 0.1} depthWrite={false} />
      </mesh>
      <mesh geometry={g.outlines}>
        <meshBasicMaterial vertexColors transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <mesh geometry={g.aisles}>
        <meshBasicMaterial color={night ? '#a8842c' : '#e2b23a'} />
      </mesh>
      {zone && (
        <mesh position={[(zone.x0 + zone.x1) / 2, 0.02, (zone.z0 + zone.z1) / 2]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[zone.x1 - zone.x0, zone.z1 - zone.z0]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.13} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}
