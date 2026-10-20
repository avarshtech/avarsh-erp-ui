import { useCallback, useMemo, useState } from 'react';
import { App } from 'antd';
import { gpoFetchLines, lastRates } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import { processSnapshot } from '../../../utils/jobWorkPoLines';
import { excessCap, gpoLineLabel, withLastRates } from '../../../utils/garmentProcessPoCalc';
import { GPO_EXCESS_CAP_PCT } from '../../../utils/jobWorkConstants';
import { nextLineNo } from './gpoReducer';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * Line handlers of a draft Garment Process PO: Add to PO with the picker's ticked cells — one
 * process per PO (deviation D23), snapshotted from the live master; the required date
 * defaults to the earliest order delivery (D16) — grid edits, and the excess request dialog (§11).
 */
const useGpoLineHandlers = ({ doc, dispatch, masters }) => {
  const { message } = App.useApp();
  const [adding, setAdding] = useState(false);
  const [excessRequest, setExcessRequest] = useState(null);

  const addCells = useCallback(async (cells) => {
    const current = doc.lines[0]?.processLabel;
    const labels = [...new Set(cells.map((c) => c.processLabel))];
    if (labels.length > 1 || (current && labels[0] !== current)) {
      message.warning(`One process per PO${current ? ` (${current})` : ''}: raise a separate PO for ${labels.filter((l) => l !== current).join(', ')}.`);
      return false;
    }
    setAdding(true);
    try {
      const first = cells[0];
      const process = current ? doc.process : processSnapshot({ label: first.processLabel, processName: first.processName, otherName: first.processOtherName }, masters.processes, 'Garment');
      const { lines, onPo, noBalance } = await gpoFetchLines({ cellKeys: cells.map((c) => c.key), existing: doc.lines, firstKeyNo: nextLineNo(doc), uom: process.defaultUom });
      const rates = doc.vendor ? (await lastRates({ vendor: doc.vendor, lines: doc.lines.length ? doc.lines : lines })).byKey : {};
      const due = cells.map((c) => c.requiredBy).filter(Boolean).sort()[0];
      if (lines.length) dispatch({ type: 'LINES_ADDED', lines: withLastRates(lines, rates), process, header: doc.requiredDate || !due ? {} : { requiredDate: due } });
      const skipped = [onPo && `${onPo} already on the PO (V9)`, noBalance && `${noBalance} fully allocated`].filter(Boolean).join(' · ');
      message[lines.length ? 'success' : 'info'](`${lines.length} line(s) added${skipped ? ` · ${skipped}` : ''}`);
      return lines.length > 0;
    } finally {
      setAdding(false);
    }
  }, [doc, dispatch, masters.processes, message]);

  const grid = useMemo(() => ({
    onPatch: (key, patch) => dispatch({ type: 'LINE_PATCH', key, patch }),
    onLines: (lines) => dispatch({ type: 'LINES_SET', lines }),
    onSelectRows: (keys) => dispatch({ type: 'ROWS_SELECTED', keys }),
    onRemove: (key) => dispatch({ type: 'LINES_REMOVED', keys: [key] }),
    onRequest: (line, excess) => setExcessRequest({
      title: 'Request excess override', lineKey: line.key, label: gpoLineLabel(line), poQty: line.poQty, balance: Number(line.poQty) - excess, excess,
      note: `At most ${GPO_EXCESS_CAP_PCT}% of the required ${n(line.required)} (${n(excessCap(line))} pcs); an authorised approver other than you approves it.`,
    }),
  }), [dispatch]);

  return { addCells, adding, grid, excessRequest, closeExcess: () => setExcessRequest(null) };
};

export default useGpoLineHandlers;
