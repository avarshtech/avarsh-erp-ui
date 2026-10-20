import { memo } from 'react';
import { Alert, Card, Table, Tag } from 'antd';
import { SYNC_STATE, fmtDateTime } from '../../../utils/tnaConstants';

const syncColumns = [
  { title: 'Module', dataIndex: 'module', width: 140 },
  { title: 'Last event', dataIndex: 'lastEvent', width: 150, render: (v) => (v ? fmtDateTime(v) : '—') },
  { title: 'Lag', dataIndex: 'lag', width: 70, align: 'right' },
  { title: 'Held', dataIndex: 'queued', width: 60, align: 'right' },
  { title: 'Failed', dataIndex: 'failed', width: 64, align: 'right' },
  { title: 'State', dataIndex: 'state', width: 120, render: (v) => <Tag color={SYNC_STATE[v]?.color}>{SYNC_STATE[v]?.label}</Tag> },
];

const reconColumns = [
  { title: 'Check', dataIndex: 'check' },
  { title: 'Compared', dataIndex: 'compared', width: 100, align: 'right' },
  { title: 'Mismatched', dataIndex: 'mismatched', width: 110, align: 'right', render: (v) => <span style={{ color: v ? 'var(--error-color)' : undefined, fontWeight: v ? 700 : 400 }}>{v}</span> },
];

/** FR-12.4 — synchronisation lag, held events and failures per source module, shown to business users. */
export const SyncStatusPanel = memo(function SyncStatusPanel({ rows, loading }) {
  return (
    <Card size="small" title="Synchronisation status by source module">
      <Table rowKey="module" size="small" bordered loading={loading} columns={syncColumns} dataSource={rows} pagination={false} />
      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
        Every inbound event is logged before processing, retried on failure and suppressed when duplicated (FR-9.4, FR-9.5). &quot;Held&quot; events wait on a blocked order.
      </div>
    </Card>
  );
});

/** FR-9.6 — scheduled reconciliation against each source of record; mismatches are never auto-corrected. */
export const ReconciliationPanel = memo(function ReconciliationPanel({ data, loading }) {
  return (
    <Card size="small" title={`Reconciliation — T&A against source of record${data ? ` · ${fmtDateTime(data.lastRunAt)}` : ''}`}>
      <Table rowKey="check" size="small" bordered loading={loading} columns={reconColumns} dataSource={data?.checks || []} pagination={false} />
      <Alert type="warning" style={{ marginTop: 10 }} title="Mismatches raise exceptions. They are never auto-corrected in T&A, because T&A is not the system of record for any of these values." />
    </Card>
  );
});
