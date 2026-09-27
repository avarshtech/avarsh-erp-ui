import { createContext, useContext, useEffect, useRef } from 'react';

export const GenieContext = createContext(null);

export const useGenie = () => useContext(GenieContext);

/**
 * Puts the Help Genie on a screen. `view` is what the launcher and panel show and must be
 * memoised by the caller: { id, title, storageKey, blockers: [text], starters: [text] }.
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
