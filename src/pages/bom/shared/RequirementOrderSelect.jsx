import { memo, useMemo } from 'react';
import { Select } from 'antd';

/**
 * Order picker for the requirement screens: type-ahead on order no., style and buyer.
 * `orders` is the eligible list from the module's service ({ id, orderNo, styleNo, buyer }).
 */
const RequirementOrderSelect = memo(function RequirementOrderSelect({
  id, orders = [], value, onChange, disabled, loading, placeholder = 'Search order no., style or buyer',
}) {
  const options = useMemo(() => orders.map((o) => ({
    value: o.id,
    label: o.orderNo,
    search: `${o.orderNo} ${o.styleNo} ${o.buyer}`.toLowerCase(),
    desc: `${o.styleNo} · ${o.buyer}`,
  })), [orders]);

  return (
    <Select
      id={id}
      showSearch
      allowClear={false}
      value={value}
      onChange={onChange}
      disabled={disabled}
      loading={loading}
      placeholder={placeholder}
      options={options}
      filterOption={(input, opt) => opt.search.includes(input.toLowerCase())}
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
