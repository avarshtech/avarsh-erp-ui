import { useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

/**
 * Global optimistic-lock conflict handler.
 *
 * Mounted once at the App root. When axiosInstance detects a 409 with
 * error code OPTIMISTIC_LOCK_CONFLICT, it calls `emitConflict()` which
 * triggers a Modal.confirm here.
 *
 * Options presented to the user:
 *   - "Reload"  → refresh the page to fetch the latest data
 *   - "Stay"    → keep local edits (user can copy their work before reloading)
 */

// Simple pub/sub for conflict events
const listeners = new Set();

export const emitConflict = (detail) => {
  listeners.forEach((fn) => fn(detail));
};

const ConflictDialog = () => {
  const handleConflict = useCallback(() => {
    Modal.confirm({
      title: 'Data Conflict',
      icon: <ExclamationCircleOutlined />,
      content:
        'This record has been modified by another user or in another tab since you opened it. ' +
        'Your changes could not be saved. You can reload to see the latest version, or stay on ' +
        'this page to copy your work before reloading.',
      okText: 'Reload',
      cancelText: 'Stay',
      onOk: () => window.location.reload(),
    });
  }, []);

  useEffect(() => {
    listeners.add(handleConflict);
    return () => listeners.delete(handleConflict);
  }, [handleConflict]);

  return null;
};

export default ConflictDialog;
