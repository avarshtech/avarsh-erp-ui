import { memo, useEffect, useMemo, useState } from 'react';
import { Select, Spin } from 'antd';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const toOption = (o) => ({
  value: o.id,
  label: o.orderNo,
  search: `${o.orderNo} ${o.styleNo} ${o.buyer}`.toLowerCase(),
  desc: `${o.styleNo} · ${o.buyer}`,
});

/**
 * Order picker for the requirement screens: type-ahead on order no., style and buyer. Each order is
 * { id, orderNo, styleNo, buyer }.
 *
 * Two ways to find an order:
 * - `orders` only: the whole eligible list is in hand and typing filters it here (Garment Process).
 * - `search` as well: `orders` is just the newest few, shown while the box is empty; typing waits for a pause,
 *   then asks the server through `search(text)` (Cut Panel, owner 2026-11-21: never load every order).
 *   `selected` (the chosen order) keeps its number on screen when it is not in the list being shown.
 */
const RequirementOrderSelect = memo(function RequirementOrderSelect({
  id, orders = [], search, selected, value, onChange, disabled, loading, placeholder = 'Search order no., style or buyer',
}) {
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(300);
  const typed = search ? searchText.trim() : '';
  const text = search ? debouncedSearch.trim() : '';
  const [result, setResult] = useState({ text: '', rows: [] });

  useEffect(() => {
    if (!text) return undefined;
    let alive = true;
    search(text)
      .then((rows) => { if (alive) setResult({ text, rows: rows || [] }); })
      .catch(() => { if (alive) setResult({ text, rows: [] }); }); // the interceptor has said why
    return () => { alive = false; };
  }, [search, text]);

  // Between a keystroke and its answer the list would be stale: show a spinner instead. An empty box shows `orders`.
  const waiting = Boolean(typed) && (typed !== text || result.text !== text);
  const answered = result.text === text;

  const options = useMemo(() => {
    const list = (typed ? (answered ? result.rows : []) : orders).map(toOption);
    if (selected?.id != null && selected.id === value && !list.some((o) => o.value === value)) list.push(toOption(selected));
    return list;
  }, [typed, answered, result.rows, orders, selected, value]);

  return (
    <Select
      id={id}
      showSearch={search
        ? { filterOption: false, onSearch: setSearchText }
        : { filterOption: (input, opt) => opt.search.includes(input.toLowerCase()) }}
      allowClear={false}
      value={value}
      onChange={onChange}
      onOpenChange={search ? (open) => { if (!open) setSearchText(''); } : undefined}
      disabled={disabled}
      loading={loading}
      placeholder={placeholder}
      options={waiting ? [] : options}
      notFoundContent={waiting ? <Spin size="small" /> : undefined}
      optionRender={(opt) => (
        <div>
          <div style={{ fontWeight: 600 }}>{opt.data.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{opt.data.desc}</div>
        </div>
      )}
      style={{ width: '100%' }}
    />
  );
});

export default RequirementOrderSelect;
