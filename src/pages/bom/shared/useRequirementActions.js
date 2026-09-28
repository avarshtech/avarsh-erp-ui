import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useRequirementRunner from './useRequirementRunner';

/**
 * The lifecycle actions the Cut Panel and Garment Process requirements share (no
 * approval). `api` ({ save, submit, reopen, close, remove }) must be a module-level
 * constant, since every callback depends on it.
 */
const useRequirementActions = ({ doc, dirty, dispatch, clearDirty, api, basePath, closedText }) => {
  const navigate = useNavigate();
  const { busy, run } = useRequirementRunner();

  /**
   * Saves the draft (and submits it) before a new requirement moves onto its own URL:
   * navigating in between would reload the Draft. An unchanged saved draft is submitted
   * as it is, so Submit needs add or update, not both. A failed submit still adopts the
   * saved draft, so a retry updates it (at its new version) instead of creating another.
   */
  const persist = useCallback((alsoSubmit) => async () => {
    const saved = alsoSubmit && doc.id && !dirty ? doc : await api.save(doc);
    let next = saved;
    try {
      if (alsoSubmit) next = await api.submit(saved.id);
    } finally {
      dispatch({ type: 'SAVED', doc: next });
      clearDirty();
      if (!doc.id) navigate(`${basePath}/${saved.id}`, { replace: true });
    }
  }, [doc, dirty, dispatch, clearDirty, navigate, api, basePath]);

  const reopen = useCallback(() => run('reopen', async () => {
    dispatch({ type: 'SAVED', doc: await api.reopen(doc.id) });
  }, 'Reopened as Draft'), [doc, run, dispatch, api]);

  const close = useCallback((reason) => run('close', async () => {
    dispatch({ type: 'SAVED', doc: await api.close(doc.id, reason) });
  }, closedText), [doc, run, dispatch, api, closedText]);

  const remove = useCallback(() => run('delete', async () => {
    await api.remove(doc.id);
    clearDirty();
    navigate(`${basePath}/list`);
  }, 'Draft deleted'), [doc, run, clearDirty, navigate, api, basePath]);

  return { busy, run, persist, reopen, close, remove };
};

export default useRequirementActions;
