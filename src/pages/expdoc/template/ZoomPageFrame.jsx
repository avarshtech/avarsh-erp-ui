import { useEffect, useRef, useState } from 'react';
import { Button, Space, Tooltip } from 'antd';
import { CompressOutlined, MinusOutlined, PlusOutlined } from '@ant-design/icons';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 3;
const STEP = 1.15;
const TOOL = { color: '#333' };

const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

/** Centred on an axis where the page is smaller than the window; otherwise kept covering it. */
const clampAxis = (pos, content, space) => (content <= space
  ? (space - content) / 2
  : Math.min(0, Math.max(space - content, pos)));

/**
 * The printed page in a fixed window, the way a PDF viewer shows it: it opens fitted
 * whole, the mouse wheel zooms about the pointer, dragging moves the page, and the
 * toolbar zooms or fits it again. Beside the layout editor this replaces scrolling —
 * a change is seen at once, wherever it is on the page. The page is laid out at the
 * paper's width, so zooming never re-flows it.
 */
const ZoomPageFrame = ({
  html, title, pageWidthPx, height,
}) => {
  const boxRef = useRef(null);
  const layerRef = useRef(null);
  const frameObserver = useRef(null);
  const drag = useRef(null);
  const latest = useRef(null);
  const [page, setPage] = useState({ width: pageWidthPx || 794, height: 1123 });
  const [box, setBox] = useState({ width: 0, height: 0 });
  // The user's zoom and position; null keeps the page fitted as the window and page change.
  const [view, setView] = useState(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setBox({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => frameObserver.current?.disconnect(), []);

  const fitZoom = box.width && page.height ? Math.min(1, box.width / page.width, box.height / page.height) : 1;
  const place = (v) => ({
    zoom: v.zoom,
    x: clampAxis(v.x, page.width * v.zoom, box.width),
    y: clampAxis(v.y, page.height * v.zoom, box.height),
  });
  const current = place(view || { zoom: fitZoom, x: 0, y: 0 });

  // The wheel listener is attached once (it must not be passive to stop the scroll), so
  // it reads the view through this ref.
  useEffect(() => { latest.current = current; });
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return undefined;
    const onWheel = (e) => {
      const cur = latest.current;
      if (!cur) return;
      e.preventDefault();
      const rect = layer.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const zoom = clampZoom(cur.zoom * (e.deltaY < 0 ? STEP : 1 / STEP));
      const k = zoom / cur.zoom;
      setView({ zoom, x: px - (px - cur.x) * k, y: py - (py - cur.y) * k });
    };
    layer.addEventListener('wheel', onWheel, { passive: false });
    return () => layer.removeEventListener('wheel', onWheel);
  }, []);

  const zoomBy = (factor) => {
    const cx = box.width / 2;
    const cy = box.height / 2;
    const zoom = clampZoom(current.zoom * factor);
    const k = zoom / current.zoom;
    setView({ zoom, x: cx - (cx - current.x) * k, y: cy - (cy - current.y) * k });
  };

  const onLoad = (e) => {
    const frame = e.currentTarget;
    const body = frame.contentDocument?.body;
    if (!body) return;
    const measure = () => setPage({ width: Math.max(pageWidthPx || 0, body.scrollWidth), height: body.scrollHeight });
    measure();
    frameObserver.current?.disconnect();
    const Observer = frame.contentWindow?.ResizeObserver;
    if (Observer) {
      frameObserver.current = new Observer(measure);
      frameObserver.current.observe(body);
    }
  };

  return (
    <div ref={boxRef} style={{ position: 'relative', height, overflow: 'hidden', background: '#7a7a7a', borderRadius: 8 }}>
      <iframe
        title={title}
        srcDoc={html}
        scrolling="no"
        tabIndex={-1}
        onLoad={onLoad}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          border: 0,
          background: '#fff',
          width: page.width,
          height: page.height,
          transform: `translate(${current.x}px, ${current.y}px) scale(${current.zoom})`,
          transformOrigin: '0 0',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.35)',
          pointerEvents: 'none',
        }}
      />
      <div
        ref={layerRef}
        role="presentation"
        style={{ position: 'absolute', inset: 0, cursor: dragging ? 'grabbing' : 'grab', touchAction: 'none' }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, y: e.clientY, from: current };
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setView({ zoom: d.from.zoom, x: d.from.x + (e.clientX - d.x), y: d.from.y + (e.clientY - d.y) });
        }}
        onPointerUp={() => { drag.current = null; setDragging(false); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
      />
      <Space
        size={2}
        style={{
          position: 'absolute', right: 10, bottom: 10, padding: '2px 4px', borderRadius: 8,
          background: 'rgba(255, 255, 255, 0.94)', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        }}
      >
        <Tooltip title="Zoom out">
          <Button size="small" type="text" style={TOOL} icon={<MinusOutlined />} aria-label="Zoom out" onClick={() => zoomBy(1 / STEP)} />
        </Tooltip>
        <span aria-live="polite" style={{ ...TOOL, minWidth: 42, textAlign: 'center', fontSize: 12 }}>
          {`${Math.round(current.zoom * 100)}%`}
        </span>
        <Tooltip title="Zoom in">
          <Button size="small" type="text" style={TOOL} icon={<PlusOutlined />} aria-label="Zoom in" onClick={() => zoomBy(STEP)} />
        </Tooltip>
        <Tooltip title="Show the whole page">
          <Button size="small" type="text" style={TOOL} icon={<CompressOutlined />} onClick={() => setView(null)}>Fit</Button>
        </Tooltip>
      </Space>
    </div>
  );
};

export default ZoomPageFrame;
