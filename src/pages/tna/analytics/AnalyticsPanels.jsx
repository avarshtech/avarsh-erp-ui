import { memo } from 'react';
import {
  Alert, Card, Progress, Table, Tag, Typography,
} from 'antd';
import { Link } from 'react-router-dom';
import { ATTRIBUTION, signedDays } from '../../../utils/tnaConstants';
import DeltaTag from '../components/DeltaTag';

const { Text } = Typography;
const num = { fontVariantNumeric: 'tabular-nums' };

/** Attribution as a share of NET ORDER IMPACT through the network — never summed variances (FR-11.6). */
export const AttributionPanel = memo(function AttributionPanel({ rows, ceilingPct }) {
  const columns = [
    { title: 'Attributed to', dataIndex: 'category', render: (v) => <span style={{ fontStyle: v === 'REASON_UNAVAILABLE' ? 'italic' : undefined }}>{ATTRIBUTION[v]?.label || v}</span> },
    { title: 'Evidence source', dataIndex: 'evidenceSource' },
    { title: 'Orders', dataIndex: 'orders', width: 70, align: 'right' },
    { title: 'Mean impact', dataIndex: 'meanImpact', width: 100, align: 'right', render: (v) => <span style={num}>{v} CD</span> },
    { title: 'Share', dataIndex: 'share', width: 150, render: (v) => <Progress percent={v} size="small" strokeColor="var(--primary-color)" /> },
  ];
  const unavailable = rows.find((r) => r.category === 'REASON_UNAVAILABLE');
  return (
    <Card size="small" title="Delay attribution — share of net order impact">
      <Table rowKey="category" size="small" bordered columns={columns} dataSource={rows} pagination={false} />
      {unavailable && unavailable.share > ceilingPct && (
        <Alert type="warning" showIcon style={{ marginTop: 10 }} title={`"Reason unavailable" is ${unavailable.share}% of impact — above the ${ceilingPct}% service level (D-09). Data gaps stay visible instead of being absorbed into a plausible reason.`} />
      )}
    </Card>
  );
});

/** Commitment movement by buyer — reported separately; it never enters a delay figure (FR-7.6). */
export const CommitmentMovementPanel = memo(function CommitmentMovementPanel({ rows }) {
  const columns = [
    { title: 'Buyer', dataIndex: 'buyer' },
    { title: 'Orders revised', dataIndex: 'revised', width: 110, align: 'right' },
    { title: 'Mean movement', dataIndex: 'meanMovement', width: 120, align: 'right', render: (v) => (v ? <DeltaTag value={v} tone="movement" /> : '—') },
    { title: 'Late vs original', dataIndex: 'lateOriginal', width: 120, align: 'right' },
    { title: 'Late vs latest', dataIndex: 'lateLatest', width: 110, align: 'right' },
  ];
  return (
    <Card size="small" title="Commitment movement — reported separately">
      <Table rowKey="buyer" size="small" bordered columns={columns} dataSource={rows} pagination={false} />
      <Alert type="info" style={{ marginTop: 10 }} title="Commitment movement never enters the delay figures. An order can appear in both tables for entirely different reasons." />
    </Card>
  );
});

/** Live orders ranked by remaining float on the longest path — the queue of what to fix first (FR-11.4). */
export const ExposurePanel = memo(function ExposurePanel({ rows }) {
  const columns = [
    { title: 'Order', dataIndex: 'orderNo', render: (v, r) => <Link to={`/tna/plan/${r.planId}`}><Text strong style={{ fontFamily: 'var(--font-mono, monospace)' }}>{v}</Text></Link> },
    { title: 'Float on longest path', dataIndex: 'float', width: 160, align: 'right', render: (v) => <Tag color={v < 0 ? 'red' : v <= 3 ? 'gold' : 'green'} style={{ marginInlineEnd: 0 }}>{signedDays(v, 'WD')}</Tag> },
    { title: 'Driving activity', key: 'd', render: (_, r) => (r.drivingCode ? `${r.drivingCode} ${r.drivingName}` : '—') },
    { title: 'Owner module', dataIndex: 'ownerModule', width: 130 },
  ];
  return (
    <Card size="small" title="Critical-path exposure — orders with least float">
      <Table rowKey="planId" size="small" bordered columns={columns} dataSource={rows} pagination={false} />
    </Card>
  );
});

/** Planned against actual duration by activity across completed orders — keeps the masters honest (FR-11.5). */
export const MasterBiasPanel = memo(function MasterBiasPanel({ rows }) {
  const columns = [
    { title: 'Activity', key: 'a', render: (_, r) => <span><Text code>{r.code}</Text> {r.name}</span> },
    { title: 'Master', key: 'm', width: 90, align: 'right', render: (_, r) => `${r.master} ${r.dayType}` },
    { title: 'Actual mean', key: 'am', width: 110, align: 'right', render: (_, r) => `${r.actualMean} ${r.dayType}` },
    { title: 'Bias', dataIndex: 'bias', width: 90, align: 'center', render: (v, r) => <DeltaTag value={v} unit={r.dayType} /> },
    { title: 'Sample', dataIndex: 'sample', width: 80, align: 'right' },
  ];
  return (
    <Card size="small" title="Master effectiveness — planned vs actual duration">
      <Table rowKey={(r) => `${r.code}-${r.name}`} size="small" bordered columns={columns} dataSource={rows} pagination={false} />
    </Card>
  );
});
