import { memo, useMemo } from 'react';
import { Card, Table, Tag } from 'antd';
import { metricColumns, num, pct, toneOf, GRAND_FILL } from './strengthFormat';
import './strengthReport.css';

const KIND_TAG = {
  CONTRACTOR: <Tag color="purple">Contract</Tag>,
  NEW_JOINERS: <Tag color="geekblue">New</Tag>,
};

/**
 * A small table with a total row: the unit-wise view of one designation
 * ("Tailors strength - unit-wise"), or the administrator's contract labour table.
 */
const StrengthSummaryCard = memo(function StrengthSummaryCard({
  title, extra, summary, report, labelTitle, withNewJoiners = false, loading,
}) {
  const columns = useMemo(() => [
    { title: 'S.No', key: 'sno', width: 56, align: 'center', render: (_, __, i) => i + 1 },
    {
      title: labelTitle, dataIndex: 'label', key: 'label',
      render: (label, r) => <span>{label} {KIND_TAG[r.kind]}</span>,
    },
    ...metricColumns(report, { withNewJoiners }).map((m) => ({
      title: m.title,
      key: m.key,
      align: 'right',
      width: 84,
      onCell: (r) => (m.percent ? { className: `strength-tone-${toneOf(r.counts.absentPct)}` } : {}),
      render: (_, r) => (m.percent ? pct(r.counts[m.key]) : num(r.counts[m.key])),
    })),
  ], [report, labelTitle, withNewJoiners]);

  const rows = summary?.rows ?? [];
  const total = summary?.total;
  const metrics = metricColumns(report, { withNewJoiners });

  return (
    <Card title={title} extra={extra} styles={{ body: { padding: 0 } }} style={{ height: '100%' }}>
      <Table
        className="strength-table"
        size="small"
        bordered
        rowKey={(r) => `${r.kind}-${r.id ?? r.label}`}
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        locale={{ emptyText: 'Nobody with this designation on the roll' }}
        summary={() => (rows.length && total ? (
          <Table.Summary.Row style={{ background: GRAND_FILL, color: '#fff', fontWeight: 700 }}>
            <Table.Summary.Cell index={0} colSpan={2} align="center">Total</Table.Summary.Cell>
            {metrics.map((m, i) => (
              <Table.Summary.Cell key={m.key} index={i + 2} align="right">
                {m.percent ? pct(total[m.key]) : num(total[m.key])}
              </Table.Summary.Cell>
            ))}
          </Table.Summary.Row>
        ) : null)}
      />
    </Card>
  );
});

export default StrengthSummaryCard;
