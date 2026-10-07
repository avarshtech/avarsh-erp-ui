import { createRef, useEffect, useMemo } from 'react';
import LabelLayer from '../labels/LabelLayer';
import Mover from './Mover';
import { buildMoverGeometries, disposeMoverGeometries } from './moverGeometry';
import { useMoverQueue } from './useMoverQueue';

const LIFT = { doc: 1.2, truck: 4.9, van: 3, forklift: 2.6, cart: 1.6, pulse: 1 };

/** ERP events turned into movement — documents, carts, forklifts and trucks — with a label each. */
export default function Movers({ events, model, ambient, shadows, labelsRef }) {
  const geometries = useMemo(() => buildMoverGeometries(), []);
  useEffect(() => () => disposeMoverGeometries(geometries), [geometries]);
  const { movers, remove } = useMoverQueue({ events, model, ambient });

  const keys = JSON.stringify(movers.map((m) => m.id));
  const objects = useMemo(() => new Map(JSON.parse(keys).map((key) => [key, createRef()])), [keys]);
  const labels = useMemo(() => movers.filter((m) => m.label).map((m) => ({
    key: `mover-${m.id}`, object: objects.get(m.id), lift: LIFT[m.kind] || 1.5, range: 260, ...m.label,
  })), [movers, objects]);

  return (
    <group>
      {movers.map((m) => <Mover key={m.id} spec={m} geometries={geometries} shadows={shadows} objectRef={objects.get(m.id)} onDone={remove} />)}
      <LabelLayer containerRef={labelsRef} labels={labels} />
    </group>
  );
}
