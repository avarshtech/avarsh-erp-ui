import { memo, useMemo } from 'react';
import { Table, Tag, Tooltip, Typography } from 'antd';
import { fmtDate } from '../../../utils/tnaConstants';
import HealthTag from '../components/HealthTag';
import DeltaTag from '../components/DeltaTag';

const { Text } = Typography;
const RISK = { RED: 0, INFEASIBLE: 1, AMBER: 2, BLOCKED: 3, GREEN: 4 };
const mono = { fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 };

/**
 * WF-01 order table. Both commitments, the movement between them (never a delay — FR-7.6),
 * the forecast, and delay on both bases side by side. Ranked by health, then by remaining
 * float on the critical path (FR-11.4) for the chosen basis.
 */
const OrderRiskTable = memo(function OrderRiskTable({ rows, basis, loading, onOpen }) {
  const sorted = useMemo(() => [...rows].sort((x, y) => {
    const hx = basis === 'original' ? x.healthOriginal : x.healthLatest;
    const hy = basis === 'original' ? y.healthOriginal : y.healthLatest;
    const fx = basis === 'original' ? x.dispatchFloatOriginal : x.dispatchFloatLatest;
    const fy = basis === 'original' ? y.dispatchFloatOriginal : y.dispatchFloatLatest;
    return RISK[hx] - RISK[hy] || (fx ?? 999) - (fy ?? 999);
  }), [rows, basis]);

  const columns = useMemo(() => [
    { title: 'Order', dataIndex: 'orderNo', width: 132, fixed: 'left', render: (v) => <Text style={mono}>{v}</Text> },
    { title: 'Buyer / style', key: 'buyer', width: 170, render: (_, r) => <span>{r.buyer} / <Text type="secondary">{r.styleNo}</Text></span> },
    { title: 'Order date', dataIndex: 'orderDate', width: 104, render: fmtDate },
    { title: 'Original dispatch', dataIndex: 'originalCommitment', width: 116, render: fmtDate },
    { title: 'Latest dispatch', dataIndex: 'latestCommitment', width: 112, render: fmtDate },
    {
      title: 'Commit. movement', dataIndex: 'commitmentMovement', width: 120, align: 'center',
      render: (v) => (v ? <DeltaTag value={v} tone="movement" tip="Commitment movement — reported on its own, never as delay" /> : '—'),
    },
    {
      title: 'Forecast dispatch', dataIndex: 'forecastDispatch', width: 124,
      render: (v, r) => (r.status === 'BLOCKED' ? <Tag>Not computed</Tag> : fmtDate(v)),
    },
    { title: 'Vs original', dataIndex: 'delayOriginal', width: 96, align: 'center', render: (v) => <DeltaTag value={v} tip="Forecast − original commitment" /> },
    { title: 'Vs latest', dataIndex: 'delayLatest', width: 92, align: 'center', render: (v) => <DeltaTag value={v} tip="Forecast − latest commitment" /> },
    {
      title: 'Progress', dataIndex: 'progress', width: 84, align: 'right',
      render: (p) => (p ? <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.done} / {p.total}</span> : '0 / —'),
    },
    { title: 'Next gate', dataIndex: 'nextGate', width: 190, ellipsis: true, render: (g) => (g ? <Tooltip title={`Target ${fmtDate(g.revisedTarget)}`}>{g.name}</Tooltip> : '—') },
    {
      title: 'Crit.', key: 'crit', width: 60, align: 'right',
      render: (_, r) => {
        const n = basis === 'original' ? r.openCriticalOriginal : r.openCriticalLatest;
        return n == null ? '—' : <span style={{ color: n ? 'var(--error-color)' : undefined, fontWeight: n ? 600 : 400 }}>{n}</span>;
      },
    },
    {
      title: 'Health', key: 'health', width: 108, fixed: 'right', align: 'center',
      render: (_, r) => <HealthTag health={basis === 'original' ? r.healthOriginal : r.healthLatest} />,
    },
  ], [basis]);

  return (
    <Table
      rowKey="id"
      size="small"
      bordered
      loading={loading}
      columns={columns}
      dataSource={sorted}
      pagination={false}
      scroll={{ x: 1600, y: 'calc(100vh - 420px)' }}
      onRow={(r) => ({ onClick: () => onOpen(r), style: { cursor: 'pointer' } })}
      locale={{ emptyText: 'No live orders match these filters' }}
    />
  );
});

export default OrderRiskTable;
