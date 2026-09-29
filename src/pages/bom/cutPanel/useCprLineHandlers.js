import { useCallback, useMemo } from 'react';
import { expandSelection } from '../../../utils/cutPanelCalc';

/**
 * Line handlers of the Cut Panel Requirement screen: the grid's sequence, allowance,
 * quantity and reason edits, removals and recalculation, and Add to Grid, which expands a
 * selection into lines and reports { added, skipped } to the selection strip.
 */
const useCprLineHandlers = ({ doc, order, dispatch }) => {
  const gridHandlers = useMemo(() => ({
    onSeq: (key, v) => dispatch({ type: 'LINE_PATCHED', key, patch: { sequenceNo: v } }),
    onAllow: (key, pct) => dispatch({ type: 'LINE_ALLOWANCE', key, pct }),
    onQty: (key, size, qty) => dispatch({ type: 'LINE_QTY', key, size, qty }),
    onReason: (key, v) => dispatch({ type: 'LINE_PATCHED', key, patch: { varianceReason: v } }),
    onRemove: (key) => dispatch({ type: 'LINES_REMOVED', keys: [key] }),
    onRemoveMany: (keys) => dispatch({ type: 'LINES_REMOVED', keys }),
    onRecalcAll: () => dispatch({ type: 'RECALC_ALL' }),
    onApplyAllowance: (pct, includeOverridden) => dispatch({ type: 'APPLY_ALLOWANCE_ALL', pct, includeOverridden }),
  }), [dispatch]);

  const lines = doc?.lines;
  const lastLineNo = doc?.lastLineNo;
  const addLines = useCallback((selection) => {
    const { lines: added, skipped } = expandSelection({ ...selection, order, existingLines: lines, lastLineNo });
    if (added.length) dispatch({ type: 'LINES_ADDED', lines: added });
    return { added: added.length, skipped };
  }, [order, lines, lastLineNo, dispatch]);

  return { gridHandlers, addLines };
};

export default useCprLineHandlers;
