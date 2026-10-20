import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { beginFrame, claim, FALLBACK_SIZE, fillLabel, measure } from './labelDom';

const point = new Vector3();
const DEFAULT_RANGE = 190;

/**
 * Plain DOM labels pinned to points in the scene (trucks, beacons, moving loads), so text stays sharp
 * at any zoom. A label follows `object` (a ref to a moving 3D object) or sits at x/y/z; it hides when
 * behind the camera, off screen, farther than its range, or under a label already shown.
 * Text is set with textContent only.
 */
export default function LabelLayer({ containerRef, labels }) {
  const nodes = useRef(new Map());
  const sizes = useRef(new Map());

  useEffect(() => {
    const host = containerRef.current;
    if (!host) return;
    const map = nodes.current;
    const live = new Set(labels.map((l) => l.key));
    map.forEach((el, key) => {
      if (live.has(key)) return;
      el.remove();
      map.delete(key);
      sizes.current.delete(key);
    });
    labels.forEach((label) => {
      let el = map.get(label.key);
      if (!el) {
        el = document.createElement('div');
        el.className = 'vf-label';
        host.appendChild(el);
        map.set(label.key, el);
      }
      fillLabel(el, label);
      sizes.current.set(label.key, measure(el));
    });
  }, [labels, containerRef]);

  useEffect(() => {
    const map = nodes.current;
    return () => {
      map.forEach((el) => el.remove());
      map.clear();
    };
  }, []);

  useFrame(({ camera, size, clock }) => {
    beginFrame(clock.elapsedTime);
    labels.forEach((label) => {
      const el = nodes.current.get(label.key);
      if (!el) return;
      const object = label.object?.current;
      if (label.object && !object) {
        el.style.display = 'none';
        return;
      }
      if (object) {
        object.getWorldPosition(point);
        point.y += label.lift || 0;
      } else point.set(label.x, label.y, label.z);
      const far = camera.position.distanceTo(point) > (label.range || DEFAULT_RANGE);
      point.project(camera);
      const x = ((point.x + 1) / 2) * size.width;
      const y = ((1 - point.y) / 2) * size.height;
      const { w, h } = sizes.current.get(label.key) || FALLBACK_SIZE;
      const visible = !far && point.z < 1 && Math.abs(point.x) < 1.05 && Math.abs(point.y) < 1.05
        && claim({ x0: x - w / 2, x1: x + w / 2, y0: y - h, y1: y });
      el.style.display = visible ? '' : 'none';
      if (visible) el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    });
  });
  return null;
}
