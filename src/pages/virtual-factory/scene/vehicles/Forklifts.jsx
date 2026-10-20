import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { walkerAt } from '../crowd/motion';
import { forkliftGeometries } from '../geometry/vehicles';

function Forklift({ driver, geometries, shadows, animate }) {
  const ref = useRef(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const at = walkerAt(driver, animate ? clock.elapsedTime : 0);
    ref.current.position.set(at.x, 0, at.z);
    ref.current.rotation.y = at.heading;
  });
  return (
    <group ref={ref} position={[driver.x, 0, driver.z]}>
      <mesh geometry={geometries.body} castShadow={shadows}>
        <meshStandardMaterial color="#f2b705" roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh geometry={geometries.gear} castShadow={shadows}>
        <meshStandardMaterial color="#2b3038" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.32, 1.45]} castShadow={shadows}>
        <boxGeometry args={[1.1, 0.5, 0.95]} />
        <meshStandardMaterial color="#c99d6b" roughness={0.85} />
      </mesh>
    </group>
  );
}

/** Forklifts drive the same path as their seated driver, so the two never part company. */
export default function Forklifts({ workers, shadows, animate }) {
  const geometries = useMemo(() => forkliftGeometries(), []);
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries]);
  const drivers = useMemo(() => workers.filter((w) => w.vehicle === 'forklift' && w.path), [workers]);
  return drivers.map((d) => <Forklift key={d.key} driver={d} geometries={geometries} shadows={shadows} animate={animate} />);
}
