import { memo, useMemo } from 'react';
import {
  Space, Table, Tag, Tooltip, Typography,
} from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { fmtDate, SOURCE_STATUS } from '../../../utils/tnaConstants';
import TnaStatusTag from '../components/TnaStatusTag';
import DeltaTag from '../components/DeltaTag';

const { Text } = Typography;
const mono = { fontFamily: 'var(--font-mono, monospace)', fontSize: 12 };

const ActivityCell = ({ a }) => (
  <div>
    <Space size={4} wrap>
      <span>{a.name}</span>
      {a.isGate && <Tag color="blue" style={{ marginInlineEnd: 0 }}>gate</Tag>}
      {a.provisional && <Tooltip title="Requirement still in Draft — planned from master defaults, outside the baseline"><Tag color="gold" style={{ marginInlineEnd: 0 }}>provisional</Tag></Tooltip>}
      {a.postBaseline && <Tooltip title={`${a.addendumReason} · ${fmtDate(a.addendumOn)}`}><Tag color="cyan" style={{ marginInlineEnd: 0 }}>addendum</Tag></Tooltip>}
      {a.awaitingSource && <Tooltip title={a.missingNote}><Tag color="orange" style={{ marginInlineEnd: 0 }}>awaiting source</Tag></Tooltip>}
    </Space>
    {a.scope && (
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {a.scope.colours.join(', ')} · {a.requiredQty.toLocaleString('en-IN')} pcs{a.scope.panels.length ? ` · ${a.scope.panels.join(', ')}` : ''}
      </div>
    )}
    {!a.actualDate && a.progressPct > 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.progressPct}% received · threshold {a.threshold}%</div>}
  </div>
);

/**
 * WF-02 — every column is derived; nothing on this grid is typed. Baseline, revised target,
 * forecast and actual are four separately held values (FR-5.5). Float is against the latest
 * commitment, with the original available as a toggle (FR-3.7).
 */
const PlanGrid = memo(function PlanGrid({ activities, floatBasis, onOpen }) {
  const columns = useMemo(() => [
    { title: 'Code', dataIndex: 'code', width: 64, fixed: 'left', render: (v) => <Text style={{ ...mono, fontWeight: 600 }}>{v}</Text> },
    { title: 'Activity', key: 'name', width: 250, fixed: 'left', render: (_, a) => <ActivityCell a={a} /> },
    {
      title: 'Source screen', dataIndex: 'sourceScreen', width: 160,
      render: (v, a) => (
        <Tooltip title={`${SOURCE_STATUS[a.sourceStatus].hint}. Completes on ${a.completionEvent}`}>
          <Tag style={{ marginInlineEnd: 0 }} color={a.sourceStatus === 'LIVE' ? undefined : SOURCE_STATUS[a.sourceStatus].color}>
            {v}{a.sourceStatus === 'PROPOSED' ? ' *' : ''}
          </Tag>
        </Tooltip>
      ),
    },
    { title: 'Pred.', dataIndex: 'predecessors', width: 86, render: (p) => <span style={{ ...mono, color: 'var(--text-secondary)' }}>{p.length ? p.join(', ') : '—'}</span> },
    { title: 'Dur', key: 'dur', width: 64, align: 'right', render: (_, a) => <Tooltip title={a.dayType === 'CD' ? 'Calendar days' : 'Working days'}><span style={mono}>{a.duration} {a.dayType}</span></Tooltip> },
    { title: 'Baseline', dataIndex: 'baselineDate', width: 104, render: (v, a) => (v ? fmtDate(v) : <Tooltip title={a.provisional ? 'Provisional — outside the baseline' : 'No baseline'}>—</Tooltip>) },
    { title: 'Revised target', dataIndex: 'revisedTarget', width: 110, render: fmtDate },
    { title: 'Forecast', dataIndex: 'forecastDate', width: 104, render: fmtDate },
    { title: 'Actual', dataIndex: 'actualDate', width: 104, render: (v) => (v ? <strong>{fmtDate(v)}</strong> : '—') },
    { title: 'Base var', dataIndex: 'baselineVariance', width: 84, align: 'center', render: (v) => <DeltaTag value={v} unit="WD" tip="Actual (or forecast) − baseline, working days" /> },
    {
      title: 'Overdue', dataIndex: 'overdueDays', width: 76, align: 'center',
      render: (v) => (v > 0 ? <Tooltip title="Working days past the revised target — ages daily, event or not (FR-7.8)"><Tag color="red" style={{ marginInlineEnd: 0 }}>{v}</Tag></Tooltip> : '—'),
    },
    {
      title: 'Float', key: 'float', width: 64, align: 'right',
      render: (_, a) => {
        const f = floatBasis === 'original' ? a.floatDaysOriginal : a.floatDays;
        return <span style={{ ...mono, color: f <= 0 ? 'var(--error-color)' : undefined, fontWeight: f <= 0 ? 700 : 400 }}>{f}</span>;
      },
    },
    { title: 'Status', dataIndex: 'status', width: 140, render: (s) => <TnaStatusTag status={s} /> },
    { title: <LockOutlined />, key: 'lock', width: 40, align: 'center', fixed: 'right', render: () => <Tooltip title="Read-only — derived from source"><LockOutlined style={{ color: 'var(--text-muted)' }} /></Tooltip> },
  ], [floatBasis]);

  return (
    <Table
      rowKey="code"
      size="small"
      bordered
      columns={columns}
      dataSource={activities}
      pagination={false}
      scroll={{ x: 1650, y: 'calc(100vh - 380px)' }}
      onRow={(a) => ({ onClick: () => onOpen(a.code), style: { cursor: 'pointer' } })}
    />
  );
});

export default PlanGrid;
