import { useEffect, useRef, useState } from 'react';

/**
 * A printed document shown as its page: at the paper's own width and at its full
 * height, so the screen scrolls down the page — never a box inside it. A template
 * wider than the space it has (a packing list with many columns) scrolls sideways;
 * one that fits is centred. With no `pageWidthPx` (a sticker sheet, which sizes its
 * own labels) it fills the width. The frame re-measures on every change of the
 * document, and as late-loading parts such as the logo settle.
 */
const PrintPageFrame = ({
  html, title, pageWidthPx, frameStyle,
}) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const observer = useRef(null);

  useEffect(() => () => observer.current?.disconnect(), []);

  const onLoad = (e) => {
    const frame = e.currentTarget;
    const body = frame.contentDocument?.body;
    if (!body) return;
    const measure = () => setSize({ width: body.scrollWidth, height: body.scrollHeight });
    measure();
    observer.current?.disconnect();
    const Observer = frame.contentWindow?.ResizeObserver;
    if (Observer) {
      observer.current = new Observer(measure);
      observer.current.observe(body);
    }
  };

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden' }}>
      <iframe
        title={title}
        srcDoc={html}
        scrolling="no"
        onLoad={onLoad}
        style={{
          display: 'block',
          border: 0,
          background: '#fff',
          margin: '0 auto',
          width: pageWidthPx ? Math.max(pageWidthPx, size.width) : '100%',
          height: size.height || 480,
          ...frameStyle,
        }}
      />
    </div>
  );
};

export default PrintPageFrame;
