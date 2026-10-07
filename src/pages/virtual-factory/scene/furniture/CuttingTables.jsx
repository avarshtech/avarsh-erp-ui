import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial } from 'three';
import { CUTTING_TABLE } from '../../engine/layout';
import { walkerAt } from '../crowd/motion';
import { cuttingTableGeometry } from '../geometry/structures';
import { markerTexture, plyTexture } from '../geometry/textures';
import { pointerHandlers } from '../interaction';

const LENGTH = CUTTING_TABLE.x1 - CUTTING_TABLE.x0;
const MID = (CUTTING_TABLE.x0 + CUTTING_TABLE.x1) / 2;
const TOP = 0.89;
const pingPong = (u) => 1 - Math.abs((u % 2) - 1);

/** The lay: plies show on its edges; marker paper covers it once spreading is done. */
function Lay({ table }) {
  const height = Math.min(0.32, Math.max(0.025, table.plies * 0.0032));
  const materials = useMemo(() => {
    const side = new MeshStandardMaterial({ color: table.hex, map: plyTexture(), roughness: 0.9 });
    const top = table.stage === 'spreading'
      ? new MeshStandardMaterial({ color: table.hex, roughness: 0.95 })
      : new MeshStandardMaterial({ map: markerTexture(), roughness: 0.9 });
    return [side, side, top, side, side, side];
  }, [table.hex, table.stage]);
  useEffect(() => () => [...new Set(materials)].forEach((m) => m.dispose()), [materials]);
  return (
    <mesh position={[CUTTING_TABLE.x0 + 0.3 + table.length / 2, TOP + height / 2, table.z]} material={materials} castShadow receiveShadow>
      <boxGeometry args={[table.length, height, 1.8]} />
    </mesh>
  );
}

/** The spreading machine travelling the lay, or the straight knife following its cutter (still under reduced motion). */
function Tool({ table, cutter, animate }) {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    if (!ref.current || !animate) return;
    if (table.stage === 'spreading') ref.current.position.x = CUTTING_TABLE.x0 + 0.8 + (table.length - 1) * pingPong(clock.elapsedTime / 11);
    else if (cutter) ref.current.position.x = walkerAt(cutter, clock.elapsedTime).x;
  });
  if (table.stage === 'spreading') {
    return (
      <group ref={ref} position={[CUTTING_TABLE.x0 + 1, 0, table.z]}>
        <mesh position={[0, 1.45, 0]} castShadow><boxGeometry args={[0.35, 0.18, 2.5]} /><meshStandardMaterial color="#5c6b7c" /></mesh>
        {[-1.2, 1.2].map((dz) => <mesh key={dz} position={[0, 1.15, dz]} castShadow><boxGeometry args={[0.18, 0.62, 0.22]} /><meshStandardMaterial color="#5c6b7c" /></mesh>)}
        <mesh position={[0, 1.2, 0]} rotation-x={Math.PI / 2} castShadow><cylinderGeometry args={[0.2, 0.2, 2.0, 18]} /><meshStandardMaterial color={table.hex} roughness={0.9} /></mesh>
      </group>
    );
  }
  if (table.stage !== 'cutting') return null;
  return (
    <group ref={ref} position={[CUTTING_TABLE.x0 + 1, TOP + 0.3, table.z + 0.55]}>
      <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.26, 0.03, 0.2]} /><meshStandardMaterial color="#7d8793" metalness={0.5} /></mesh>
      <mesh position={[0, 0.26, 0]} castShadow><boxGeometry args={[0.05, 0.46, 0.05]} /><meshStandardMaterial color="#c9ced6" metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[0, 0.52, 0]} castShadow><boxGeometry args={[0.17, 0.15, 0.17]} /><meshStandardMaterial color="#3d4d6a" /></mesh>
    </group>
  );
}

/** Cutting tables with their lays, tools and crews; a table is clickable. */
export default function CuttingTables({ tables, workers, night, animate, onSelect }) {
  const geometry = useMemo(() => cuttingTableGeometry(LENGTH, CUTTING_TABLE.width), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return tables.map((table) => (
    <group key={table.id}>
      <mesh geometry={geometry} position={[MID, 0, table.z]} castShadow receiveShadow {...pointerHandlers(() => table.select || { type: 'cuttingTable', id: table.id }, onSelect, { hover: true })}>
        <meshStandardMaterial color={night ? '#6c747d' : '#f2f3f1'} roughness={0.6} />
      </mesh>
      {table.stage !== 'idle' && <Lay table={table} />}
      <Tool table={table} cutter={workers.find((w) => w.key === `cut-${table.id}`)} animate={animate} />
    </group>
  ));
}
