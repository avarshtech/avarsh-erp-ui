import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { saveGpo, submitGpo, requestGpoExcess, approveGpoExcess } from '../../../services/po/garmentProcessPo/garmentProcessPoService';

const BASE = JOB_WORK_PO_PATH.GPO;

/**
 * Draft actions of a Garment Process PO: save (number on first save; a vendor and a line
 * needed, V1/V2), submit (saving first; the quantity is allocated from here, §10), and the
 * excess override — requested on the saved draft, approved by someone else (§11).
 */
const useGpoDraftActions = ({ doc, dirty, dispatch, clearDirty, runner, unit }) => {
  const navigate = useNavigate();
  const { run } = runner;

  const persist = useCallback(async () => {
    const saved = await saveGpo({ ...doc, branchId: doc.branchId ?? unit?.id ?? null, branchName: doc.branchName ?? unit?.branchName ?? null });
    dispatch({ type: 'SAVED', doc: saved });
    clearDirty();
    if (!doc.id) navigate(`${BASE}/${saved.id}`, { replace: true });
    return saved;
  }, [doc, unit, dispatch, clearDirty, navigate]);

  const savedDoc = useCallback(async () => (doc.id && !dirty ? doc : persist()), [doc, dirty, persist]);

  const save = useCallback(() => run('save', persist, 'Draft saved'), [run, persist]);

  const submit = useCallback(() => run('submit', async () => {
    const saved = await savedDoc();
    dispatch({ type: 'SAVED', doc: await submitGpo(saved.id) });
  }, 'Submitted for approval — the quantity now counts against the requirement'), [run, savedDoc, dispatch]);

  const requestExcess = useCallback((payload) => run('excess', async () => {
    const saved = await savedDoc();
    dispatch({ type: 'SAVED', doc: await requestGpoExcess(saved.id, payload) });
  }, 'Excess requested — an authorised approver must approve it before you submit'), [run, savedDoc, dispatch]);

  const approveExcess = useCallback((o) => run('excessApprove', async () => {
    dispatch({ type: 'SAVED', doc: await approveGpoExcess(doc.id, o.id) });
  }, 'Excess approved'), [run, doc, dispatch]);

  return { save, submit, requestExcess, approveExcess };
};

export default useGpoDraftActions;
