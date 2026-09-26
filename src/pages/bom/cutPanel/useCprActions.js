import { useCallback, useState } from 'react';
import { App } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  saveCpr, submitCpr, reopenCpr, closeCpr, deleteCpr,
} from '../../../services/bom/cutPanel/cutPanelService';
import { draftSaveErrors, runPreSubmitChecks } from '../../../utils/cutPanelCalc';
import { NO_PROCESS_LABEL } from '../../../utils/cutPanelConstants';
import { toastUnlessHandled } from '../../../utils/apiError';

/**
 * Save Draft / Submit / Reopen / Close / Delete for the CPR screen. Each resolves to
 * true on success so a dialog can close itself. `errors` holds the blocking messages
 * of the last Save or Submit, shown in the action bar.
 */
const useCprActions = ({ doc, order, dispatch, clearDirty }) => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [errors, setErrors] = useState([]);

  const run = useCallback(async (kind, fn, okText) => {
    setBusy(kind);
    try {
      await fn();
      if (okText) message.success(okText);
      return true;
    } catch (e) {
      toastUnlessHandled(message, e, 'The action could not be completed');
      return false;
    } finally {
      setBusy(null);
    }
  }, [message]);

  /** A brand-new CPR moves onto its own URL after its first save, so a reload finds it. */
  const adoptUrl = useCallback((saved) => {
    clearDirty();
    if (!doc.id) navigate(`/bom/cut-panel/${saved.id}`, { replace: true });
  }, [doc, clearDirty, navigate]);

  const save = useCallback(() => {
    const errs = draftSaveErrors(doc, order);
    setErrors(errs);
    if (errs.length) return Promise.resolve(false);
    return run('save', async () => {
      const saved = await saveCpr(doc);
      dispatch({ type: 'SAVED', doc: saved });
      adoptUrl(saved);
    }, 'Draft saved');
  }, [doc, order, run, dispatch, adoptUrl]);

  const submit = useCallback(() => {
    const { blocking, uncoveredColors } = runPreSubmitChecks(doc.lines, order);
    setErrors(blocking);
    if (blocking.length) return;
    // Save and submit before moving URL: navigating in between would reload the Draft.
    const go = () => run('submit', async () => {
      const saved = await saveCpr(doc);
      dispatch({ type: 'SAVED', doc: await submitCpr(saved.id) });
      adoptUrl(saved);
    }, 'Submitted — the requirement is now available to the PO module');
    if (!uncoveredColors.length) { go(); return; }
    modal.confirm({ // WRN-03: confirm and proceed
      title: 'Some colours have no cut-panel process',
      content: `${uncoveredColors.join(', ')} will be reported as "${NO_PROCESS_LABEL}". Submit anyway?`,
      okText: 'Submit',
      onOk: go,
    });
  }, [doc, order, run, dispatch, adoptUrl, modal]);

  const reopen = useCallback(() => run('reopen', async () => {
    dispatch({ type: 'SAVED', doc: await reopenCpr(doc.id) });
  }, 'Reopened as Draft'), [doc, run, dispatch]);

  const close = useCallback((reason) => run('close', async () => {
    dispatch({ type: 'SAVED', doc: await closeCpr(doc.id, reason) });
  }, 'Requirement closed'), [doc, run, dispatch]);

  const remove = useCallback(() => run('delete', async () => {
    await deleteCpr(doc.id);
    clearDirty();
    navigate('/bom/cut-panel/list');
  }, 'Draft deleted'), [doc, run, clearDirty, navigate]);

  return { busy, errors, save, submit, reopen, close, remove };
};

export default useCprActions;
