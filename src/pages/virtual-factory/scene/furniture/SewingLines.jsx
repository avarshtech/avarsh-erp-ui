import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { SEWING_LINE_X0, STATION_PITCH, STATIONS_PER_SIDE } from '../../engine/layout';
import { box, merge } from '../geometry/merge';

const LENGTH = (STATIONS_PER_SIDE - 1) * STATION_PITCH + 1.4;
const MID_X = SEWING_LINE_X0 + (STATIONS_PER_SIDE - 1) * STATION_PITCH / 2;
const END_X = SEWING_LINE_X0 + (STATIONS_PER_SIDE - 1) * STATION_PITCH + 1.6;

const lineFurniture = (z) => [
  box(LENGTH, 0.05, 0.5, [MID_X, 0.8, z]),
  ...[-LENGTH / 2 + 0.3, 0, LENGTH / 2 - 0.3].map((dx) => box(0.05, 0.78, 0.4, [MID_X + dx, 0.39, z])),
  box(1.1, 0.06, 0.8, [END_X, 0.7, z]), box(1.1, 0.06, 0.8, [END_X, 0.2, z]),
  ...[[-0.5, -0.35], [0.5, -0.35], [-0.5, 0.35], [0.5, 0.35]].map(([dx, dz]) => box(0.04, 0.7, 0.04, [END_X + dx, 0.38, z + dz])),
];

const TINT = { down: '#e5484d', new: '#6366f1', red: '#e5484d', maintenance: '#3b82f6' };

/** An overloaded line's tint pulses; under reduced motion it stays still. */
function LineTint({ line, animate }) {
  const material = useRef(null);
  useFrame(({ clock }) => {
    if (animate && material.current && line.tone === 'red') material.current.opacity = 0.1 + 0.08 * (1 + Math.sin(clock.elapsedTime * 3));
  });
  return (
    <mesh position={[MID_X + 0.6, 0.018, line.z]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[LENGTH + 4.6, 4.4]} />
      <meshBasicMaterial ref={material} color={TINT[line.tone]} transparent opacity={0.16} depthWrite={false} />
    </mesh>
  );
}

/** The centre bundle table and output trolley of every line; a floor tint marks lines down, new or overloaded. */
export default function SewingLines({ lines, night, animate }) {
  const zs = lines.map((l) => l.z).join(',');
  const geometry = useMemo(() => (zs ? merge(zs.split(',').flatMap((z) => lineFurniture(Number(z)))) : null), [zs]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return (
    <group>
      {geometry && (
        <mesh geometry={geometry} castShadow receiveShadow>
          <meshStandardMaterial color={night ? '#59626d' : '#cfd5dc'} roughness={0.7} />
        </mesh>
      )}
      {lines.filter((l) => TINT[l.tone]).map((l) => <LineTint key={l.id} line={l} animate={animate} />)}
    </group>
  );
}
