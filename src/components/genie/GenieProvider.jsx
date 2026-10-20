import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GenieContext } from './genieContext';
import GenieLauncher from './GenieLauncher';
import GeniePanel from './GeniePanel';
import './genie.css';

const STORE = 'avarsh-genie-threads';
const KEEP = 40;

const readThreads = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORE) || '{}') || {};
  } catch {
    return {};
  }
};

/**
 * The Help Genie shell, mounted once in the main layout. It shows nothing until a screen puts the
 * Genie on itself (useGenieScreen); then a launcher appears bottom-right and opens a docked chat
 * panel. Conversations are kept per screen instance for the browser session.
 */
export default function GenieProvider({ children }) {
  const [screen, setScreen] = useState(null);
  const [open, setOpen] = useState(false);
  const [threads, setThreads] = useState(readThreads);
  const handlersRef = useRef(null);

  const attach = useCallback((ref) => {
    handlersRef.current = ref;
    return () => {
      if (handlersRef.current !== ref) return;
      handlersRef.current = null;
      setScreen(null);
      setOpen(false);
    };
  }, []);
  const update = useCallback((view) => setScreen(view), []);

  const updateThread = useCallback((key, fn) => setThreads((all) => ({ ...all, [key]: fn(all[key] || []) })), []);

  useEffect(() => {
    try {
      const kept = Object.fromEntries(Object.entries(threads).map(([k, list]) => [k, list.filter((m) => !m.pending).slice(-KEEP)]));
      sessionStorage.setItem(STORE, JSON.stringify(kept));
    } catch {
      // Storage full or blocked: the conversation still works, it just is not kept.
    }
  }, [threads]);

  const value = useMemo(() => ({ attach, update }), [attach, update]);
  const handlers = useCallback(() => handlersRef.current?.current, []);

  return (
    <GenieContext.Provider value={value}>
      {children}
      {screen && (
        <>
          <GenieLauncher open={open} blockers={screen.blockers?.length || 0} onToggle={() => setOpen((o) => !o)} />
          {open && (
            <GeniePanel
              screen={screen} handlers={handlers} onClose={() => setOpen(false)}
              messages={threads[screen.storageKey] || []}
              setMessages={(fn) => updateThread(screen.storageKey, fn)}
            />
          )}
        </>
      )}
    </GenieContext.Provider>
  );
}
