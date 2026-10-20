import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import QuickCreateDrawer from './QuickCreateDrawer';

const QuickCreateContext = createContext(null);

/**
 * Lets any control on the page — a grid picker, the tech pack review, the Help Genie — open the
 * "create it here" drawer for a missing master and get the saved record back:
 *
 *   const { open } = useQuickCreate();
 *   open('item', { prefill: { text: 'rib 1x1 black', category: 'Fabric' }, onCreated: (variant) => … });
 */
export function QuickCreateProvider({ children }) {
  const [request, setRequest] = useState(null);

  const open = useCallback((type, options = {}) => setRequest({ type, ...options, id: Date.now() }), []);
  const close = useCallback(() => setRequest(null), []);
  const done = useCallback((record, extra) => {
    request?.onCreated?.(record, extra);
    setRequest(null);
  }, [request]);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <QuickCreateContext.Provider value={value}>
      {children}
      <QuickCreateDrawer request={request} onClose={close} onDone={done} />
    </QuickCreateContext.Provider>
  );
}

const NOOP = { open: () => {} };
// eslint-disable-next-line react-refresh/only-export-components
export const useQuickCreate = () => useContext(QuickCreateContext) ?? NOOP;
