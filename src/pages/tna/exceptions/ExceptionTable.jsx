import { memo, useMemo } from 'react';
import {
  Button, Table, Tag, Tooltip, Typography,
} from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  EXCEPTION_STATUS, EXCEPTION_TYPE, SEVERITY, fmtText,
} from '../../../utils/tnaConstants';

const { Text } = Typography;

/** The single action each exception type allows; anything else is corrected in its source. */
const ActionCell = ({ x, canAct, asOf, onResolve, onAcknowledge }) => {
  if (x.status !== 'OPEN') return <Tag color={EXCEPTION_STATUS[x.status]?.color}>{EXCEPTION_STATUS[x.status]?.label}</Tag>;
  const gated = (btn) => (canAct ? btn : <Tooltip title="Needs Time & Action update permission">{btn}</Tooltip>);
  switch (x.type) {
    case 'IDENTITY_UNRESOLVED': return gated(<Button size="small" type="primary" disabled={!canAct} onClick={() => onResolve(x)}>Resolve link</Button>);
    case 'INFEASIBLE_COMMITMENT': return gated(<Button size="small" danger disabled={!canAct} onClick={() => onAcknowledge(x)}>Acknowledge</Button>);
    case 'DATA_ISSUE_REPORTED':
    case 'RECONCILIATION_MISMATCH': return gated(<Button size="small" disabled={!canAct} onClick={() => onResolve(x)}>Mark corrected</Button>);
    case 'MISSING_MANDATORY_INPUT': return <Link to="/bom/list">Create BOM</Link>;
    case 'AWAITING_SOURCE': return <Tooltip title={`Needs the source enhancement; checked ${asOf}`}><Text type="secondary">Round 2</Text></Tooltip>;
    default: return x.orderId ? <Link to={`/tna/plan/${x.orderId}`}>Open plan</Link> : '—';
  }
};

/** WF-08 — blocking and warning exceptions with severity, owner, age and the permitted action (FR-8.7). */
const ExceptionTable = memo(function ExceptionTable({ rows, loading, asOf, canAct, onResolve, onAcknowledge }) {
  const columns = useMemo(() => [
    { title: 'Sev', dataIndex: 'severity', width: 70, fixed: 'left', render: (v) => <Tag color={SEVERITY[v].color} style={{ marginInlineEnd: 0 }}>{SEVERITY[v].label}</Tag> },
    {
      title: 'Order', dataIndex: 'orderNo', width: 140, fixed: 'left',
      render: (v, x) => (x.orderId ? <Link to={`/tna/plan/${x.orderId}`}><Text strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>{v}</Text></Link> : <Tooltip title={x.orders?.join(', ')}>{v}</Tooltip>),
    },
    { title: 'Exception', dataIndex: 'type', width: 190, render: (v) => EXCEPTION_TYPE[v] || v },
    { title: 'Detail', dataIndex: 'detail', width: 380, render: fmtText },
    { title: 'Source record', dataIndex: 'sourceRecord', width: 150, render: (v) => (v && v !== '—' ? <Text code style={{ fontSize: 12 }}>{v}</Text> : '—') },
    { title: 'System behaviour', dataIndex: 'systemBehaviour', width: 280 },
    { title: 'Owner', dataIndex: 'ownerRole', width: 150 },
    { title: 'Age', dataIndex: 'raisedOn', width: 70, align: 'right', render: (v) => (v ? `${dayjs(asOf).diff(dayjs(v.slice(0, 10)), 'day')} d` : '—') },
    { title: 'Action', key: 'act', width: 140, fixed: 'right', render: (_, x) => <ActionCell x={x} canAct={canAct} asOf={asOf} onResolve={onResolve} onAcknowledge={onAcknowledge} /> },
  ], [asOf, canAct, onResolve, onAcknowledge]);
  return (
    <Table
      rowKey="id"
      size="small"
      bordered
      loading={loading}
      columns={columns}
      dataSource={rows}
      pagination={false}
      scroll={{ x: 1600, y: 440 }}
      locale={{ emptyText: 'No exceptions — every live order is planned and every source is linked' }}
    />
  );
});

export default ExceptionTable;
