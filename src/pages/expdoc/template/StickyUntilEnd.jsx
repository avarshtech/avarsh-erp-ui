import { useEffect, useRef, useState } from 'react';

/** The nearest ancestor that scrolls vertically (a drawer's body), or null for the window. */
const scrollParentOf = (el) => {
  for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node;
  }
  return null;
};

/**
 * Keeps a tall panel beside a longer column in view: it scrolls along until its own end
 * is on screen, then stays there while the other column scrolls on. A panel shorter
 * than the screen simply sticks at the top. Needs a parent as tall as the row (a
 * stretched column) to travel in.
 */
const StickyUntilEnd = ({ children, gap = 16 }) => {
  const ref = useRef(null);
  const [top, setTop] = useState(gap);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const scroller = scrollParentOf(el);
    const update = () => {
      const view = scroller ? scroller.clientHeight : window.innerHeight;
      setTop(Math.min(gap, view - el.offsetHeight - gap));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    if (scroller) observer.observe(scroller);
    return () => observer.disconnect();
  }, [gap]);

  return <div ref={ref} style={{ position: 'sticky', top }}>{children}</div>;
};

export default StickyUntilEnd;
