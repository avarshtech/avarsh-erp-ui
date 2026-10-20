import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Auto-focuses the first visible, non-disabled input/select/textarea
 * in the main content area after route changes.
 *
 * Safety: Skips if a component already claimed focus (e.g., PantoneColorInput,
 * POForm search-to-field, OrderView modal textareas, BOMForm variant select).
 * This prevents the global hook from stealing focus from component-level
 * focus management that uses programmatic .focus() calls.
 */
const useFocusManagement = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Delay lets the new route render and any component-level
    // focus calls (typically 0–100ms) execute first.
    let timer;
    let waits = 0;
    const attempt = () => {
      const main = document.getElementById('main-content');
      if (!main) return;

      // A lazy screen still downloading shows the route skeleton (App.jsx); look again once the
      // screen itself is there, for up to 5 s, so it gets the same focus as one already loaded.
      if (main.querySelector('[data-route-loading]') && waits < 50) {
        waits += 1;
        timer = setTimeout(attempt, 100);
        return;
      }

      // Don't steal focus if a component already focused an element.
      // Only proceed if focus is on body, document, or the main container itself
      // (meaning no component claimed focus yet).
      const active = document.activeElement;
      const focusIsUnclaimed =
        !active ||
        active === document.body ||
        active === main ||
        active.tagName === 'HTML';

      if (!focusIsUnclaimed) return;

      // Find the first focusable form element in the content area
      const firstInput = main.querySelector(
        'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]),' +
        'select:not([disabled]):not([tabindex="-1"]),' +
        'textarea:not([disabled]):not([tabindex="-1"]),' +
        '.ant-select:not(.ant-select-disabled) .ant-select-selector'
      );

      if (firstInput) {
        firstInput.focus({ preventScroll: true });
      } else {
        // No form element found — focus the content area itself
        main.focus({ preventScroll: true });
      }
    };
    timer = setTimeout(attempt, 200);

    return () => clearTimeout(timer);
  }, [pathname]);
};

export default useFocusManagement;
