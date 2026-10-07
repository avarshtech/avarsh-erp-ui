import { memo } from 'react';
import { Tooltip } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { FIELD_LABEL, FIELD_VALUE } from './poFieldStyles';

const BOX = {
  border: '1px dashed var(--border-color, #d9d9d9)',
  background: 'var(--bg-secondary, rgba(0, 0, 0, 0.03))',
  borderRadius: 6,
  padding: '4px 10px',
  minHeight: 32,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

/**
 * A requirement-derived value on a job-work PO, in the Supplier PO view's label-over-value style. `locked` (the PO is
 * being edited) draws it as visibly read-only — dashed border, grey fill, a lock — beside the inputs (CPP §18.2, GPO
 * §19); viewed, it is plain text like every other field. A list of several values shows the first and "Multiple (n)",
 * the rest in a tooltip.
 */
const ReadOnlyField = memo(function ReadOnlyField({ label, value, values, locked = false }) {
  const list = values ? [...new Set(values.filter(Boolean))] : null;
  let shown = value ?? '—';
  if (list) shown = list.length > 1 ? <Tooltip title={list.join(', ')}>Multiple ({list.length})</Tooltip> : list[0] ?? '—';
  return (
    <div>
      <div style={FIELD_LABEL}>{label}</div>
      {locked
        ? <div style={BOX}><LockOutlined style={{ fontSize: 11, opacity: 0.45 }} /><span>{shown}</span></div>
        : <div style={FIELD_VALUE}>{shown}</div>}
    </div>
  );
});

export default ReadOnlyField;
