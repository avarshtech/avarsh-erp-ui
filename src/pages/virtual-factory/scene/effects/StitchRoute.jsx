import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Matrix4 } from 'three';

const PITCH = 1.1;
const STITCH = [0.7, 0.04, 0.24];
const DONE = new Color('#6366f1');
const AHEAD = new Color('#b9bff7');
const REVEAL_S = 1.6;

/** Running stitches every 1.1 m along the route; those before the order's current stop are "sewn". */
const stitchesOf = (route) => {
  if (!route) return [];
  const out = [];
  let travelled = 0;
  let reachedAt = 0;
  route.points.forEach((p, i) => {
    if (i === 0) return;
    const [ax, az] = route.points[i - 1];
    const len = Math.hypot(p[0] - ax, p[1] - az);
    if (i <= route.reached) reachedAt = travelled + len;
    for (let d = PITCH / 2; d < len; d += PITCH) {
      const f = d / len;
      out.push({ x: ax + (p[0] - ax) * f, z: az + (p[1] - az) * f, angle: Math.atan2(p[0] - ax, p[1] - az), at: travelled + d });
    }
    travelled += len;
  });
  return out.map((s) => ({ ...s, done: s.at <= reachedAt }));
};

/** The followed order's path through the factory, stitched into the floor. */
export default function StitchRoute({ route, animate }) {
  const stitches = useMemo(() => stitchesOf(route), [route]);
  const ref = useRef(null);
  const shown = useRef(0);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new Matrix4();
    stitches.forEach((s, i) => {
      mesh.setMatrixAt(i, m.makeRotationY(s.angle).setPosition(s.x, 0.05, s.z));
      mesh.setColorAt(i, s.done ? DONE : AHEAD);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    shown.current = animate ? 0 : stitches.length;
    mesh.count = shown.current;
  }, [stitches, animate]);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh || shown.current >= stitches.length) return;
    shown.current = Math.min(stitches.length, shown.current + (stitches.length / REVEAL_S) * delta);
    mesh.count = Math.floor(shown.current);
  });

  if (!stitches.length) return null;
  return (
    <instancedMesh key={stitches.length} ref={ref} args={[undefined, undefined, stitches.length]} frustumCulled={false}>
      <boxGeometry args={STITCH} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}
