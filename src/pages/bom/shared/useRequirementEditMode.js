import { useCallback, useEffect } from 'react';
import { App } from 'antd';
import { useSearchParams } from 'react-router-dom';
import { isRequirementEditable, isRequirementEditableInPlace } from '../../../utils/requirementStatus';

/**
 * Edit in place for a submitted requirement no PO is placed against yet. The mode lives in
 * `?edit=1`, so a list can open it directly; the unsaved-changes guard watches only the
 * pathname, so toggling it never prompts. A stale `?edit=1` — a PO was placed meanwhile, or
 * the user may not edit — is dropped with a note. Cancel edit restores the saved requirement.
 */
const useRequirementEditMode = ({ id, doc, loading, dirty, canEdit, clearDirty, reload, docNo }) => {
  const { message, modal } = App.useApp();
  const [params, setParams] = useSearchParams();
  const requested = params.get('edit') === '1';
  const current = Boolean(doc?.id) && String(doc.id) === String(id);
  const allowed = current && canEdit && isRequirementEditableInPlace(doc.status, doc.placedPos);

  const setEdit = useCallback((on) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (on) next.set('edit', '1'); else next.delete('edit');
    return next;
  }, { replace: true }), [setParams]);

  useEffect(() => {
    if (!requested || loading || !current || allowed) return;
    setEdit(false);
    if (isRequirementEditable(doc.status)) return; // a Draft is edited without the flag
    const placed = doc.placedPos || [];
    message.info(placed.length
      ? `${docNo} can no longer be edited — ${placed.join(', ')} ${placed.length > 1 ? 'have' : 'has'} been placed against it.`
      : `${docNo} cannot be edited now.`);
  }, [requested, loading, current, allowed, setEdit, doc, docNo, message]);

  const startEdit = useCallback(() => setEdit(true), [setEdit]);
  const stopEdit = useCallback(() => setEdit(false), [setEdit]);

  const cancelEdit = useCallback(() => {
    if (!dirty) { setEdit(false); return; }
    modal.confirm({
      title: 'Discard your changes?',
      content: `${docNo} stays as it was last saved.`,
      okText: 'Discard changes',
      okButtonProps: { danger: true },
      cancelText: 'Keep editing',
      onOk: async () => { clearDirty(); await reload(); setEdit(false); }, // saved values back before the grid turns read-only
    });
  }, [dirty, docNo, modal, clearDirty, setEdit, reload]);

  return { editing: requested && allowed, startEdit, cancelEdit, stopEdit };
};

export default useRequirementEditMode;
