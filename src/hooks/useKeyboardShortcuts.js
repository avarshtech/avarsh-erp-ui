import { useEffect } from 'react';

// antd's solid primary button: the one antd class this shortcut has always gone by.
const PRIMARY = '.ant-btn-primary';

/**
 * The open dialog in front. Every antd Modal and Drawer panel is an aria-modal dialog; a closed one
 * can stay in the DOM, hidden, and one opened later stacks above the earlier ones.
 */
const topOpenDialog = () => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
  .filter((dialog) => dialog.getClientRects().length > 0)
  .pop();

/**
 * The button Ctrl/Cmd + S presses: the save of the open dialog or drawer in front, else the page's.
 * It never reaches past an open dialog to the page underneath. One selector list for drawer, dialog
 * and page used to return the PAGE's button, because querySelector answers in document order and
 * the page comes before every dialog: Ctrl+S in the BOM consumption matrix saved and released the
 * BOM without the matrix and left the screen (2026-11-21).
 *
 * A dialog's save is its last primary button: its footer comes after its body, which can hold
 * primary buttons of its own (the matrix's Quick Fill "Apply"). A disabled save means nothing is
 * pressed — never a primary button of the body instead.
 */
const shortcutSubmitButton = () => {
  const dialog = topOpenDialog();
  if (dialog) {
    const save = [...dialog.querySelectorAll(PRIMARY)].pop();
    return save && !save.disabled ? save : null;
  }
  return document.querySelector(`#main-content ${PRIMARY}:not([disabled])`);
};

/**
 * Global keyboard shortcuts for the ERP application.
 *
 * Shortcuts:
 * - Ctrl/Cmd + S → presses the save of what is in front: an open dialog or drawer, else the page
 *
 * (Ctrl/Cmd + K focused a header search box that searched nothing; both were removed until a
 * real global search exists.)
 *
 * Works in both standalone PWA and regular web mode.
 */
const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMeta = e.ctrlKey || e.metaKey;

      // ── Ctrl/Cmd + S → Submit what is in front ──
      if (isMeta && e.key === 's') {
        e.preventDefault();
        shortcutSubmitButton()?.click();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};

export default useKeyboardShortcuts;
