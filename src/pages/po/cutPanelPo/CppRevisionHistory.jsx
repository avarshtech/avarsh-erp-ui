import { memo } from 'react';
import { Card, Collapse, Table } from 'antd';
import { formatDate } from '../../../utils/formatters';

const shown = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? formatDate(v) : v);
const COLUMNS = [
  { title: 'Field', dataIndex: 'field' },
  { title: 'Before', dataIndex: 'from', width: 160, render: shown },
  { title: 'After', dataIndex: 'to', width: 160, render: shown },
];
const diff = (changes) => <Table size="small" rowKey={(c) => c.field} pagination={false} dataSource={changes} columns={COLUMNS} />;

/**
 * Amendments with their field-level before / after diff (PRD FR-29, AC-27, report R-8):
 * the open one first and expanded — what its approver is asked to approve — then the
 * approved ones. `pending` = the open amendment with its `changes`.
 */
const CppRevisionHistory = memo(function CppRevisionHistory({ revisions = [], pending }) {
  if (!revisions.length && !pending) return null;
  const items = [
    ...(pending ? [{
      key: 'pending',
      label: `R${pending.revisionNo} — ${pending.reason} · ${pending.status === 'DRAFT' ? 'being drafted' : 'awaiting approval'} · ${pending.changes.length} change(s)`,
      children: diff(pending.changes),
    }] : []),
    ...[...revisions].reverse().map((r) => ({
      key: r.revisionNo,
      label: `R${r.revisionNo} — ${r.reason} · approved by ${r.approvedBy} on ${formatDate(r.approvedOn)} · ${r.changes.length} change(s)`,
      children: diff(r.changes),
    })),
  ];
  return (
    <Card id="cpp-amendments" size="small" title="Amendments" style={{ marginBottom: 16 }}>
      <Collapse size="small" defaultActiveKey={pending ? ['pending'] : []} items={items} />
    </Card>
  );
});

export default CppRevisionHistory;
