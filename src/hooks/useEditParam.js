import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The view / edit mode of a saved document screen, kept in `?edit=1` so a list's Edit action can open it
 * straight into edit mode while opening the document itself shows it read-only. Toggling replaces the URL (no
 * history entry), and the unsaved-changes guard watches only the pathname, so it never prompts. [editing, setEditing]
 */
const useEditParam = () => {
  const [params, setParams] = useSearchParams();
  const editing = params.get('edit') === '1';
  const setEditing = useCallback((on) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    if (on) next.set('edit', '1'); else next.delete('edit');
    return next;
  }, { replace: true }), [setParams]);
  return [editing, setEditing];
};

export default useEditParam;
