import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Matrix4 } from 'three';
import { ROADS, YARD } from '../../engine/layout';
import { box, cylinder, merge, tint } from '../geometry/merge';

const TREES = [
  [-100, -40], [-100, -12], [-100, 18], [-104, 34], [-72, 62], [-40, 64], [-6, 62], [30, 64], [62, 62],
  [100, -30], [102, -4], [100, 22], [104, 38], [-60, -58], [-20, -60], [20, -58], [60, -60],
];
const treeGeometry = () => merge([tint(cylinder(0.25, 0.32, 2.2, [0, 1.1, 0], [0, 0, 0], 8), 0.42), tint(cylinder(0, 2.4, 5.2, [0, 4.6, 0], [0, 0, 0], 9), 1)]);

/** Land around the factory: ground, the paved yard, the roads and a few trees for scale. */
export default function Ground({ night }) {
  const trees = useRef(null);
  const geometry = useMemo(() => treeGeometry(), []);
  useLayoutEffect(() => {
    const m = new Matrix4();
    TREES.forEach(([x, z], i) => trees.current.setMatrixAt(i, m.makeScale(1, 0.85 + (i % 4) * 0.12, 1).setPosition(x, 0, z)));
    trees.current.instanceMatrix.needsUpdate = true;
  }, []);
  const dashes = useMemo(() => merge(Array.from({ length: 52 }, (_, i) => box(4, 0.01, 0.25, [-255 + i * 10, -0.02, 50]))), []);
  useEffect(() => () => {
    geometry.dispose();
    dashes.dispose();
  }, [geometry, dashes]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color={night ? '#121a16' : '#d5ddd3'} roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[(YARD.x0 + YARD.x1) / 2, -0.045, (YARD.z0 + YARD.z1) / 2]} receiveShadow>
        <planeGeometry args={[YARD.x1 - YARD.x0, YARD.z1 - YARD.z0]} />
        <meshStandardMaterial color={night ? '#1c2228' : '#c3c9cf'} roughness={0.95} />
      </mesh>
      {ROADS.map((r) => (
        <mesh key={`${r.x0}-${r.z0}`} rotation-x={-Math.PI / 2} position={[(r.x0 + r.x1) / 2, -0.035, (r.z0 + r.z1) / 2]} receiveShadow>
          <planeGeometry args={[r.x1 - r.x0, r.z1 - r.z0]} />
          <meshStandardMaterial color={night ? '#191d22' : '#5a6068'} roughness={0.9} />
        </mesh>
      ))}
      <mesh geometry={dashes}>
        <meshBasicMaterial color={night ? '#6d6a5e' : '#eee9d8'} />
      </mesh>
      <instancedMesh ref={trees} args={[geometry, undefined, TREES.length]} castShadow>
        <meshStandardMaterial color={night ? '#1f3326' : '#7ea37a'} roughness={0.9} flatShading vertexColors />
      </instancedMesh>
    </group>
  );
}
