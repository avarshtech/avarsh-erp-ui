import { useEffect, useMemo } from 'react';
import {
  BUNDLING_TABLE, FG_RACK_SPAN, FG_RACK_X, IRONING_X, IRONING_Z, PACKING_STATIONS, QC_TABLES, RELAXATION_RACKS,
  STORE_RACK_SPANS, STORE_RACK_X, ZONES,
} from '../../engine/layout';
import { box, merge, place } from '../geometry/merge';
import { inspectionFrameGeometry, ironingBoardGeometry, palletRackGeometry, rollRackGeometry, shelvingGeometry, tableGeometry } from '../geometry/structures';

const at = (geometry, x, z, ry = 0) => place(geometry, [x, 0, z], [0, ry, 0]);

const buildFurniture = () => {
  const fg = FG_RACK_X.map((x) => palletRackGeometry(x, FG_RACK_SPAN[0], 6));
  const office = ZONES.office;
  return {
    metal: merge([
      ...STORE_RACK_X.flatMap((x) => STORE_RACK_SPANS.flatMap(([z0, z1]) => rollRackGeometry(x, z0, z1))),
      ...rollRackGeometry(RELAXATION_RACKS.x, RELAXATION_RACKS.z0, RELAXATION_RACKS.z1),
      at(inspectionFrameGeometry(), -46.5, -19.6),
    ]),
    frames: merge(fg.flatMap((r) => r.frames)),
    beams: merge(fg.flatMap((r) => r.beams)),
    shelving: merge([4.5, 8, 11.5].flatMap((z) => shelvingGeometry(-34, -8.6, z)).concat([21.5, 25.5, 29.5, 33.5].flatMap((z) => shelvingGeometry(-34, -8.6, z, 0.7)))),
    tables: merge([
      ...QC_TABLES.map(([x, z]) => at(tableGeometry(3.4, 1.3, 0.86), x, z)),
      ...PACKING_STATIONS.map(([x, z]) => at(tableGeometry(2.4, 1.2, 0.88), x, z)),
      ...[[25, -9], [25, -4.5], [26, 14], [34, 14], [26, 20.5], [34, 20.5], [34, 26]].map(([x, z]) => at(tableGeometry(3.2, 1.2, 0.86), x, z)),
      at(tableGeometry(BUNDLING_TABLE.x1 - BUNDLING_TABLE.x0, 1.1, 0.86), (BUNDLING_TABLE.x0 + BUNDLING_TABLE.x1) / 2, BUNDLING_TABLE.z),
      ...[[-56, 27], [-51, 27], [-46, 27], [-56, 32]].map(([x, z]) => at(tableGeometry(1.6, 0.8, 0.76), x, z)),
      at(tableGeometry(3, 0.9, 1.0), -8.4, 31, Math.PI / 2),
      at(tableGeometry(3, 1.3, 0.9), 51, -13.4),
      ...[31.5, 33.1, 34.7, 36.3].map((x) => at(tableGeometry(1.15, 0.6, 0.78), x, -8.6)),
    ]),
    ironing: merge(IRONING_Z.flatMap((z) => IRONING_X.map((x) => at(ironingBoardGeometry(), x, z)))),
    dark: merge([
      ...[[-56, 27], [-51, 27], [-46, 27], [-56, 32]].map(([x, z]) => box(0.55, 0.36, 0.05, [x, 0.98, z - 0.22])),
      box(1.2, 0.9, 0.8, [53.4, 0.45, -13.4]),
      box(2.4, 0.06, 0.05, [office.x0 + 10, 2.4, office.z0]),
    ]),
    lit: merge([box(1.8, 1.1, 0.03, [-46.5, 1.25, -19.25], [-0.35, 0, 0])]),
    glass: merge([
      box(office.x1 - office.x0, 2.4, 0.05, [(office.x0 + office.x1) / 2, 1.2, office.z0]),
      box(0.05, 2.4, office.z1 - office.z0, [office.x1, 1.2, (office.z0 + office.z1) / 2]),
    ]),
    crates: merge([box(2.2, 0.4, 1.0, [28.7, 0.2, -18.6]), box(1.6, 0.4, 1.0, [36.4, 0.2, -18.6])]),
  };
};

/** Everything on the floor that does not move: racks, shelving, tables, boards, the office glass. */
export default function StaticFurniture({ night, inspecting }) {
  const g = useMemo(() => buildFurniture(), []);
  useEffect(() => () => Object.values(g).forEach((geo) => geo.dispose()), [g]);
  const mesh = (geometry, color, extra = {}) => (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.75} {...extra} />
    </mesh>
  );
  return (
    <group>
      {mesh(g.metal, night ? '#3f4a57' : '#6f7f91', { metalness: 0.3 })}
      {mesh(g.frames, night ? '#24425f' : '#2f5d8a', { metalness: 0.25 })}
      {mesh(g.beams, night ? '#8a4a1e' : '#e07a2f', { metalness: 0.2 })}
      {mesh(g.shelving, night ? '#4b5562' : '#9aa6b3', { metalness: 0.2 })}
      {mesh(g.tables, night ? '#555d66' : '#d9dde2')}
      {mesh(g.ironing, night ? '#5a6470' : '#c6d0db')}
      {mesh(g.dark, '#2b313a')}
      {mesh(g.crates, night ? '#3d5f50' : '#5aa77c')}
      <mesh geometry={g.lit}>
        <meshStandardMaterial color="#ffffff" emissive="#fffbe8" emissiveIntensity={inspecting ? 1.4 : 0.25} />
      </mesh>
      <mesh geometry={g.glass}>
        <meshStandardMaterial color="#b9d6ea" transparent opacity={0.28} roughness={0.1} depthWrite={false} />
      </mesh>
    </group>
  );
}
