import { memo, useMemo, useState } from 'react';
import { Segmented, Table, Tag } from 'antd';
import {
  CHANGE_TYPE, fmtDate, fmtDateTime, fmtText,
} from '../../../utils/tnaConstants';

const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const show = (v) => (v == null ? '—' : isDate(v) ? fmtDate(v) : v);

/**
 * FR-10.1 / FR-10.4 — the append-only history of every date, status and commitment change,
 * distinguishing system-derived changes, source amendments and commitment revisions.
 */
const AuditLog = memo(function AuditLog({ rows }) {
  const [type, setType] = useState('ALL');
  const shown = useMemo(() => (type === 'ALL' ? rows : rows.filter((r) => r.changeType === type)), [rows, type]);
  const columns = useMemo(() => [
    { title: 'When', dataIndex: 'at', width: 140, render: fmtDateTime },
    { title: 'Activity', dataIndex: 'activityCode', width: 80, render: (v) => v || 'Order' },
    { title: 'Field', dataIndex: 'field', width: 190 },
    { title: 'Old', dataIndex: 'oldValue', width: 110, render: show },
    { title: 'New', dataIndex: 'newValue', width: 150, render: show },
    { title: 'Change type', dataIndex: 'changeType', width: 150, render: (v) => <Tag color={CHANGE_TYPE[v]?.color}>{CHANGE_TYPE[v]?.label || v}</Tag> },
    { title: 'Source record', dataIndex: 'sourceRecord', width: 170 },
    { title: 'Actor', dataIndex: 'actor', width: 170, ellipsis: true },
    { title: 'Reason', dataIndex: 'reason', width: 300, ellipsis: true, render: fmtText },
  ], []);
  return (
    <div>
      <Segmented
        style={{ marginBottom: 12 }}
        value={type}
        onChange={setType}
        options={[{ value: 'ALL', label: 'All' }, ...Object.entries(CHANGE_TYPE).filter(([k]) => k !== 'GENERATION' && k !== 'ACKNOWLEDGEMENT').map(([value, c]) => ({ value, label: c.label }))]}
      />
      <Table rowKey="id" size="small" bordered columns={columns} dataSource={shown} pagination={{ pageSize: 50, showSizeChanger: false }} scroll={{ x: 1500, y: 460 }} />
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Append-only: no role, including administrators, can modify or delete an audit entry (FR-10.2).</div>
    </div>
  );
});

export default AuditLog;
