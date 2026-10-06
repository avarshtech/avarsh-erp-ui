import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useRequirementRunner from './useRequirementRunner';

/**
 * The lifecycle actions the Cut Panel and Garment Process requirements share (no
 * approval). `api` ({ save, submit, revise, close, remove }, each taking the document for its version) must be a module-level
 * constant, since every callback depends on it. `onRevised` ends edit mode after a revision.
 */
const useRequirementActions = ({ doc, dirty, dispatch, clearDirty, api, basePath, closedText, reload, onRevised }) => {
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
      if (alsoSubmit) next = await api.submit(saved);
    } finally {
      dispatch({ type: 'SAVED', doc: next });
      clearDirty();
      if (!doc.id) navigate(`${basePath}/${saved.id}`, { replace: true });
    }
  }, [doc, dirty, dispatch, clearDirty, navigate, api, basePath]);

  /** Saves the edits to a submitted requirement in place; a 409 (a PO was placed meanwhile) reloads it, ending the edit. */
  const revise = useCallback(() => run('revise', async () => {
    const saved = await api.revise(doc).catch((e) => { if (e?.response?.status === 409) reload(); throw e; });
    dispatch({ type: 'SAVED', doc: saved });
    clearDirty();
    onRevised();
  }, 'Changes saved — the requirement stays submitted'), [doc, run, dispatch, clearDirty, api, reload, onRevised]);

  const close = useCallback((reason) => run('close', async () => {
    dispatch({ type: 'SAVED', doc: await api.close(doc, reason) });
  }, closedText), [doc, run, dispatch, api, closedText]);

  const remove = useCallback(() => run('delete', async () => {
    await api.remove(doc);
    clearDirty();
    navigate(`${basePath}/list`);
  }, 'Draft deleted'), [doc, run, clearDirty, navigate, api, basePath]);

  return { busy, run, persist, revise, close, remove };
};

export default useRequirementActions;
