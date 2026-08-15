import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag, Alert, Row, Col } from 'antd';
import dayjs from 'dayjs';
import EmptyState from '../../../components/EmptyState';
import { listMetalDetection, listNeedleLog, getOrders } from '../../../services/production/finishingService';
import FinishingStatusTag from './FinishingStatusTag';

/** PRD Module 9 — 100% metal detection with calibration gate + needle control log. */
const MetalDetectionTab = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [needles, setNeedles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [md, nl, ords] = await Promise.all([listMetalDetection(), listNeedleLog(), getOrders()]);
      setRows(md); setNeedles(nl); setOrders(ords);
    } catch { message.error('Failed to load metal detection log'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo(() => [
    { title: 'Date', dataIndex: 'date', width: 105, render: (v) => dayjs(v).format('DD-MMM') },
    { title: 'Machine', dataIndex: 'machineNo', width: 90, align: 'center', render: (v) => <code>{v}</code> },
    { title: 'Order', dataIndex: 'orderId', width: 130, render: (v) => orders.find((o) => o.id === v)?.orderNo || '—' },
    {
      title: 'Calibration', key: 'cal', width: 190,
      render: (_, r) => (r.calibrationOk
        ? <Space size={4}><FinishingStatusTag status="CALIBRATED" /><span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.calibratedAt} · {r.testCards.join(' / ')}</span></Space>
        : <FinishingStatusTag status="CALIBRATION_DUE" />),
    },
    { title: 'Scanned', dataIndex: 'totalScanned', width: 90, align: 'right' },
    { title: 'Pass', dataIndex: 'pass', width: 80, align: 'right', render: (v) => <span style={{ color: 'var(--success-color)' }}>{v}</span> },
    { title: 'Fail', dataIndex: 'fail', width: 70, align: 'right', render: (v) => (v ? <span style={{ color: 'var(--error-color)' }}>{v}</span> : 0) },
    { title: 'Re-Scan', dataIndex: 'rescan', width: 80, align: 'right' },
    { title: 'Final Reject', dataIndex: 'finalReject', width: 100, align: 'right', render: (v) => (v ? <strong style={{ color: 'var(--error-color)' }}>{v}</strong> : 0) },
    { title: 'Remarks', dataIndex: 'remarks', ellipsis: true },
  ], [orders]);

  const needleColumns = useMemo(() => [
    { title: 'Date', dataIndex: 'date', width: 105, render: (v) => dayjs(v).format('DD-MMM') },
    { title: 'Shift', dataIndex: 'shift', width: 70, align: 'center' },
    { title: 'Line / Machine', dataIndex: 'operator', width: 140 },
    { title: 'Issued', dataIndex: 'issued', width: 70, align: 'right' },
    { title: 'Returned', dataIndex: 'returned', width: 80, align: 'right' },
    { title: 'Broken', dataIndex: 'broken', width: 70, align: 'right', render: (v) => (v ? <span style={{ color: 'var(--warning-color)' }}>{v}</span> : 0) },
    {
      title: 'All Pieces Found', dataIndex: 'allPiecesFound', width: 130, align: 'center',
      render: (v) => (v ? <Tag color="green">Yes</Tag> : <Tag color="red">NO — scan lot</Tag>),
    },
  ], []);

  return (
    <div>
      {rows.filter((r) => !r.calibrationOk).map((r) => (
        <Alert key={r.id} type="error" showIcon style={{ marginBottom: 8 }}
          title={`${r.machineNo}: shift calibration overdue — scanning is BLOCKED until test cards (ferrous / non-ferrous / stainless) pass (PRD 12.3)`} />
      ))}
      <Row gutter={16}>
        <Col xs={24} lg={15}>
          <Card title="Metal Detection Day Log (100% scanning before packing)">
            <Table rowKey="id" size="small" columns={columns} dataSource={rows} loading={loading}
              pagination={false} scroll={{ x: 1050 }}
              locale={{ emptyText: <EmptyState title="No scans logged" description="Every garment must pass the metal detector before packing" /> }} />
          </Card>
        </Col>
        <Col xs={24} lg={9}>
          <Card title="Needle Control Log (buyer compliance)">
            <Table rowKey="id" size="small" columns={needleColumns} dataSource={needles} loading={loading}
              pagination={false} scroll={{ x: 650 }}
              locale={{ emptyText: <EmptyState title="No needle entries" description="Track needle issuance and returns per shift" /> }} />
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              A broken needle with missing pieces forces the entire lot from that machine through metal detection + physical inspection.
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default MetalDetectionTab;
