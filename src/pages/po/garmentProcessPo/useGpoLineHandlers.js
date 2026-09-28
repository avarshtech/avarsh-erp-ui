import { useCallback, useMemo, useState } from 'react';
import { App } from 'antd';
import { gpoFetchLines, lastRates } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import { processSnapshot } from '../../../utils/jobWorkPoLines';
import { excessCap, gpoLineLabel, withLastRates } from '../../../utils/garmentProcessPoCalc';
import { GPO_EXCESS_CAP_PCT } from '../../../utils/jobWorkConstants';
import { nextLineNo } from './gpoReducer';

const n = (v) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * Line handlers of a draft Garment Process PO: Add selected to PO lines — one process per
 * PO (deviation D23), snapshotted from the live master; the required date defaults to the
 * earliest order delivery (D16) — grid edits, and the excess request dialog (§11).
 */
const useGpoLineHandlers = ({ doc, dispatch, masters }) => {
  const { message } = App.useApp();
  const [adding, setAdding] = useState(false);
  const [excessRequest, setExcessRequest] = useState(null);

  const addRows = useCallback(async (rows) => {
    const current = doc.lines[0]?.processLabel;
    const labels = [...new Set(rows.map((r) => r.processLabel))];
    if (labels.length > 1 || (current && labels[0] !== current)) {
      message.warning(`One process per PO${current ? ` (${current})` : ''}: raise a separate PO for ${labels.filter((l) => l !== current).join(', ')}.`);
      return false;
    }
    setAdding(true);
    try {
      const first = rows[0];
      const process = current ? doc.process : processSnapshot({ label: first.processLabel, processName: first.processName, otherName: first.processOtherName }, masters.processes, 'Garment');
      const { lines, onPo, noBalance } = await gpoFetchLines({ rowKeys: rows.map((r) => r.key), existing: doc.lines, firstKeyNo: nextLineNo(doc), uom: process.defaultUom });
      const rates = doc.vendor ? (await lastRates({ type: 'GPO', gstin: doc.vendor.gstin, processLabel: first.processLabel })).byKey : {};
      const due = rows.map((r) => r.requiredBy).filter(Boolean).sort()[0];
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
    onRemove: (key) => dispatch({ type: 'LINES_REMOVED', keys: [key] }),
    onRequest: (line, excess) => setExcessRequest({
      title: 'Request excess override', lineKey: line.key, label: gpoLineLabel(line), poQty: line.poQty, balance: Number(line.poQty) - excess, excess,
      note: `At most ${GPO_EXCESS_CAP_PCT}% of the required ${n(line.required)} (${n(excessCap(line))} pcs); an authorised approver other than you approves it.`,
    }),
  }), [dispatch]);

  return { addRows, adding, grid, excessRequest, closeExcess: () => setExcessRequest(null) };
};

export default useGpoLineHandlers;
