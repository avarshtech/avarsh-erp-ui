import { useCallback, useEffect, useRef, useState } from 'react';

const KEY = 'laya-panel-position';
const MARGIN = 8;
const HEADER = 48;
const MOBILE = 576;

const read = () => {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
  } catch {
    return null;
  }
};
const save = (p) => {
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the panel still moves, it just is not remembered.
  }
};

/**
 * Lets the chat panel be dragged by its header anywhere in the window, and remembers where it was
 * left (in this browser). No position means the usual place, just above its button. It stays inside
 * the window when the window shrinks; a double-click on the header puts it back. Phones keep it
 * full width, not draggable.
 */
export default function useFloatingPanel(ref) {
  const [pos, setPos] = useState(read);
  const posRef = useRef(pos);
  const drag = useRef(null);
  useEffect(() => { posRef.current = pos; }, [pos]);

  const clamp = useCallback((p) => {
    const el = ref.current;
    if (!p || !el) return p;
    const { width } = el.getBoundingClientRect();
    return {
      x: Math.round(Math.min(Math.max(MARGIN, p.x), window.innerWidth - width - MARGIN)),
      y: Math.round(Math.min(Math.max(MARGIN, p.y), window.innerHeight - HEADER - MARGIN)),
    };
  }, [ref]);

  useEffect(() => {
    const fit = () => setPos((p) => clamp(p));
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [clamp]);

  const onPointerDown = (e) => {
    if (e.button !== 0 || window.innerWidth < MOBILE || e.target.closest('button, a, input, textarea')) return;
    const rect = ref.current.getBoundingClientRect();
    drag.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (drag.current) setPos(clamp({ x: e.clientX - drag.current.dx, y: e.clientY - drag.current.dy }));
  };
  const onPointerUp = (e) => {
    if (!drag.current) return;
    drag.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    save(posRef.current);
  };
  const reset = () => { setPos(null); save(null); };

  const placed = pos && window.innerWidth >= MOBILE;
  return {
    style: placed ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : undefined,
    handle: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onDoubleClick: reset },
  };
}
