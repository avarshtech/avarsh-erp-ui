import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide } from 'three';
import { docTexture } from '../geometry/textures';
import TruckBody from '../vehicles/TruckBody';
import { LIVERY } from '../vehicles/livery';
import { followPath } from './pathFollow';

const LOAD_COLOUR = { cartons: '#c99d6b', rolls: '#e6dcc4', garments: '#d7dce3', bundles: '#9aa3b5' };

function Load({ geometries, payload, lift = 0 }) {
  if (!payload) return null;
  return (
    <mesh geometry={geometries.loads[payload.kind]} position={[0, lift, 0]} castShadow>
      <meshStandardMaterial color={payload.colour || LOAD_COLOUR[payload.kind]} roughness={0.9} />
    </mesh>
  );
}

function Doc({ event }) {
  const texture = useMemo(() => docTexture(event), [event]);
  useEffect(() => () => texture.dispose(), [texture]);
  const card = useRef(null);
  useFrame(({ camera }) => card.current?.quaternion.copy(camera.quaternion));
  return (
    <mesh ref={card}>
      <planeGeometry args={[2.4, 1.5]} />
      <meshBasicMaterial map={texture} toneMapped={false} side={DoubleSide} transparent />
    </mesh>
  );
}

function Pulse({ colour, elapsedRef }) {
  const ring = useRef(null);
  useFrame(() => {
    const u = Math.min(1, (elapsedRef.current % 1.6) / 1.6);
    ring.current?.scale.setScalar(1 + u * 6);
    if (ring.current) ring.current.material.opacity = 0.55 * (1 - u);
  });
  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2}>
      <ringGeometry args={[0.9, 1.15, 40]} />
      <meshBasicMaterial color={colour} transparent opacity={0.5} depthWrite={false} />
    </mesh>
  );
}

/** One moving thing: follows its path, then tells the parent it is done. */
export default function Mover({ spec, geometries, shadows, objectRef, onDone }) {
  const start = useRef(null);
  const elapsed = useRef(0);
  const finished = useRef(false);
  useFrame(({ clock }) => {
    if (start.current == null) start.current = clock.elapsedTime;
    elapsed.current = clock.elapsedTime - start.current;
    const at = followPath(spec, elapsed.current);
    if (at.done) {
      if (!finished.current) onDone(spec.id);
      finished.current = true;
      return;
    }
    const g = objectRef.current;
    if (!g) return;
    g.position.set(at.x, at.y, at.z);
    if (spec.kind !== 'doc') g.rotation.y = at.heading;
  });
  const [x, y, z] = spec.path[0];
  return (
    <group ref={objectRef} position={[x, y, z]}>
      {spec.kind === 'cart' && (
        <>
          <mesh geometry={geometries.cart} castShadow={shadows}><meshStandardMaterial color="#3c4652" roughness={0.6} /></mesh>
          <Load geometries={geometries} payload={spec.payload} />
        </>
      )}
      {spec.kind === 'forklift' && (
        <>
          <mesh geometry={geometries.forklift.body} castShadow={shadows}><meshStandardMaterial color="#f2b705" roughness={0.45} /></mesh>
          <mesh geometry={geometries.forklift.gear} castShadow={shadows}><meshStandardMaterial color="#2b3038" roughness={0.6} /></mesh>
          <group position={[0, -0.25, 1.45]} rotation-y={Math.PI / 2}><Load geometries={geometries} payload={spec.payload} /></group>
        </>
      )}
      {(spec.kind === 'truck' || spec.kind === 'van') && (
        <TruckBody geometries={geometries[spec.kind]} livery={LIVERY[spec.kind === 'van' ? 'van' : spec.livery]} shadows={shadows} />
      )}
      {spec.kind === 'doc' && <Doc event={spec.doc} />}
      {spec.kind === 'pulse' && <Pulse colour={spec.colour} elapsedRef={elapsed} />}
    </group>
  );
}
