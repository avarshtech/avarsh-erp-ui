import { useLayoutEffect, useMemo, useRef } from 'react';
import { QuickCreateProvider } from '../../../components/quickcreate/QuickCreateProvider';
import { useGenieScreen } from '../../../components/genie/genieContext';
import { MasterAssistantContext } from './masterGenieContext';
import { masterSnapshot } from './masterGenieSnapshot';
import { mastersStarters } from './masterGenieStarters';
import useMasterGenieActions from './useMasterGenieActions';

function MasterGenieBridge({ item, items, select, screen }) {
  const actions = useMasterGenieActions({ items, select, screen });
  const view = useMemo(() => ({
    id: 'master-data',
    title: item.label,
    storageKey: 'master', // one conversation across the masters
    blockers: [],
    starters: mastersStarters(item.key),
  }), [item.key, item.label]);

  useGenieScreen(view, {
    ...actions,
    getContext: () => masterSnapshot({ item, items, adapter: screen.current?.ref?.current }),
  });
  return null;
}

/**
 * Laya AI on the Master Data page: the active master registers its list and form through
 * useMasterAssistant; this knows which master that is (`screen`), answers from it, and lets new-item
 * cards open the find-or-create drawer. `select` switches master the way the left menu does.
 */
export default function MasterAssistant({ item, items, select, children }) {
  const screen = useRef(null);
  const activeKey = useRef(item?.key);
  // Layout effects run before any screen's registering effect, so a newly shown master registers
  // under its own key.
  useLayoutEffect(() => { activeKey.current = item?.key; }, [item?.key]);

  const registry = useMemo(() => ({
    register: (ref) => {
      const entry = { ref, entity: activeKey.current };
      screen.current = entry;
      return () => { if (screen.current === entry) screen.current = null; };
    },
  }), []);

  return (
    <QuickCreateProvider>
      <MasterAssistantContext.Provider value={registry}>
        {children}
        {item && <MasterGenieBridge item={item} items={items} select={select} screen={screen} />}
      </MasterAssistantContext.Provider>
    </QuickCreateProvider>
  );
}
