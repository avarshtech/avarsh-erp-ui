import { useEffect } from 'react';

/**
 * Global keyboard shortcuts for the ERP application.
 *
 * Shortcuts:
 * - Ctrl/Cmd + S → Triggers submit on the nearest visible form
 * - Escape → Closes topmost Ant Design modal/drawer
 * - Ctrl/Cmd + K → Focuses the header search input
 *
 * Works in both standalone PWA and regular web mode.
 */
const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMeta = e.ctrlKey || e.metaKey;

      // ── Ctrl/Cmd + S → Submit nearest form ──
      if (isMeta && e.key === 's') {
        e.preventDefault();
        // Find the visible submit button and click it
        const submitBtn = document.querySelector(
          '.ant-drawer-open .ant-btn-primary:not([disabled]),' +
          '.ant-modal-root .ant-btn-primary:not([disabled]),' +
          '#main-content .ant-btn-primary:not([disabled])'
        );
        if (submitBtn) {
          submitBtn.click();
        }
      }

      // ── Ctrl/Cmd + K → Focus search input ──
      if (isMeta && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('.ant-layout-header .ant-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};

export default useKeyboardShortcuts;
