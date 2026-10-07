import { useCallback, useMemo, useState } from 'react';
import { buildRows, matchCount, screenCount } from './accessGridModel';

/**
 * The editor's view of the rights: which section the nav has open, the search and the Show filter.
 * While searching, the nav counts matches and the open section moves to the first with a hit
 * rather than showing an empty table. `jumpTo` clears both and opens a section (a blocked row's link).
 */
const useAccessView = (sections, permissions, changes) => {
  const [activeKey, setActiveKey] = useState(
    () => (sections.find((s) => screenCount(permissions, s.screens).granted > 0) ?? sections[0]).key,
  );
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const searching = query.trim() !== '' || filter !== 'all';
  const matches = useMemo(
    () => (searching ? Object.fromEntries(sections.map((s) => [s.key, matchCount(s, permissions, query, filter)])) : null),
    [searching, sections, permissions, query, filter],
  );
  const effectiveKey = !matches || matches[activeKey] > 0
    ? activeKey
    : (sections.find((s) => matches[s.key] > 0)?.key ?? activeKey);
  const section = sections.find((s) => s.key === effectiveKey) ?? sections[0];
  const rows = useMemo(() => buildRows(section, permissions, query, filter), [section, permissions, query, filter]);

  const dirty = useMemo(() => new Set(changes.map((c) => c.screen.section)), [changes]);
  const items = sections.map((s) => ({
    key: s.key,
    label: s.label,
    icon: s.icon,
    ...screenCount(permissions, s.screens),
    matches: matches?.[s.key],
    dirty: dirty.has(s.key),
  }));

  const jumpTo = useCallback((sectionKey) => {
    setQuery('');
    setFilter('all');
    setActiveKey(sectionKey);
  }, []);

  return { section, rows, items, query, setQuery, filter, setFilter, select: setActiveKey, jumpTo };
};

export default useAccessView;
