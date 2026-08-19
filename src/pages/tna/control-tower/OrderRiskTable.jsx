import { memo, useMemo } from 'react';
import { Table, Progress, Tag, Badge, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import RagBadge from '../components/RagBadge';
import TnaStatusTag from '../components/TnaStatusTag';
import { FEASIBILITY } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import { getTablePagination } from '../../../utils/paginationConfig';

const RAG_RANK = { RED: 0, AMBER: 1, GREEN: 2 };

/** Risk-ranked cross-order table — reds surface first, projected delay is the headline. */
const OrderRiskTable = memo(function OrderRiskTable({ plans, loading }) {
  const navigate = useNavigate();

  const dataSource = useMemo(() => [...plans].sort((a, b) => (RAG_RANK[a.rag] - RAG_RANK[b.rag]) || (b.projectedDelay - a.projectedDelay)), [plans]);

  const columns = useMemo(() => [
    { title: '', dataIndex: 'rag', width: 40, render: (rag, r) => <RagBadge rag={rag} showLabel={false} tooltip={`${rag === 'RED' ? 'Delayed' : rag === 'AMBER' ? 'At risk' : 'On track'} — projected ${r.projectedDelay > 0 ? `${r.projectedDelay}d late` : 'on time'}`} /> },
    {
      title: 'Order / Style',
      dataIndex: 'orderNo',
      render: (v, r) => (
        <div>
          <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v}</span>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.buyer} · {r.styleNo} · {r.productType}</div>
        </div>
      ),
    },
    { title: 'ETD', dataIndex: 'etd', width: 130, render: (v) => (
      <div>
        <div style={{ fontVariantNumeric: 'tabular-nums' }}>{dayjs(v).format(DATE_FORMAT)}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dayjs(v).diff(dayjs(), 'day')}d to go</div>
      </div>
    ) },
    { title: 'Progress', dataIndex: 'progressPct', width: 120, render: (v) => <Progress percent={v} size="small" status={v >= 100 ? 'success' : 'active'} /> },
    {
      title: 'Next Milestone',
      dataIndex: 'nextMilestone',
      render: (m) => (m ? (
        <div>
          <div style={{ fontSize: 12, fontWeight: 500 }}>{m.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dayjs(m.plannedDate).format(DATE_FORMAT)} <TnaStatusTag status={m.status} size="small" /></div>
        </div>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>),
    },
    {
      title: <Tooltip title="Projected dispatch − ETD. Positive means late. Recomputed live from actuals.">Proj. Delay</Tooltip>,
      dataIndex: 'projectedDelay',
      width: 100,
      align: 'right',
      render: (v) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 15, color: v > 0 ? 'var(--error-color)' : 'var(--success-color)' }}>
          {v > 0 ? `+${v}d` : v === 0 ? 'On ETD' : `${v}d`}
        </span>
      ),
    },
    {
      title: <Tooltip title="Zero-float activities past their planned date — each one has already moved the ship date">Crit.</Tooltip>,
      dataIndex: 'overdueCriticals',
      width: 60,
      align: 'center',
      render: (v) => (v ? <Badge count={v} /> : <span style={{ color: 'var(--text-muted)' }}>0</span>),
    },
    {
      title: 'Feasibility',
      dataIndex: 'feasibility',
      width: 130,
      render: (v, r) => (v === 'FEASIBLE' ? null : (
        <Tag color={FEASIBILITY[v].color} style={{ fontSize: 11 }}>
          {v === 'INFEASIBLE' ? `Short ${r.shortfallDays}d` : `Compressed ${r.compressedDays}d`}
        </Tag>
      )),
    },
  ], []);

  return (
    <Table
      rowKey="id"
      size="small"
      loading={loading}
      columns={columns}
      dataSource={dataSource}
      onRow={(r) => ({ onClick: () => navigate(`/tna/plan/${r.id}`), style: { cursor: 'pointer' } })}
      pagination={getTablePagination({ pageSize: 10 }, 'orders')}
      scroll={{ x: 900 }}
    />
  );
});

export default OrderRiskTable;
