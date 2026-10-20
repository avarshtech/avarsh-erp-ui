/**
 * Pointer handlers for pickable meshes. `selectOf(instanceId)` names what was clicked (null = not
 * pickable). Hover handlers make React Three Fiber ray-cast on every pointer move, so the big
 * instanced meshes (crowd, machines) take clicks only and the few large objects also get a cursor.
 */
export const pointerHandlers = (selectOf, onSelect, { hover = false } = {}) => {
  const handlers = {
    onClick: (event) => {
      const target = selectOf(event.instanceId);
      if (!target) return;
      event.stopPropagation();
      onSelect?.(target);
    },
  };
  if (hover) {
    handlers.onPointerOver = (event) => {
      if (!selectOf(event.instanceId)) return;
      event.stopPropagation();
      document.body.style.cursor = 'pointer';
    };
    handlers.onPointerOut = () => { document.body.style.cursor = ''; };
  }
  return handlers;
};
