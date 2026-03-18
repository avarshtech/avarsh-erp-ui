import { useEffect, useRef } from 'react';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

/**
 * Global unsaved-changes guard.
 *
 * Provides two layers of protection when `isDirty` is true:
 *
 * 1. **In-app navigation** — intercepts history.pushState / replaceState
 *    (used by React Router) and shows an Ant Design confirmation dialog.
 *
 * 2. **Browser close / refresh** — uses the `beforeunload` event to trigger
 *    the browser's native "Leave site?" dialog.
 *
 * @param {boolean} isDirty — whether the current form has unsaved changes
 */
const useUnsavedChanges = (isDirty) => {
  const isDirtyRef = useRef(false);
  const clearDirtyRef = useRef(() => {});

  // Keep ref in sync — ref is read synchronously by event handlers
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Imperative clear — call before navigate to avoid race with useEffect sync
  clearDirtyRef.current = () => { isDirtyRef.current = false; };

  useEffect(() => {
    const suppressRef = { current: false };

    const confirmAndNavigate = (args, originalFn) => {
      Modal.confirm({
        title: 'Unsaved Changes',
        icon: <ExclamationCircleOutlined />,
        content:
          'You have unsaved changes that will be lost if you leave this page. Do you want to continue?',
        okText: 'Leave',
        okType: 'danger',
        cancelText: 'Stay',
        onOk: () => {
          isDirtyRef.current = false;
          suppressRef.current = true;
          try {
            originalFn.apply(window.history, args);
            // Notify React Router about the location change
            setTimeout(
              () => window.dispatchEvent(new PopStateEvent('popstate')),
              0,
            );
          } finally {
            suppressRef.current = false;
          }
        },
      });
    };

    // ── SPA navigation interception ──────────────────────────────────────
    const originalPush = window.history.pushState;
    const originalReplace = window.history.replaceState;

    // Navigation to /login (session expiry) should never be blocked
    const isAuthRedirect = (pathname) => pathname === '/login';

    window.history.pushState = function () {
      const args = Array.from(arguments);
      try {
        const to = new URL(args[2], window.location.origin).pathname;
        const from = window.location.pathname;
        if (isDirtyRef.current && !suppressRef.current && to !== from && !isAuthRedirect(to)) {
          confirmAndNavigate(args, originalPush);
          return;
        }
      } catch {
        // ignore URL parse errors; allow navigation
      }
      return originalPush.apply(window.history, args);
    };

    window.history.replaceState = function () {
      const args = Array.from(arguments);
      try {
        const to = new URL(args[2], window.location.origin).pathname;
        const from = window.location.pathname;
        if (isDirtyRef.current && !suppressRef.current && to !== from && !isAuthRedirect(to)) {
          confirmAndNavigate(args, originalReplace);
          return;
        }
      } catch {
        // ignore URL parse errors; allow navigation
      }
      return originalReplace.apply(window.history, args);
    };

    // ── Browser close / refresh ──────────────────────────────────────────
    const handleBeforeUnload = (e) => {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // Mount once — isDirtyRef is read by reference so no re-bind needed
  }, []);

  /** Call before programmatic navigation to bypass the guard synchronously */
  return { clearDirty: () => clearDirtyRef.current() };
};

export default useUnsavedChanges;
