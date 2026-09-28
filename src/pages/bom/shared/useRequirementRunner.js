import { useCallback } from 'react';
import { App } from 'antd';
import useBusyAction from '../../../hooks/useBusyAction';
import { toastUnlessHandled } from '../../../utils/apiError';

/**
 * Runs one requirement action at a time: `run(kind, fn, okText)` marks `kind` busy (so
 * only that button spins), toasts the outcome and resolves to true on success so a
 * dialog can close itself.
 */
const useRequirementRunner = () => {
  const { message } = App.useApp();
  const { busy, setBusy } = useBusyAction();

  const run = useCallback(async (kind, fn, okText) => {
    setBusy(kind);
    try {
      await fn();
      if (okText) message.success(okText);
      return true;
    } catch (e) {
      toastUnlessHandled(message, e, 'The action could not be completed');
      return false;
    } finally {
      setBusy(null);
    }
  }, [message, setBusy]);

  return { busy, run };
};

export default useRequirementRunner;
