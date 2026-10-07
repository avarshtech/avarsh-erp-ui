import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshStandardMaterial } from 'three';
import { buildBodyGeometries, disposeBody } from './bodyParts';
import { PAIRED_PARTS, SINGLE_PARTS, writeCrowdColours, writeCrowdFrame } from './crowdFrame';
import { pointerHandlers } from '../interaction';

const PARTS = [...SINGLE_PARTS, ...PAIRED_PARTS];
const SHADOWED = new Set(['torso', 'head', 'thigh', 'shin']);
const capacityFor = (n) => 2 ** Math.max(6, Math.ceil(Math.log2(Math.max(1, n))));

/**
 * Every person on the floor in eleven instanced meshes. Poses update at `hz` (0 = still, for reduced
 * motion); clicking a worker selects what they work on.
 */
export default function WorkerCrowd({ workers, hz, shadows, onSelect }) {
  const geometries = useMemo(() => buildBodyGeometries(), []);
  const materials = useMemo(() => Object.fromEntries(PARTS.map((part) => [part, new MeshStandardMaterial({
    roughness: part === 'head' || part === 'forearm' ? 0.7 : 0.85, vertexColors: part === 'shin',
  })])), []);
  useEffect(() => () => {
    disposeBody(geometries);
    Object.values(materials).forEach((m) => m.dispose());
  }, [geometries, materials]);

  const refs = useRef({});
  const capacity = capacityFor(workers.length);
  const pending = useRef(0);

  useLayoutEffect(() => {
    writeCrowdColours(refs.current, workers);
    writeCrowdFrame(refs.current, workers, 0);
  }, [workers, capacity]);

  useFrame((state, delta) => {
    if (!hz) return;
    pending.current += delta;
    if (pending.current < 1 / hz) return;
    pending.current %= 1 / hz;
    writeCrowdFrame(refs.current, workers, state.clock.elapsedTime);
  });

  const handlers = (paired) => pointerHandlers((id) => workers[paired ? Math.floor(id / 2) : id]?.select, onSelect);

  return PARTS.map((part) => (
    <instancedMesh
      key={`${part}-${capacity}`}
      ref={(mesh) => { if (mesh) refs.current[part] = mesh; }}
      args={[geometries[part], materials[part], PAIRED_PARTS.includes(part) ? capacity * 2 : capacity]}
      castShadow={shadows && SHADOWED.has(part)}
      frustumCulled={false}
      {...(part === 'torso' || part === 'head' || part === 'thigh' ? handlers(part === 'thigh') : {})}
    />
  ));
}
