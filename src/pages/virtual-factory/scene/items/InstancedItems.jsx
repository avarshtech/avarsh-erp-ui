import { useEffect, useLayoutEffect, useRef } from 'react';
import { Color } from 'three';
import { pointerHandlers } from '../interaction';

const capacityFor = (n) => 2 ** Math.max(4, Math.ceil(Math.log2(Math.max(1, n))));
const colour = new Color();

/**
 * Many copies of one geometry in one draw call. `place(item)` returns the instance matrix (use
 * `pose` from ./pose), `colourOf(item)` its tint; items with a `select` are clickable when `onSelect` is given.
 */
export default function InstancedItems({ items, geometry, material, place, colourOf, castShadow, receiveShadow, onSelect }) {
  const ref = useRef(null);
  const capacity = capacityFor(items.length);
  useLayoutEffect(() => {
    const mesh = ref.current;
    items.forEach((item, i) => {
      mesh.setMatrixAt(i, place(item));
      if (colourOf) mesh.setColorAt(i, colour.set(colourOf(item)));
    });
    mesh.count = items.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, place, colourOf, capacity]);
  useEffect(() => () => { document.body.style.cursor = ''; }, []);
  const handlers = onSelect ? pointerHandlers((id) => items[id]?.select, onSelect) : {};
  return (
    <instancedMesh key={capacity} ref={ref} args={[geometry, material, capacity]} castShadow={castShadow} receiveShadow={receiveShadow} {...handlers} />
  );
}
