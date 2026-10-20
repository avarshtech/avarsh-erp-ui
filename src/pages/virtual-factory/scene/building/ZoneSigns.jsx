import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide } from 'three';
import { ZONES } from '../../engine/layout';
import { signTexture } from '../geometry/textures';
import { pointerHandlers } from '../interaction';

const W = 10.4;
const H = 2.6;

const chipOf = (status) => {
  if (status?.tone === 'locked') return 'No access';
  if (status?.demo) return 'Demo data';
  return status?.stale ? 'Not updated' : null;
};

function Sign({ id, status, onSelect }) {
  const zone = ZONES[id];
  const chip = chipOf(status);
  const texture = useMemo(() => signTexture({ label: zone.label, metric: status?.metric || '', accent: zone.accent, tone: status?.tone, chip }),
    [zone, status?.metric, status?.tone, chip]);
  useEffect(() => () => texture.dispose(), [texture]);
  const group = useRef(null);
  useFrame(({ camera }) => {
    const g = group.current;
    if (g) g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
  });
  const handlers = pointerHandlers(() => ({ type: 'zone', id }), onSelect, { hover: true });
  return (
    <group ref={group} position={[(zone.x0 + zone.x1) / 2, id === 'sewing' ? 8.2 : 7.4, (zone.z0 + zone.z1) / 2]}>
      <mesh {...handlers}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial map={texture} toneMapped={false} transparent side={DoubleSide} />
      </mesh>
      {[-W / 2 + 0.4, W / 2 - 0.4].map((x) => (
        <mesh key={x} position={[x, H / 2 + 0.9, -0.01]}>
          <cylinderGeometry args={[0.02, 0.02, 1.8, 4]} />
          <meshBasicMaterial color="#8a96a3" />
        </mesh>
      ))}
    </group>
  );
}

/** A hanging sign over every zone: its name, one live figure, and whether the data is demo or locked. */
export default function ZoneSigns({ zones, onSelect }) {
  return Object.keys(ZONES).map((id) => <Sign key={id} id={id} status={zones[id]} onSelect={onSelect} />);
}
