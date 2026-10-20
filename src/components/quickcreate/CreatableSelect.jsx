import { useMemo, useState } from 'react';
import { Select } from 'antd';
import { canQuickCreate, quickCreateHint } from './quickCreateTypes';

const CREATE_OPTION = '__create__';

const defaultFilter = (input, option) =>
  String(option?.label ?? '').toLowerCase().includes(String(input).toLowerCase());

/**
 * A searchable Select whose last option is `+ Create "<what you typed>"`, like Odoo's
 * many-to-one fields. It is a real option, not a footer link, so it is reachable with the
 * arrow keys and Enter. Without the create permission it is shown disabled, naming the right
 * to ask for, instead of silently missing.
 *
 * `onCreate(text)` is called instead of `onChange` when the create option is picked.
 * `canCreate` / `createHint` override the permission check for creates that need a different
 * right than `createType`'s (a new sub-category needs master-data:add).
 */
export default function CreatableSelect({
  options = [], value, onChange, onCreate, createType, createLabel = 'Create', canCreate, createHint,
  onSearch, filterOption, ...rest
}) {
  const [search, setSearch] = useState('');
  const text = search.trim();
  const allowed = canCreate ?? canQuickCreate(createType);

  const allOptions = useMemo(() => {
    const lower = text.toLowerCase();
    if (!text || !onCreate || options.some((o) => String(o.label).toLowerCase() === lower)) return options;
    return [...options, {
      value: CREATE_OPTION,
      label: `+ ${createLabel} "${text}"`,
      disabled: !allowed,
      title: allowed ? undefined : createHint || quickCreateHint(createType),
    }];
  }, [options, text, onCreate, createLabel, allowed, createType, createHint]);

  const filter = filterOption || defaultFilter;

  return (
    <Select
      {...rest}
      // Always controlled: with `undefined` AntD keeps its own value, and picking the create
      // option would leave `+ Create "…"` showing as if it were selected. null = empty.
      value={value === undefined ? null : value}
      options={allOptions}
      showSearch={{
        filterOption: (input, option) => option?.value === CREATE_OPTION || filter(input, option),
        onSearch: (value) => { setSearch(value); onSearch?.(value); },
      }}
      onOpenChange={(open) => { if (!open) setSearch(''); }}
      onChange={(value, option) => {
        if (value === CREATE_OPTION) {
          onCreate(text);
          setSearch('');
          return;
        }
        onChange?.(value, option);
      }}
    />
  );
}
