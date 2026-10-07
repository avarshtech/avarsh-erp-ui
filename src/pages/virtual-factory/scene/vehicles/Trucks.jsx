import { createRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RECEIVING_DOORS, SHIPPING_DOORS } from '../../engine/layout';
import { truckGeometries, vanGeometries } from '../geometry/vehicles';
import { pointerHandlers } from '../interaction';
import LabelLayer from '../labels/LabelLayer';
import TruckBody from './TruckBody';
import { LIVERY } from './livery';

/** Where a parked vehicle stands: its rear against the dock leveller, nose out. */
const parkedAt = (truck) => {
  if (truck.kind === 'van') return { x: 30, z: 41.5, heading: Math.PI / 2 };
  if (truck.kind === 'supplier') return { x: -67.2, z: RECEIVING_DOORS[truck.door % RECEIVING_DOORS.length], heading: -Math.PI / 2 };
  return { x: 67.2, z: SHIPPING_DOORS[truck.door % SHIPPING_DOORS.length], heading: Math.PI / 2 };
};

/** Trucks on the way: driving east along the front road toward the gate, then starting again. */
const TRANSIT = { from: -250, to: -96, z: 50, seconds: 26 };

function Truck({ truck, geometries, shadows, animate, onSelect, objectRef }) {
  const transit = truck.state === 'transit';
  const spot = transit ? null : parkedAt(truck);
  useFrame(({ clock }) => {
    if (!transit || !objectRef.current) return;
    const u = animate ? ((clock.elapsedTime + truck.door * 11) % TRANSIT.seconds) / TRANSIT.seconds : 0.85;
    objectRef.current.position.x = TRANSIT.from + (TRANSIT.to - TRANSIT.from) * u;
  });
  const handlers = pointerHandlers(() => truck.select, onSelect, { hover: true });
  return (
    <group ref={objectRef} position={transit ? [TRANSIT.from, 0, TRANSIT.z - 2 + truck.door * 4] : [spot.x, 0, spot.z]} rotation-y={transit ? Math.PI / 2 : spot.heading}>
      <TruckBody geometries={geometries[truck.kind === 'van' ? 'van' : 'truck']} livery={LIVERY[truck.kind] || LIVERY.dispatch} shadows={shadows} handlers={handlers} />
    </group>
  );
}

/** Supplier trucks at receiving or on their way, dispatch trucks loading at shipping, process vans. */
export default function Trucks({ trucks, shadows, animate, labelsRef, onSelect }) {
  const geometries = useMemo(() => ({ truck: truckGeometries(), van: vanGeometries() }), []);
  useEffect(() => () => Object.values(geometries).forEach((set) => Object.values(set).forEach((g) => g?.dispose())), [geometries]);
  const keys = JSON.stringify(trucks.map((t) => t.key));
  const objects = useMemo(() => new Map(JSON.parse(keys).map((key) => [key, createRef()])), [keys]);
  const labels = useMemo(() => trucks.map((t) => ({
    key: `truck-${t.key}`, object: objects.get(t.key), lift: t.kind === 'van' ? 3 : 4.6, range: 150,
    tone: t.kind === 'dispatch' ? 'primary' : 'neutral', title: t.label, text: [t.plate, t.sub].filter(Boolean).join(' · '),
  })), [trucks, objects]);
  return (
    <group>
      {trucks.map((t) => <Truck key={t.key} truck={t} geometries={geometries} shadows={shadows} animate={animate} onSelect={onSelect} objectRef={objects.get(t.key)} />)}
      <LabelLayer containerRef={labelsRef} labels={labels} />
    </group>
  );
}
