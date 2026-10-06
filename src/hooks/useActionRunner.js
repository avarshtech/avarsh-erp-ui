import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from 'antd';
import useBusyAction from './useBusyAction';
import { errorText, toastUnlessHandled } from '../utils/apiError';

const NONE = [];

/**
 * Runs one screen action at a time: `run(kind, fn, okText)` marks `kind` busy (only its
 * button spins), toasts the outcome and resolves to fn's result (true when it returns
 * nothing) or false on failure. When the server refuses with a list of blocking problems
 * (`response.data.errors`), the list is kept in `errors` for the action bar — only while
 * the screen still shows the same `scope` (e.g. the document id), so a screen that moves
 * on to another document never shows the previous one's errors.
 */
const useActionRunner = (scope = null) => {
  const { message } = App.useApp();
  const { busy, setBusy, busyProps } = useBusyAction();
  // The latest scope, so an action that moves the screen (a first save) files its errors under the new one.
  const scopeRef = useRef(scope);
  useEffect(() => { scopeRef.current = scope; });
  const [raised, setRaised] = useState({ scope: null, list: NONE });
  const setErrors = useCallback((list) => setRaised({ scope: scopeRef.current, list }), []);
  const errors = raised.scope === scope ? raised.list : NONE;

  const run = useCallback(async (kind, fn, okText) => {
    setBusy(kind);
    setErrors([]);
    try {
      const out = await fn();
      if (okText) message.success(okText);
      return out ?? true;
    } catch (e) {
      const list = e?.response?.data?.errors;
      const listed = Array.isArray(list) && list.length > 0;
      if (listed) setErrors(list);
      // A `silent` request left the toast to us: the action bar shows a list, anything else is toasted here
      if (e?.config?.silent) {
        if (!listed) message.error(errorText(e, 'The action could not be completed'));
      } else {
        toastUnlessHandled(message, e, 'The action could not be completed');
      }
      return false;
    } finally {
      setBusy(null);
    }
  }, [message, setBusy, setErrors]);

  return { busy, busyProps, run, errors, setErrors };
};

export default useActionRunner;
