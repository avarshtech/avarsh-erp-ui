import { useCallback, useState } from 'react';
import { App } from 'antd';
import useBusyAction from './useBusyAction';
import { toastUnlessHandled } from '../utils/apiError';

/**
 * Runs one screen action at a time: `run(kind, fn, okText)` marks `kind` busy (only its
 * button spins), toasts the outcome and resolves to fn's result (true when it returns
 * nothing) or false on failure. When the server refuses with a list of blocking problems
 * (`response.data.errors`), the list is kept in `errors` for the action bar.
 */
const useActionRunner = () => {
  const { message } = App.useApp();
  const { busy, setBusy, busyProps } = useBusyAction();
  const [errors, setErrors] = useState([]);

  const run = useCallback(async (kind, fn, okText) => {
    setBusy(kind);
    setErrors([]);
    try {
      const out = await fn();
      if (okText) message.success(okText);
      return out ?? true;
    } catch (e) {
      const list = e?.response?.data?.errors;
      if (Array.isArray(list) && list.length) setErrors(list);
      toastUnlessHandled(message, e, 'The action could not be completed');
      return false;
    } finally {
      setBusy(null);
    }
  }, [message, setBusy]);

  return { busy, busyProps, run, errors, setErrors };
};

export default useActionRunner;
