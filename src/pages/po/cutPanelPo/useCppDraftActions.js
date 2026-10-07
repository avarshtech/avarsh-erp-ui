import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { withLiveVendor, vendorChanged } from '../../../utils/jobWorkPoLines';
import {
  saveCpp, submitCpp, deleteCpp, requestCppOverride, authoriseCppOverride,
} from '../../../services/po/cutPanelPo/cutPanelPoService';

const BASE = JOB_WORK_PO_PATH.CPP;

/**
 * Draft actions of a Cut Panel PO: save (number on first save), submit (saving first — also
 * when the live vendor changed since the snapshot), delete, and the over-allocation
 * override — requested on the saved draft, authorised by someone else. `unit` (the working
 * branch) fills the PO's branch when the draft has none yet; the return unit is always picked.
 * A first save stays in edit mode (?edit=1); a submitted PO is shown read-only.
 */
const useCppDraftActions = ({ doc, dirty, dispatch, clearDirty, runner, unit, liveVendor }) => {
  const navigate = useNavigate();
  const { run } = runner;

  const persist = useCallback(async () => {
    const saved = await saveCpp({
      ...withLiveVendor(doc, liveVendor),
      branchId: doc.branchId ?? unit?.id ?? null, branchName: doc.branchName ?? unit?.branchName ?? null,
    });
    dispatch({ type: 'SAVED', doc: saved });
    clearDirty();
    if (!doc.id) navigate(`${BASE}/${saved.id}?edit=1`, { replace: true });
    return saved;
  }, [doc, unit, liveVendor, dispatch, clearDirty, navigate]);

  const savedDoc = useCallback(async () => (doc.id && !dirty && !vendorChanged(doc, liveVendor) ? doc : persist()), [doc, dirty, liveVendor, persist]);

  const save = useCallback(() => run('save', persist, 'Draft saved'), [run, persist]);

  const submit = useCallback(() => run('submit', async () => {
    const saved = await savedDoc();
    dispatch({ type: 'SAVED', doc: await submitCpp(saved) });
    navigate(`${BASE}/${saved.id}`, { replace: true });
  }, 'Submitted for approval'), [run, savedDoc, dispatch, navigate]);

  const remove = useCallback(() => run('remove', async () => {
    await deleteCpp(doc);
    clearDirty();
    navigate(`${BASE}/list`, { replace: true });
  }, 'Draft deleted'), [run, doc, clearDirty, navigate]);

  const requestOverride = useCallback((payload) => run('override', async () => {
    const saved = await savedDoc();
    dispatch({ type: 'SAVED', doc: await requestCppOverride(saved, payload) });
  }, 'Override requested — an authoriser must approve it before you submit'), [run, savedDoc, dispatch]);

  const authorise = useCallback((o) => run('authorise', async () => {
    dispatch({ type: 'SAVED', doc: await authoriseCppOverride(doc, o.id) });
  }, 'Override authorised'), [run, doc, dispatch]);

  return { save, submit, remove, requestOverride, authorise };
};

export default useCppDraftActions;
