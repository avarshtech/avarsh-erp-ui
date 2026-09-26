import { useCallback, useState } from 'react';
import { App } from 'antd';
import { useNavigate } from 'react-router-dom';
import { saveGpr, submitGpr, reopenGpr, closeGpr } from '../../../services/bom/garmentProcess/garmentProcessService';
import { validateGpr } from '../../../utils/garmentProcessCalc';
import { canSubmitGarmentProcessOverQty } from '../../../utils/permissions';
import { toastUnlessHandled } from '../../../utils/apiError';

/**
 * Save draft / Submit / Reopen / Close for the GPR screen (PRD §13). Errors of the last
 * Save or Submit are listed in the action bar and the first offending line is selected.
 */
const useGprActions = ({ doc, order, dispatch, clearDirty }) => {
  const { message } = App.useApp();
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

  const check = useCallback((forSubmit) => {
    const { errors: errs, firstKey } = validateGpr(doc, order, { forSubmit, canOverQty: canSubmitGarmentProcessOverQty() });
    setErrors(errs);
    if (firstKey) dispatch({ type: 'LINE_SELECTED', key: firstKey });
    return errs.length === 0;
  }, [doc, order, dispatch]);

  /** Save (and optionally submit) before moving a new requirement onto its own URL. */
  const persist = useCallback((alsoSubmit) => async () => {
    const saved = await saveGpr(doc);
    dispatch({ type: 'SAVED', doc: alsoSubmit ? await submitGpr(saved.id) : saved });
    clearDirty();
    if (!doc.id) navigate(`/bom/garment-process/${saved.id}`, { replace: true });
  }, [doc, dispatch, clearDirty, navigate]);

  const save = useCallback(() => (check(false) ? run('save', persist(false), 'Draft saved') : Promise.resolve(false)), [check, run, persist]);
  const submit = useCallback(() => (check(true)
    ? run('submit', persist(true), 'Submitted — the process lines are now available to the PO module')
    : Promise.resolve(false)), [check, run, persist]);

  const reopen = useCallback(() => run('reopen', async () => {
    dispatch({ type: 'SAVED', doc: await reopenGpr(doc.id) });
  }, 'Reopened as Draft'), [doc, run, dispatch]);

  const close = useCallback((reason) => run('close', async () => {
    dispatch({ type: 'SAVED', doc: await closeGpr(doc.id, reason) });
  }, 'Requirement closed — balance released'), [doc, run, dispatch]);

  return { busy, errors, save, submit, reopen, close };
};

export default useGprActions;
