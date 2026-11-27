/**
 * "Select Element" mode: outlines whatever is under the pointer and captures the next click as the
 * element with the problem. Active only between startElementPicker() and the pick / Esc; while active,
 * the click is swallowed so the ERP button or link underneath does not fire.
 */
import { IGNORE_ATTR } from '../../services/feedback/screenshot';

const OVERLAY_Z = 2147483000;
const SWALLOWED = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu'];

function createNode(styles, text) {
  const node = document.createElement('div');
  node.setAttribute(IGNORE_ATTR, '');
  node.setAttribute('aria-hidden', 'true');
  Object.assign(node.style, { position: 'fixed', pointerEvents: 'none', zIndex: String(OVERLAY_Z), ...styles });
  if (text) node.textContent = text;
  document.body.appendChild(node);
  return node;
}

const isWidgetNode = (target) => !(target instanceof Element) || Boolean(target.closest(`[${IGNORE_ATTR}]`));

/**
 * @param {{ onPick: (element: Element) => void, onCancel: () => void }} handlers
 * @returns {() => void} stops the picker without picking
 */
export function startElementPicker({ onPick, onCancel }) {
  const highlight = createNode({
    border: '2px solid #fa541c',
    background: 'rgba(250, 84, 28, 0.10)',
    borderRadius: '3px',
    display: 'none',
    transition: 'all 60ms ease-out',
  });
  const banner = createNode({
    top: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '8px 16px',
    borderRadius: '6px',
    background: 'rgba(0, 0, 0, 0.82)',
    color: '#fff',
    font: '500 14px/1.4 system-ui, sans-serif',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
  }, 'Click the part of the screen that has the problem · Esc to cancel');
  const previousCursor = document.documentElement.style.cursor;
  document.documentElement.style.cursor = 'crosshair';

  let current = null;
  let done = false;

  const onMove = (event) => {
    const target = event.target;
    if (isWidgetNode(target) || target === document.documentElement || target === document.body) {
      highlight.style.display = 'none';
      current = null;
      return;
    }
    current = target;
    const r = target.getBoundingClientRect();
    Object.assign(highlight.style, {
      display: 'block',
      left: `${r.left - 2}px`,
      top: `${r.top - 2}px`,
      width: `${r.width + 4}px`,
      height: `${r.height + 4}px`,
    });
  };

  const swallow = (event) => {
    if (isWidgetNode(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    // Touch screens have no hover: the tap itself chooses the element.
    if (event.type === 'pointerdown') onMove(event);
    if (event.type === 'click' && current) {
      const picked = current;
      stop();
      onPick(picked);
    }
  };

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      stop();
      onCancel();
    }
  };

  function stop() {
    if (done) return;
    done = true;
    document.removeEventListener('mousemove', onMove, true);
    SWALLOWED.forEach((type) => document.removeEventListener(type, swallow, true));
    document.removeEventListener('keydown', onKey, true);
    highlight.remove();
    banner.remove();
    document.documentElement.style.cursor = previousCursor;
  }

  document.addEventListener('mousemove', onMove, true);
  SWALLOWED.forEach((type) => document.addEventListener(type, swallow, true));
  document.addEventListener('keydown', onKey, true);
  return stop;
}
