import { useCallback, useState } from 'react';
import { zoneCentre } from '../engine/layout';
import { buildJourney } from '../engine/orderJourney';
import { targetPosition } from '../scene/targets';

/**
 * What the viewer is looking at: a selected thing (inspector) or a followed order (journey), and
 * the camera flights that take them there when they pick something from a list. The latest
 * snapshot and scene model are read through refs, only inside the handlers.
 */
export const useFocus = ({ snapshotRef, modelRef, cameraApi }) => {
  const [selection, setSelection] = useState(null);
  const [followed, setFollowed] = useState(null);

  const fly = useCallback((x, z, distance) => cameraApi.current?.flyTo(x, z, distance), [cameraApi]);

  const follow = useCallback((orderNo) => {
    setFollowed(orderNo);
    setSelection(null);
    const journey = snapshotRef.current && orderNo ? buildJourney(snapshotRef.current, orderNo) : null;
    if (journey) {
      const [x, , z] = zoneCentre(journey.currentZone);
      fly(x, z, 60);
    }
  }, [snapshotRef, fly]);

  /** Picked from a list: select it (or follow it, for an order) and fly the camera there. */
  const focus = useCallback((target) => {
    if (!target) return;
    if (target.type === 'order') {
      follow(target.id);
      return;
    }
    setSelection(target);
    const at = modelRef.current ? targetPosition(target, modelRef.current) : null;
    if (at) fly(at.x, at.z, at.distance);
    else if (target.type === 'zone') {
      const [x, , z] = zoneCentre(target.id);
      fly(x, z, 52);
    }
  }, [modelRef, fly, follow]);

  /** Clicked in the scene: select without moving the camera (orders are followed). */
  const select = useCallback((target) => {
    if (target?.type === 'order') follow(target.id);
    else setSelection(target);
  }, [follow]);

  const unfollow = useCallback(() => setFollowed(null), []);
  const clear = useCallback(() => setSelection(null), []);
  return { selection, followed, select, focus, follow, unfollow, clear, fly };
};
