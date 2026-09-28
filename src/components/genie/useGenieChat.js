import { useCallback, useEffect, useRef, useState } from 'react';
import { fileToBase64, genieChat, genieErrorMessage } from '../../services/core/genieService';

let seq = 0;
const nextId = () => `g${Date.now().toString(36)}${++seq}`;
const HISTORY = 12;

/**
 * Sending a turn and applying the answer. The Genie's screen changes are applied by the screen
 * (highlighted, one Undo away) and summarised under its reply; its proposals become cards that
 * create nothing until the user confirms one.
 */
export default function useGenieChat({ screen, handlers, messages, setMessages }) {
  const [busy, setBusy] = useState(false);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);

  const patch = useCallback((id, fields) => setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...fields } : m))), [setMessages]);
  const patchProposal = useCallback((messageId, proposalId, fields) => setMessages((list) => list.map((m) => (m.id !== messageId ? m : {
    ...m, proposals: (m.proposals || []).map((p) => (p.id === proposalId ? { ...p, ...fields } : p)),
  }))), [setMessages]);

  const send = useCallback(async ({ text, audio }) => {
    const message = (text || '').trim();
    if ((!message && !audio) || busy) return;
    const userId = nextId();
    const replyId = nextId();
    const history = messages.filter((m) => !m.pending && !m.error && m.text).slice(-HISTORY)
      .map((m) => ({ role: m.role, text: m.text }));
    setMessages((list) => [...list,
      { id: userId, role: 'user', text: message || 'Voice message', spoken: !!audio },
      { id: replyId, role: 'genie', pending: true }]);
    setBusy(true);
    const ctrl = new AbortController();
    controller.current = ctrl;
    try {
      const body = {
        screenId: screen.id, history, context: handlers()?.getContext?.() || {},
        ...(message ? { message } : {}),
        ...(audio ? { audioBase64: await fileToBase64(audio) } : {}),
      };
      const res = await genieChat(body, ctrl.signal);
      if (res.transcript) patch(userId, { text: res.transcript });
      const results = res.actions?.length ? await handlers()?.applyActions?.(res.actions) || [] : [];
      patch(replyId, {
        pending: false,
        text: res.reply || (results.length ? 'Done.' : ''),
        results,
        undoable: results.some((r) => r.ok && r.changed),
        proposals: (res.proposals || []).map((p) => ({ ...p, status: 'open' })),
      });
    } catch (err) {
      patch(replyId, { pending: false, error: ctrl.signal.aborted ? 'Stopped.' : genieErrorMessage(err) });
    } finally {
      setBusy(false);
      if (controller.current === ctrl) controller.current = null;
    }
  }, [busy, messages, setMessages, screen.id, handlers, patch]);

  const stop = useCallback(() => controller.current?.abort(), []);

  const undo = useCallback((messageId) => {
    handlers()?.undo?.();
    patch(messageId, { undone: true });
  }, [handlers, patch]);

  const confirm = useCallback(async (messageId, proposal) => {
    const done = (text) => patchProposal(messageId, proposal.id, { status: 'done', result: text });
    patchProposal(messageId, proposal.id, { status: 'busy' });
    try {
      const out = await handlers()?.confirmProposal?.(proposal, done);
      if (out?.opened) patchProposal(messageId, proposal.id, { status: 'open' });
      else if (out?.ok) done(out.text);
      else patchProposal(messageId, proposal.id, { status: 'failed', result: out?.text || 'It could not be created.' });
    } catch (err) {
      patchProposal(messageId, proposal.id, { status: 'failed', result: genieErrorMessage(err) });
    }
  }, [handlers, patchProposal]);

  const edit = useCallback((messageId, proposal) => {
    handlers()?.editProposal?.(proposal, (text) => patchProposal(messageId, proposal.id, { status: 'done', result: text }));
  }, [handlers, patchProposal]);

  const dismiss = useCallback((messageId, proposal) => patchProposal(messageId, proposal.id, { status: 'dismissed' }), [patchProposal]);

  const clear = useCallback(() => setMessages(() => []), [setMessages]);

  return { busy, send, stop, undo, confirm, edit, dismiss, clear };
}
