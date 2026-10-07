import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

/** A soft pulsing ring on the floor under whatever is selected. */
export default function SelectionRing({ target, animate }) {
  const ring = useRef(null);
  useFrame(({ clock }) => {
    if (!ring.current || !animate) return;
    const s = 1 + 0.06 * Math.sin(clock.elapsedTime * 3.2);
    ring.current.scale.set(s, s, s);
  });
  if (!target) return null;
  return (
    <mesh ref={ring} position={[target.x, 0.05, target.z]} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[target.radius, target.radius + Math.max(0.12, target.radius * 0.08), 48]} />
      <meshBasicMaterial color="#6366f1" transparent opacity={0.85} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
