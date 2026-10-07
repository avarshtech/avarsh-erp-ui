import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { withLiveVendor, vendorChanged } from '../../../utils/jobWorkPoLines';
import { saveGpo, submitGpo, requestGpoExcess, approveGpoExcess } from '../../../services/po/garmentProcessPo/garmentProcessPoService';

const BASE = JOB_WORK_PO_PATH.GPO;

/**
 * Draft actions of a Garment Process PO: save (number on first save; a vendor and a line
 * needed, V1/V2; the vendor snapshot re-taken from the live vendor), submit (saving first,
 * also when the live vendor changed; the quantity is allocated from here, §10), and the
 * excess override — requested on the saved draft, approved by someone else (§11). A first save stays in edit
 * mode (?edit=1); a submitted PO is shown read-only.
 */
const useGpoDraftActions = ({ doc, dirty, dispatch, clearDirty, runner, unit, liveVendor }) => {
  const navigate = useNavigate();
  const { run } = runner;

  const persist = useCallback(async () => {
    const saved = await saveGpo({ ...withLiveVendor(doc, liveVendor), branchId: doc.branchId ?? unit?.id ?? null, branchName: doc.branchName ?? unit?.branchName ?? null });
    dispatch({ type: 'SAVED', doc: saved });
    clearDirty();
    if (!doc.id) navigate(`${BASE}/${saved.id}?edit=1`, { replace: true });
    return saved;
  }, [doc, unit, liveVendor, dispatch, clearDirty, navigate]);

  const savedDoc = useCallback(async () => (doc.id && !dirty && !vendorChanged(doc, liveVendor) ? doc : persist()), [doc, dirty, liveVendor, persist]);

  const save = useCallback(() => run('save', persist, 'Draft saved'), [run, persist]);

  const submit = useCallback(() => run('submit', async () => {
    const saved = await savedDoc();
    dispatch({ type: 'SAVED', doc: await submitGpo(saved) });
    navigate(`${BASE}/${saved.id}`, { replace: true });
  }, 'Submitted for approval — the quantity now counts against the requirement'), [run, savedDoc, dispatch, navigate]);

  const requestExcess = useCallback((payload) => run('excess', async () => {
    const saved = await savedDoc();
    dispatch({ type: 'SAVED', doc: await requestGpoExcess(saved, payload) });
  }, 'Excess requested — an authorised approver must approve it before you submit'), [run, savedDoc, dispatch]);

  const approveExcess = useCallback((o) => run('excessApprove', async () => {
    dispatch({ type: 'SAVED', doc: await approveGpoExcess(doc, o.id) });
  }, 'Excess approved'), [run, doc, dispatch]);

  return { save, submit, requestExcess, approveExcess };
};

export default useGpoDraftActions;
