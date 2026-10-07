import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hashString } from '../../engine/util';
import { ambientMover, moverFromEvent } from './moverSpecs';

const AMBIENT_EVERY_MS = 8000;
const MAX_AMBIENT = 4;
const MAX_ACTIVE = 12;

/**
 * What is moving: one mover per new ERP event (events already listed when the screen opened are
 * history, not news), plus calm everyday traffic every few seconds. A mover leaves when its path ends.
 */
export const useMoverQueue = ({ events, model, ambient }) => {
  const [initialIds] = useState(() => new Set(events.map((e) => e.id)));
  const [done, setDone] = useState(() => new Set());
  const [traffic, setTraffic] = useState([]);
  const modelRef = useRef(model);
  useEffect(() => { modelRef.current = model; }, [model]);

  const fromEvents = useMemo(() => events
    .filter((e) => !initialIds.has(e.id))
    .map((e) => moverFromEvent(e, model, hashString(e.id)))
    .filter(Boolean), [events, initialIds, model]);

  useEffect(() => {
    if (!ambient) return undefined;
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      const spec = ambientMover(modelRef.current, n);
      if (spec) setTraffic((list) => [...list, spec].slice(-MAX_AMBIENT));
    }, AMBIENT_EVERY_MS);
    return () => clearInterval(timer);
  }, [ambient]);

  const remove = useCallback((id) => setDone((set) => new Set(set).add(id)), []);
  const movers = useMemo(() => [...fromEvents, ...traffic].filter((m) => !done.has(m.id)).slice(-MAX_ACTIVE), [fromEvents, traffic, done]);
  return { movers, remove };
};
