import { useEffect, useMemo, useRef } from 'react';
import { colName, parseRange } from './sourceRefs';

const CELL = {
  border: '1px solid #e5e5e5', padding: '2px 6px', whiteSpace: 'pre-wrap', verticalAlign: 'top',
  minWidth: 48, maxWidth: 260, fontSize: 11, color: '#222', background: '#fff',
};
const HEAD = {
  position: 'sticky', top: 0, zIndex: 1, background: '#f5f5f5', border: '1px solid #e5e5e5',
  fontSize: 10, fontWeight: 600, color: '#666', padding: '2px 6px',
};
const ROW_HEAD = { ...HEAD, position: 'sticky', left: 0, top: 'auto', textAlign: 'right' };
const HIT = { background: '#fff1b8', outline: '2px solid #faad14', outlineOffset: -2 };

/**
 * One uploaded sheet as the reader saw it — the same cells, the same merged ranges,
 * spreadsheet row and column headers — so a citation like "B12" can be checked by eye.
 * The cited cell is highlighted and scrolled into view.
 */
const SheetSourceView = ({ sheet, highlight }) => {
  const box = useRef(null);
  const width = useMemo(() => Math.max(1, ...(sheet.rows || []).map((r) => r.length)), [sheet]);

  const { anchors, covered } = useMemo(() => {
    const a = new Map();
    const c = new Set();
    (sheet.merges || []).map(parseRange).filter(Boolean).forEach((m) => {
      a.set(`${m.r1}:${m.c1}`, { rowSpan: m.r2 - m.r1 + 1, colSpan: m.c2 - m.c1 + 1 });
      for (let r = m.r1; r <= m.r2; r += 1) {
        for (let col = m.c1; col <= m.c2; col += 1) if (r !== m.r1 || col !== m.c1) c.add(`${r}:${col}`);
      }
    });
    return { anchors: a, covered: c };
  }, [sheet]);

  const hitRow = highlight?.row;
  const hitCol = highlight?.col;
  const sheetName = sheet.name;
  // Scrolls the grid itself so the cited cell sits mid-view, clear of the sticky row and
  // column headers — computed from the two boxes rather than scrollIntoView, and repeated
  // once the side panel has finished sliding in, because a scroll asked for while it is
  // still moving is dropped and the view stays at the top-left.
  useEffect(() => {
    if (hitRow == null || hitCol == null) return undefined;
    const reveal = () => {
      const grid = box.current;
      const cell = grid?.querySelector(`[data-cell="${hitRow}:${hitCol}"]`);
      if (!grid || !cell) return;
      const g = grid.getBoundingClientRect();
      const c = cell.getBoundingClientRect();
      grid.scrollTop += (c.top - g.top) - (grid.clientHeight - c.height) / 2;
      grid.scrollLeft += (c.left - g.left) - (grid.clientWidth - c.width) / 2;
    };
    const frame = requestAnimationFrame(reveal);
    const settled = setTimeout(reveal, 400);
    return () => { cancelAnimationFrame(frame); clearTimeout(settled); };
  }, [hitRow, hitCol, sheetName]);

  const cols = Array.from({ length: width }, (_, i) => i);
  return (
    <div ref={box} style={{ overflow: 'auto', maxHeight: '72vh' }}>
      <table style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...HEAD, left: 0, zIndex: 2 }} aria-label="Row" />
            {cols.map((c) => <th key={c} style={HEAD}>{colName(c)}</th>)}
          </tr>
        </thead>
        <tbody>
          {(sheet.rows || []).map((row, r) => (
            // Sheet rows never reorder, so the row number is their identity.
            <tr key={r}>
              <th style={ROW_HEAD}>{r + 1}</th>
              {cols.map((c) => {
                const k = `${r}:${c}`;
                if (covered.has(k)) return null;
                const span = anchors.get(k);
                const hit = highlight && highlight.row === r && highlight.col === c;
                return (
                  <td key={c} data-cell={k} rowSpan={span?.rowSpan} colSpan={span?.colSpan} style={hit ? { ...CELL, ...HIT } : CELL}>
                    {row[c] || ''}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SheetSourceView;
