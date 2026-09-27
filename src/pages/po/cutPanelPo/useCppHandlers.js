import { useCallback, useMemo, useState } from 'react';
import { App } from 'antd';
import { cppFetchLines } from '../../../services/po/cutPanelPo/cutPanelPoService';
import { getCachedOrganisation, fetchAndCacheOrganisation } from '../../../services/admin/organisationService';
import { processSnapshot } from '../../../utils/jobWorkPoLines';
import { printJobWorkPo } from '../../../utils/jobWorkPoPrint';
import { nextLineNo } from './cppReducer';

/**
 * Screen-side handlers of the Cut Panel PO: process choice (snapshotting the live master),
 * Add to Grid, grid edits, the override request dialog and printing the vendor copy.
 */
const useCppHandlers = ({ doc, selection, dispatch, view, masters }) => {
  const { message } = App.useApp();
  const [adding, setAdding] = useState(false);
  const [overrideRequest, setOverrideRequest] = useState(null);
  const canRequest = Boolean(view?.edit.draft);

  const grid = useMemo(() => ({
    canRequest,
    onPatch: (key, patch) => dispatch({ type: 'LINE_PATCH', key, patch }),
    onLines: (lines) => dispatch({ type: 'LINES_SET', lines }),
    onRemove: view?.edit.draft ? (key) => dispatch({ type: 'LINES_REMOVED', keys: [key] }) : null,
    onSelectRows: (keys) => dispatch({ type: 'ROWS_SELECTED', keys }),
    onRequest: (line, excess) => setOverrideRequest({
      lineKey: line.key, label: `${line.cprNo} ${line.colorName} ${line.panelName} ${line.size}`, poQty: line.poQty,
      balance: Number(line.poQty) - excess, excess, note: 'Someone other than you authorises it; it adds one approval level.',
    }),
  }), [dispatch, view?.edit.draft, canRequest]);

  const chooseProcess = useCallback((option) => {
    dispatch({ type: 'PROCESS_SELECTED', process: processSnapshot(option, masters.processes, 'Cut Panel') });
  }, [dispatch, masters.processes]);

  const addToGrid = useCallback(async () => {
    setAdding(true);
    try {
      const { lines, skipped } = await cppFetchLines({
        label: doc.process.label, cprIds: selection.cprIds, colours: selection.colours, sizes: selection.sizes,
        existing: doc.lines, firstKeyNo: nextLineNo(doc), uom: doc.process.defaultUom,
      });
      if (lines.length) dispatch({ type: 'LINES_ADDED', lines });
      message[lines.length ? 'success' : 'info'](`${lines.length} line(s) added${skipped ? ` · ${skipped} already on the PO` : ''}`);
    } finally {
      setAdding(false);
    }
  }, [doc, selection, dispatch, message]);

  const print = useCallback(async () => {
    const org = getCachedOrganisation() || (await fetchAndCacheOrganisation()) || {};
    if (!printJobWorkPo(view.working, view.value, org)) message.warning('Allow pop-ups to print the vendor copy.');
  }, [view, message]);

  return { grid, chooseProcess, addToGrid, adding, print, overrideRequest, closeOverride: () => setOverrideRequest(null) };
};

export default useCppHandlers;
