import { useLayoutEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Matrix4 } from 'three';

const PUFFS = 5;
const CYCLE = 2.4;
const m = new Matrix4();

/** The puffs of every iron at time t. */
const writePuffs = (mesh, points, t) => {
  if (!mesh) return;
  points.forEach((p, i) => {
    for (let k = 0; k < PUFFS; k += 1) {
      const u = ((t / CYCLE) + k / PUFFS + i * 0.13) % 1;
      const s = 0.05 + u * 0.16;
      m.makeScale(s, s, s).setPosition(p.x + Math.sin(u * 6 + i) * 0.05, p.y + u * 0.75, p.z + Math.cos(u * 5 + k) * 0.04);
      mesh.setMatrixAt(i * PUFFS + k, m);
    }
  });
  mesh.count = points.length * PUFFS;
  mesh.instanceMatrix.needsUpdate = true;
};

/** Soft steam rising from the irons that are working: a few puffs per iron, growing as they climb. */
export default function Steam({ points, animate }) {
  const ref = useRef(null);
  const count = points.length * PUFFS;

  useLayoutEffect(() => writePuffs(ref.current, points, 0), [points, count]);
  useFrame(({ clock }) => { if (animate) writePuffs(ref.current, points, clock.elapsedTime); });

  if (!count) return null;
  return (
    <instancedMesh key={count} ref={ref} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.35} depthWrite={false} />
    </instancedMesh>
  );
}
