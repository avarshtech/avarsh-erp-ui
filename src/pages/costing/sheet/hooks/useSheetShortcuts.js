import { useEffect } from 'react';

const overlayOpen = () =>
  !!document.querySelector('.ant-drawer-open')
  || [...document.querySelectorAll('.ant-modal-wrap')].some((el) => el.style.display !== 'none');

const editing = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

/**
 * Ctrl/Cmd+S saves the draft and Ctrl/Cmd+Z (outside a text field) undoes the last batch.
 * Registered in the capture phase: the app-wide Ctrl+S clicks the first primary button on the
 * page, which on this sheet is Submit. With a drawer or modal open the app-wide one still runs.
 */
export default function useSheetShortcuts({ saveDraft, undo, canUndo }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey) || overlayOpen()) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        e.stopImmediatePropagation();
        saveDraft();
      } else if (key === 'z' && !e.shiftKey && canUndo && !editing(e.target)) {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [saveDraft, undo, canUndo]);
}
