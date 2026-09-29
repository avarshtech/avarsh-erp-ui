import { createContext, useContext, useEffect, useRef } from 'react';

export const GenieContext = createContext(null);

export const useGenie = () => useContext(GenieContext);

/** What the assistant is called on screen (the code still calls it the genie). */
export const ASSISTANT_NAME = 'Laya AI';

/**
 * Puts Laya AI on a screen. `view` is what the launcher and panel show and must be
 * memoised by the caller: { id, title, storageKey, blockers: [text], starters: [text], dock? }
 * (dock: 'left' keeps a right-hand form the assistant fills in view).
 * `handlers` are called by the panel, always in their latest version:
 *   getContext()                 → the screen's state, sent with every question
 *   applyActions(actions)        → [{ ok, text }] — screen tools the Genie called
 *   undo()                       → takes back the last applied batch
 *   confirmProposal(p, onDone)   → { ok, text } | { opened: true } (a drawer took over)
 *   editProposal(p, onDone)      → opens the create form for a proposal
 *   openCapture(mode)            → optional: the screen's own file / voice capture
 */
export function useGenieScreen(view, handlers) {
  const genie = useContext(GenieContext);
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });

  const attach = genie?.attach;
  useEffect(() => attach?.(handlersRef), [attach]);

  const update = genie?.update;
  useEffect(() => { update?.(view); }, [update, view]);
}
