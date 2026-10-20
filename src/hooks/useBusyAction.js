import { useCallback, useState } from 'react';

/**
 * Tracks which ONE of a screen's sibling actions (Save Draft, Submit, Approve,
 * Reject, ...) is in flight, so only the clicked button spins. The others are
 * disabled until it settles, which keeps the double-fire protection that a single
 * shared `saving` boolean used to give for free.
 *
 *   const { busy, setBusy, busyProps } = useBusyAction();
 *
 *   const handleSaveDraft = async () => {
 *     setBusy('draft');
 *     try { ... } finally { setBusy(null); }
 *   };
 *
 *   <ActionButton {...busyProps('draft')} onClick={handleSaveDraft} />
 *   <ActionButton {...busyProps('submit', !ppApproved)} onClick={handleSubmit} />
 *
 * `busyProps(key, disabled)` folds the button's own disabled condition in, because
 * a `disabled={...}` written after the spread would replace the cross-disable.
 * `busy` is the active key or null, so `!!busy` still works wherever a screen wants
 * "is anything running" (a page-level Spin, a modal's confirming flag).
 */
export default function useBusyAction() {
  const [busy, setBusy] = useState(null);

  const busyProps = useCallback((key, disabled = false) => ({
    loading: busy === key,
    disabled: Boolean(disabled) || (busy !== null && busy !== key),
  }), [busy]);

  return { busy, setBusy, busyProps };
}
