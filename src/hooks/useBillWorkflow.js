import { useCallback, useState } from 'react';
import { App } from 'antd';
import useBusyAction from './useBusyAction';

/**
 * The mutation plumbing every bill workspace shares (supplier and job-work bills alike).
 *
 * `run(key, fn, successMsg, onError)` calls a service verb and hands the bill it returns to `onAdopt`;
 * `busyProps(key)` spins only that action's button. `openReason(cfg)` asks for a typed justification first
 * and `reasonModal` is spread onto <BillReasonModal>.
 */
export default function useBillWorkflow(onAdopt) {
  const { message } = App.useApp();
  const { busy, setBusy, busyProps } = useBusyAction();
  const [reasonCfg, setReasonCfg] = useState(null);
  const [reasonText, setReasonText] = useState('');

  const run = useCallback(async (key, fn, successMsg, onError) => {
    setBusy(key);
    try {
      const next = await fn();
      // Adopt what came back, version included: the next call sends that version.
      if (next?.id) onAdopt(next);
      if (successMsg) message.success(successMsg);
      return next;
    } catch (e) {
      // A caller that can offer a way out of this particular failure says so by returning true.
      if (onError?.(e)) return null;
      // axiosInstance already toasts the server's message; only speak when it could not have.
      if (!e.response) message.error(e.message || 'Action failed');
      return null;
    } finally {
      setBusy(null);
    }
  }, [message, setBusy, onAdopt]);

  const openReason = useCallback((cfg) => { setReasonText(''); setReasonCfg(cfg); }, []);

  const submitReason = useCallback(async () => {
    if (!reasonCfg) return;
    const text = reasonText.trim();
    const min = reasonCfg.minLength ?? 10;
    if (text.length < min) {
      message.warning(`Please enter at least ${min} characters`);
      return;
    }
    const cfg = reasonCfg;
    setReasonCfg(null);
    await run(cfg.key, () => cfg.onSubmit(text), cfg.successMsg);
  }, [reasonCfg, reasonText, run, message]);

  const reasonModal = {
    cfg: reasonCfg, text: reasonText, onText: setReasonText, onOk: submitReason,
    onCancel: () => setReasonCfg(null), busy: busy !== null,
  };
  return { busyProps, run, openReason, reasonModal };
}
