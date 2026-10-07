import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { pointerHandlers } from '../interaction';
import LabelLayer from '../labels/LabelLayer';

const COLOUR = { high: '#ef4444', medium: '#f59e0b' };

function Beacon({ beacon, animate, onSelect }) {
  const gem = useRef(null);
  const ring = useRef(null);
  useFrame(({ clock }) => {
    if (!animate || !gem.current) return;
    const t = clock.elapsedTime;
    gem.current.rotation.y = t * 1.2;
    gem.current.position.y = 0.25 * Math.sin(t * 2);
    const s = 1 + 0.35 * ((t * 0.8) % 1);
    ring.current.scale.set(s, s, s);
    ring.current.material.opacity = 0.45 * (1 - ((t * 0.8) % 1));
  });
  const colour = COLOUR[beacon.severity] || COLOUR.medium;
  const handlers = pointerHandlers(() => beacon.target, onSelect, { hover: true });
  return (
    <group position={[beacon.x, 0, beacon.z]}>
      <group position={[0, beacon.y, 0]}>
        <mesh ref={gem} {...handlers}>
          <octahedronGeometry args={[0.55, 0]} />
          <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
      </group>
      <mesh position={[0, beacon.y / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.06, beacon.y, 6]} />
        <meshBasicMaterial color={colour} transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh ref={ring} position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[1.1, 1.4, 32]} />
        <meshBasicMaterial color={colour} transparent opacity={0.4} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A beacon over every zone or line that needs attention, with its headline as a label. */
export default function Beacons({ beacons, animate, labelsRef, onSelect }) {
  const labels = useMemo(() => beacons.map((b) => ({
    key: `beacon-${b.key}`, x: b.x, y: b.y + 1.1, z: b.z, tone: b.severity, title: `⚠ ${b.title}`, text: b.text, range: 240,
  })), [beacons]);
  return (
    <group>
      {beacons.map((b) => <Beacon key={b.key} beacon={b} animate={animate} onSelect={onSelect} />)}
      <LabelLayer containerRef={labelsRef} labels={labels} />
    </group>
  );
}
