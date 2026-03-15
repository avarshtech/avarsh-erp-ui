import { useEffect } from 'react';

/**
 * Warns the user before closing/refreshing the browser tab when there are unsaved changes.
 * Note: In-app navigation blocking is handled manually by the consuming component.
 *
 * @param {boolean} isDirty - Whether the current form has unsaved changes
 *
 * Usage:
 *   useUnsavedChanges(isDirty);
 *   // Render UnsavedChangesModal separately for in-app navigation guards.
 */
const useUnsavedChanges = (isDirty) => {
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);
};

export default useUnsavedChanges;
