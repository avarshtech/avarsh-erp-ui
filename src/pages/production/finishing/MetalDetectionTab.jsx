import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table, Space, Tag, Alert, Row, Col, Drawer, Button, InputNumber, Input, Checkbox, TimePicker } from 'antd';
import dayjs from 'dayjs';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { listMetalDetection, listNeedleLog, getOrders, saveMetalDetection } from '../../../services/production/finishingService';
import FinishingStatusTag from './FinishingStatusTag';

/** PRD Module 9 — 100% metal detection with calibration gate + needle control log. */
const MetalDetectionTab = () => {
  const { message } = App.useApp();
  const [rows, setRows] = useState([]);
  const [needles, setNeedles] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [entry, setEntry] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [md, nl, ords] = await Promise.all([listMetalDetection(), listNeedleLog(), getOrders()]);
      setRows(md); setNeedles(nl); setOrders(ords);
    } catch { message.error('Failed to load metal detection log'); } finally { setLoading(false); }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const openLog = useCallback(() => {
    setEntry({
      date: dayjs().format('YYYY-MM-DD'), machineNo: 'MD-01', orderId: orders[0]?.id,
      calibrationOk: false, calibratedAt: null, testCards: [],
      totalScanned: null, pass: null, fail: 0, rescan: 0, finalReject: 0, remarks: '',
    });
    setLogOpen(true);
  }, [orders]);

  const handleLogSave = async () => {
    if (!entry.calibrationOk) return message.warning('Calibration must be done at shift start — scanning is blocked without it (PRD 12.3)');
    if (entry.testCards.length < 3) return message.warning('All three test cards (Ferrous / Non-ferrous / Stainless) must pass');
    if (!entry.totalScanned) return message.warning('Enter the total garments scanned');
    if ((entry.pass || 0) + (entry.fail || 0) !== entry.totalScanned) return message.warning('Pass + Fail must equal Total Scanned');
    setSaving(true);
    try {
      await saveMetalDetection(entry);
      message.success('Metal detection logged');
      setLogOpen(false);
      load();
    } catch { message.error('Failed to log metal detection'); } finally { setSaving(false); }
  };

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
      <Space style={{ marginBottom: 12, justifyContent: 'flex-end', width: '100%' }}>
        <ActionButton action="create" text="Log Metal Detection" onClick={openLog} />
      </Space>
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
      <Drawer title="Log Metal Detection" open={logOpen} onClose={() => setLogOpen(false)} size={560} destroyOnHidden
        footer={(
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button onClick={() => setLogOpen(false)}>Cancel</Button>
            <ActionButton action="save" text="Save Log" loading={saving} onClick={handleLogSave} />
          </Space>
        )}>
        {entry && (
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <Space size="middle" wrap>
              <FormSelect value={entry.machineNo} style={{ width: 110 }}
                options={['MD-01', 'MD-02'].map((m) => ({ value: m, label: m }))}
                onChange={(v) => setEntry((prev) => ({ ...prev, machineNo: v }))} />
              <FormSelect value={entry.orderId} style={{ width: 230 }}
                options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
                onChange={(v) => setEntry((prev) => ({ ...prev, orderId: v }))} />
            </Space>
            <Space size="middle" wrap>
              <Checkbox checked={entry.calibrationOk}
                onChange={(e) => setEntry((prev) => ({ ...prev, calibrationOk: e.target.checked, calibratedAt: e.target.checked ? dayjs().format('HH:mm') : null }))}>
                Shift calibration done
              </Checkbox>
              <TimePicker format="HH:mm" value={entry.calibratedAt ? dayjs(entry.calibratedAt, 'HH:mm') : null} disabled={!entry.calibrationOk}
                onChange={(t) => setEntry((prev) => ({ ...prev, calibratedAt: t ? t.format('HH:mm') : null }))} />
              <Checkbox.Group options={['Ferrous', 'Non-ferrous', 'Stainless']} value={entry.testCards}
                onChange={(v) => setEntry((prev) => ({ ...prev, testCards: v }))} disabled={!entry.calibrationOk} />
            </Space>
            <Space size="middle" wrap>
              {[['totalScanned', 'Total Scanned'], ['pass', 'Pass'], ['fail', 'Fail'], ['rescan', 'Re-Scan'], ['finalReject', 'Final Reject']].map(([k, label]) => (
                <span key={k}>{label}
                  <InputNumber size="small" min={0} value={entry[k]} style={{ width: 90, marginLeft: 6 }}
                    onChange={(v) => setEntry((prev) => ({ ...prev, [k]: v }))} />
                </span>
              ))}
            </Space>
            <Input.TextArea rows={2} placeholder="Remarks (false positives, contamination found…)" value={entry.remarks}
              onChange={(e) => setEntry((prev) => ({ ...prev, remarks: e.target.value }))} />
          </Space>
        )}
      </Drawer>
    </div>
  );
};

export default MetalDetectionTab;
