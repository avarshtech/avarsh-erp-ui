import { memo } from 'react';
import {
  Col, Row, Space, Table, Tag, Tooltip,
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { FEASIBILITY, fmtDate, signedDays } from '../../../utils/tnaConstants';
import HealthTag from '../components/HealthTag';
import DeltaTag from '../components/DeltaTag';

const box = { border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '8px 12px', background: 'var(--bg-secondary)', height: '100%' };
const cap = { fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-muted)' };

const Fact = ({ label, tip, children }) => (
  <div style={box}>
    <div style={cap}>
      {label}
      {tip && <Tooltip title={tip}><InfoCircleOutlined style={{ marginLeft: 4 }} /></Tooltip>}
    </div>
    <div style={{ fontWeight: 600, fontSize: 15, marginTop: 2 }}>{children}</div>
  </div>
);

const lineColumns = [
  { title: 'Line', dataIndex: 'lineNo', width: 50 },
  { title: 'Buyer PO', dataIndex: 'buyerPoNo', width: 130 },
  { title: 'Destination', dataIndex: 'destination', width: 130 },
  { title: 'Qty', dataIndex: 'qty', width: 80, align: 'right', render: (v) => v.toLocaleString('en-IN') },
  { title: 'Original', dataIndex: 'originalCommitment', width: 104, render: fmtDate },
  { title: 'Latest', dataIndex: 'latestCommitment', width: 104, render: fmtDate },
  { title: 'Movement', dataIndex: 'movement', width: 90, render: (v) => (v ? <DeltaTag value={v} tone="movement" /> : '—') },
  { title: 'Dispatched', dataIndex: 'actualDispatch', width: 104, render: fmtDate },
  { title: 'Delay vs latest', key: 'd', width: 110, render: (_, l) => <DeltaTag value={l.actualDelayLatest ?? l.forecastDelayLatest} tip={l.actualDispatch ? 'Actual' : 'Forecast'} /> },
];

/** WF-02 header: both commitments, the derived lead time, forecast, delay on both bases, health. */
const PlanHeaderStrip = memo(function PlanHeaderStrip({ header: h }) {
  const feas = FEASIBILITY[h.generation?.feasibility];
  return (
    <div style={{ marginBottom: 14 }}>
      <Row gutter={[10, 10]}>
        <Col xs={12} md={8} xl={4}><Fact label="Original dispatch (B0)">{fmtDate(h.originalCommitment)}</Fact></Col>
        <Col xs={12} md={8} xl={4}>
          <Fact label="Latest dispatch commitment" tip="Commitment movement is its own metric — never added to, or reported as, delay (FR-7.6)">
            <Space size={6}>{fmtDate(h.latestCommitment)}{h.commitmentMovement ? <DeltaTag value={h.commitmentMovement} tone="movement" /> : null}</Space>
          </Fact>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Fact label="Lead time (derived)" tip={`Original commitment − order date (D-01). A derived order attribute, never an activity duration (FR-3.2). Elapsed to the latest commitment: ${h.elapsedToLatestDays ?? '—'} CD`}>
            {h.leadTimeDays ?? '—'} CD
          </Fact>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Fact label="Forecast dispatch" tip={`Feasible forecast: open activities start no earlier than today (FR-7.4). Projected from source facts: ${fmtDate(h.revisedDispatch)}. Baseline: ${fmtDate(h.baselineDispatch)}`}>
            {fmtDate(h.forecastDispatch)}
          </Fact>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Fact label="Delay — original / latest" tip="Forecast (or actual, once dispatched) against each commitment, in calendar days">
            <Space size={4}>
              <DeltaTag value={h.actualDispatch ? h.original?.actualDelay : h.original?.forecastDelay} />
              <DeltaTag value={h.actualDispatch ? h.latest?.actualDelay : h.latest?.forecastDelay} />
            </Space>
          </Fact>
        </Col>
        <Col xs={12} md={8} xl={4}>
          <Fact label="Health">
            <Space size={4} wrap><HealthTag health={h.healthLatest} suffix="vs latest" /><HealthTag health={h.healthOriginal} suffix="vs original" /></Space>
          </Fact>
        </Col>
      </Row>
      <Space size={[16, 4]} wrap style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)' }}>
        <span>Driving activity: <strong>{h.driving ? `${h.driving.code} ${h.driving.name}` : '—'}</strong></span>
        <span>Next gate: <strong>{h.nextGateActivity ? `${h.nextGateActivity.code} ${h.nextGateActivity.name} · ${fmtDate(h.nextGateActivity.revisedTarget)}` : '—'}</strong></span>
        <span>Dispatch float: <strong>{signedDays(h.latest?.dispatchFloat, 'WD')}</strong> vs latest</span>
        <span>Progress: <strong>{h.progress ? `${h.progress.done} / ${h.progress.total}` : '—'}</strong></span>
        <span>At generation: {feas ? <Tag color={feas.color}>{feas.label}</Tag> : '—'} master v{h.generation?.masterVersion} · rules {h.generation?.ruleVersion}</span>
        <span style={{ color: 'var(--text-muted)' }}>Feasibility covers dependencies and the working calendar only — line capacity is not assessed (FR-3.12).</span>
      </Space>
      {h.lines?.length > 1 && (
        <Table
          style={{ marginTop: 10 }}
          size="small"
          bordered
          rowKey="lineId"
          pagination={false}
          columns={lineColumns}
          dataSource={h.lines}
          title={() => <span style={cap}>Shipment lines — each against its own commitment (FR-7.12); the first line drives the network</span>}
        />
      )}
    </div>
  );
});

export default PlanHeaderStrip;
