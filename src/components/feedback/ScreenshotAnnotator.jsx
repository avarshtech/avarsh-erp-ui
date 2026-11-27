import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button, Input, Segmented, Space, Tooltip } from 'antd';
import { ArrowUpOutlined, BorderOutlined, FontSizeOutlined, UndoOutlined, ClearOutlined } from '@ant-design/icons';
import { drawAnnotations, isMeaningful, toImagePoint } from './annotationDrawing';
import { canvasToUploadBlob } from '../../services/feedback/screenshot';

const TOOLS = [
  { value: 'arrow', label: 'Arrow', icon: <ArrowUpOutlined /> },
  { value: 'rect', label: 'Box', icon: <BorderOutlined /> },
  { value: 'text', label: 'Text', icon: <FontSizeOutlined /> },
];

/**
 * Draw arrows, boxes and labels on the screenshot. The parent reads the result through `ref`:
 * `ref.current.toBlob()` gives the annotated image, `ref.current.hasEdits()` whether there is any.
 */
const ScreenshotAnnotator = ({ src, initialShapes = [], ref }) => {
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const [shapes, setShapes] = useState(initialShapes);
  const [draft, setDraft] = useState(null);
  const [tool, setTool] = useState('arrow');
  const [label, setLabel] = useState('Problem here');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || !canvasRef.current) return;
      canvasRef.current.width = image.naturalWidth;
      canvasRef.current.height = image.naturalHeight;
      imageRef.current = image;
      setReady(true);
    };
    image.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (ready) drawAnnotations(canvasRef.current, imageRef.current, draft ? [...shapes, draft] : shapes);
  }, [ready, shapes, draft]);

  useImperativeHandle(ref, () => ({
    hasEdits: () => shapes.length > 0,
    toBlob: () => canvasToUploadBlob(canvasRef.current),
  }), [shapes]);

  // The shape being drawn lives in a ref as well as in state: pointer events can arrive faster than
  // React re-renders, and a handler reading state would see the shape as it was one event ago.
  const draftRef = useRef(null);
  const updateDraft = useCallback((next) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  const onPointerDown = useCallback((event) => {
    if (!ready) return;
    const { x, y } = toImagePoint(canvasRef.current, event);
    if (tool === 'text') {
      if (label.trim()) setShapes((prev) => [...prev, { type: 'text', x, y, text: label.trim().slice(0, 60) }]);
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    updateDraft(tool === 'rect' ? { type: 'rect', x, y, w: 0, h: 0 } : { type: 'arrow', x1: x, y1: y, x2: x, y2: y });
  }, [ready, tool, label, updateDraft]);

  const onPointerMove = useCallback((event) => {
    const d = draftRef.current;
    if (!d) return;
    const { x, y } = toImagePoint(canvasRef.current, event);
    updateDraft(d.type === 'rect' ? { ...d, w: x - d.x, h: y - d.y } : { ...d, x2: x, y2: y });
  }, [updateDraft]);

  const onPointerUp = useCallback(() => {
    const d = draftRef.current;
    if (!d) return;
    updateDraft(null);
    if (isMeaningful(d)) setShapes((prev) => [...prev, d]);
  }, [updateDraft]);

  return (
    <div className="feedback-annotator">
      <Space wrap size="small" className="feedback-annotator-toolbar">
        <Segmented
          size="small"
          value={tool}
          onChange={setTool}
          options={TOOLS.map((t) => ({ value: t.value, label: t.label, icon: t.icon }))}
          aria-label="Annotation tool"
        />
        {tool === 'text' && (
          <Input
            size="small"
            name="feedback-annotation-text"
            aria-label="Label text"
            value={label}
            maxLength={60}
            onChange={(e) => setLabel(e.target.value)}
            className="feedback-annotator-label"
          />
        )}
        <Tooltip title="Undo">
          <Button size="small" icon={<UndoOutlined />} aria-label="Undo last mark"
            disabled={shapes.length === 0} onClick={() => setShapes((prev) => prev.slice(0, -1))} />
        </Tooltip>
        <Tooltip title="Clear all marks">
          <Button size="small" icon={<ClearOutlined />} aria-label="Clear all marks"
            disabled={shapes.length === 0} onClick={() => setShapes([])} />
        </Tooltip>
      </Space>
      <canvas
        ref={canvasRef}
        className="feedback-annotator-canvas"
        role="img"
        aria-label="Screenshot. Draw on it to point out the problem."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </div>
  );
};

export default ScreenshotAnnotator;
