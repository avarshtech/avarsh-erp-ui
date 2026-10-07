import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Matrix4, MeshBasicMaterial, MeshStandardMaterial } from 'three';
import {
  coneGeometry, fabricPieceGeometry, kajaGeometry, lampGeometry, lockstitchGeometry, overlockGeometry,
  stoolGeometry, tableStandGeometry, tableTopGeometry,
} from '../geometry/machines';
import { pointerHandlers } from '../interaction';
import { animateMachines, groupByHead, HEAD_KINDS, writeMachines } from './machineFrame';

const capacityFor = (n) => 2 ** Math.max(5, Math.ceil(Math.log2(Math.max(1, n))));
const ANIMATE_HZ = 15;

/**
 * Every sewing and buttonhole machine: table, stand, head by machine type, thread cones in the
 * order's colour, an andon lamp for its status, and fabric under the needle while it runs.
 */
export default function Machines({ machines, chairs, animate, shadows, night, onSelect }) {
  const geo = useMemo(() => ({
    lockstitch: lockstitchGeometry(), overlock: overlockGeometry(), kaja: kajaGeometry(), top: tableTopGeometry(),
    stand: tableStandGeometry(), lamp: lampGeometry(), cone: coneGeometry(), fabric: fabricPieceGeometry(), stool: stoolGeometry(),
  }), []);
  const mat = useMemo(() => ({
    head: new MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 }),
    stand: new MeshStandardMaterial({ color: '#3c434c', roughness: 0.6, metalness: 0.3 }),
    lamp: new MeshBasicMaterial({ toneMapped: false }),
    cone: new MeshStandardMaterial({ roughness: 0.8 }),
    fabric: new MeshStandardMaterial({ roughness: 0.95 }),
    stool: new MeshStandardMaterial({ color: '#2f3640', roughness: 0.7 }),
  }), []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    Object.values(mat).forEach((m) => m.dispose());
  }, [geo, mat]);

  const refs = useRef({});
  const stools = useRef(null);
  const groups = useMemo(() => groupByHead(machines), [machines]);
  const capacity = capacityFor(Math.max(machines.length, chairs.length));
  const pending = useRef(0);

  useLayoutEffect(() => {
    writeMachines(refs.current, machines, groups);
    animateMachines(refs.current, machines, null);
    const m = new Matrix4();
    chairs.forEach((c, i) => stools.current.setMatrixAt(i, m.makeRotationY(c.ry).setPosition(c.x, 0, c.z)));
    stools.current.count = chairs.length;
    stools.current.instanceMatrix.needsUpdate = true;
  }, [machines, groups, chairs, capacity, animate]);

  useFrame((state, delta) => {
    if (!animate) return;
    pending.current += delta;
    if (pending.current < 1 / ANIMATE_HZ) return;
    pending.current = 0;
    animateMachines(refs.current, machines, state.clock.elapsedTime);
  });

  const keep = (key) => (mesh) => { if (mesh) refs.current[key] = mesh; };
  const pick = (indexOf) => pointerHandlers((id) => machines[indexOf(id)]?.select, onSelect);
  const part = (key, geometry, material, count, extra = {}, children = null) => (
    <instancedMesh key={`${key}-${capacity}`} ref={keep(key)} args={[geometry, material, count]} frustumCulled={false} {...extra}>
      {children}
    </instancedMesh>
  );

  return (
    <group>
      {part('top', geo.top, undefined, capacity, { receiveShadow: true, ...pick((id) => id) },
        <meshStandardMaterial color={night ? '#8f8a80' : '#d8d2c4'} roughness={0.7} />)}
      {part('stand', geo.stand, mat.stand, capacity, { castShadow: shadows })}
      {HEAD_KINDS.map((kind) => part(kind, geo[kind], mat.head, capacity, { castShadow: shadows, ...pick((id) => groups[kind][id]) }))}
      {part('lamp', geo.lamp, mat.lamp, capacity)}
      {part('cone', geo.cone, mat.cone, capacity * 2)}
      {part('fabric', geo.fabric, mat.fabric, capacity)}
      <instancedMesh key={`stool-${capacity}`} ref={stools} args={[geo.stool, mat.stool, capacity]} frustumCulled={false} castShadow={shadows} />
    </group>
  );
}
