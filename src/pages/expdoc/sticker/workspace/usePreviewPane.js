import { useCallback, useMemo, useState } from 'react';
import { paperSpecOf } from './stickerWorkspaceModel';

// CSS px per mm at the 96 dpi the document is authored against.
const MM_PX = 96 / 25.4;
export const PREVIEW_H = 620;

/**
 * The preview is the print document at true scale, shrunk to fit — not a re-layout.
 * Measuring the pane is what lets a 297 mm sheet be shown whole instead of clipped.
 * A callback ref rather than an effect: the pane mounts only after the skeleton is
 * replaced, by which time a mount-time effect has already run against nothing.
 */
const usePreviewPane = (paper, sheetsPerPage) => {
  const [paneW, setPaneW] = useState(0);
  // null = fit the pane; a number is an explicit zoom the user chose.
  const [zoom, setZoom] = useState(null);

  const paneRef = useCallback((node) => {
    if (!node || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([e]) => setPaneW(e.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* The iframe is rendered at the paper's true pixel size and scaled down, so what
     is on screen is the print document, not an approximation of it. */
  const sheetPx = useMemo(() => {
    const spec = paperSpecOf(paper);
    const w = spec.pageMm[0] * MM_PX;
    const h = spec.pageMm[1] * MM_PX * sheetsPerPage;
    const avail = Math.max(0, paneW - 8);
    const fit = avail ? Math.min(1, avail / w, PREVIEW_H / h) : 1;
    // Fit is the default because the whole sheet has to be checkable at a glance;
    // zoom is what makes a 6pt carton weight readable without printing it.
    return { w, h, scale: zoom ?? fit, fit };
  }, [paper, sheetsPerPage, paneW, zoom]);

  return {
    paneRef, sheetPx, zoom, setZoom,
  };
};

export default usePreviewPane;
