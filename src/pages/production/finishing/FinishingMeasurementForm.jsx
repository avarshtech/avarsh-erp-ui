import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Table, InputNumber, Alert, DatePicker, Tag, Input } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { getFinishingMeasurement, saveFinishingMeasurement, getOrders, getEmployees, specPoints } from '../../../services/production/finishingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const pointStatus = (p) => {
  if (p.actual == null) return null;
  const dev = Math.round((p.actual - p.spec) * 10) / 10;
  if (Math.abs(dev) > p.tol) return { label: 'FAIL', color: 'red', dev };
  if (Math.abs(Math.abs(dev) - p.tol) < 0.001) return { label: 'AT LIMIT', color: 'orange', dev };
  return { label: 'PASS', color: 'green', dev };
};

/** PRD Module 7 — post-iron measurement vs buyer spec; failure holds the lot. */
const FinishingMeasurementForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [report, setReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [record, ords, emps] = await Promise.all([isEdit ? getFinishingMeasurement(id) : Promise.resolve(null), getOrders(), getEmployees('IRONING')]);
        setOrders(ords); setEmployees(emps);
        setReport(record || {
          orderId: ords[0]?.id, color: ords[0]?.color, size: ords[0]?.sizes[0],
          date: dayjs().format('YYYY-MM-DD'), sampleSize: 5, ironOperatorId: null,
          points: specPoints(ords[0]?.styleNo, ords[0]?.sizes[0]), remarks: '',
        });
      } catch { message.error('Failed to load measurement report'); }
    })();
  }, [id, isEdit, message]);

  const patch = useCallback((p) => setReport((prev) => ({ ...prev, ...p })), []);
  const order = useMemo(() => orders.find((o) => o.id === report?.orderId), [orders, report?.orderId]);

  const overall = useMemo(() => {
    if (!report) return null;
    const statuses = report.points.map(pointStatus);
    if (statuses.some((s) => s === null)) return { result: 'PENDING' };
    return statuses.some((s) => s.label === 'FAIL') ? { result: 'FAIL' } : { result: 'PASS' };
  }, [report]);

  const columns = useMemo(() => [
    { title: 'Measurement Point', dataIndex: 'point', width: 200 },
    { title: 'Spec (cm)', dataIndex: 'spec', width: 90, align: 'right' },
    { title: 'Tol ±', dataIndex: 'tol', width: 70, align: 'center' },
    {
      title: 'Actual (cm)', dataIndex: 'actual', width: 120, align: 'center',
      render: (v, _, idx) => (
        <InputNumber size="small" step={0.1} value={v} style={{ width: 90 }}
          onChange={(val) => setReport((prev) => ({ ...prev, points: prev.points.map((p, i) => (i === idx ? { ...p, actual: val } : p)) }))} />
      ),
    },
    {
      title: 'Deviation', key: 'dev', width: 100, align: 'center',
      render: (_, r) => { const s = pointStatus(r); return s ? <span style={{ color: s.color === 'red' ? 'var(--error-color)' : undefined }}>{s.dev > 0 ? '+' : ''}{s.dev}</span> : '—'; },
    },
    {
      title: 'Result', key: 'res', width: 100, align: 'center',
      render: (_, r) => { const s = pointStatus(r); return s ? <Tag color={s.color}>{s.label}</Tag> : '—'; },
    },
  ], []);

  const handleSave = async () => {
    if (overall.result === 'PENDING') return message.warning('Enter actual values for every measurement point');
    setSaving(true);
    try {
      await saveFinishingMeasurement({ ...report, overallResult: overall.result, lotStatus: overall.result === 'FAIL' ? 'HOLD' : 'RELEASED' });
      message.success(overall.result === 'FAIL' ? 'Report saved — lot placed on HOLD' : 'Report saved — lot released');
      navigate('/production/finishing?tab=measurement');
    } catch { message.error('Failed to save report'); } finally { setSaving(false); }
  };

  if (!report || !overall) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `Measurement Audit — ${report.reportNo}` : 'New Post-Iron Measurement Audit'}
        backPath="/production/finishing?tab=measurement"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <ActionButton action="save" text="Save Report" loading={saving} onClick={handleSave} />
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end">
          <div>
            <FieldLabel>Order</FieldLabel>
            <FormSelect value={report.orderId} style={{ width: 230 }} disabled={isEdit}
              options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
              onChange={(v) => {
                const o = orders.find((x) => x.id === v);
                patch({ orderId: v, color: o?.color, size: o?.sizes[0], points: specPoints(o?.styleNo, o?.sizes[0]) });
              }} />
          </div>
          <div>
            <FieldLabel>Size</FieldLabel>
            <FormSelect value={report.size} style={{ width: 90 }}
              options={(order?.sizes || []).map((s) => ({ value: s, label: s }))}
              onChange={(v) => patch({ size: v, points: specPoints(order?.styleNo, v) })} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(report.date)} onChange={(d) => patch({ date: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Sample Size</FieldLabel>
            <InputNumber min={1} max={20} value={report.sampleSize} style={{ width: 90 }} onChange={(v) => patch({ sampleSize: v })} />
          </div>
          <div>
            <FieldLabel>Iron Operator (accountability)</FieldLabel>
            <FormSelect value={report.ironOperatorId} style={{ width: 180 }} placeholder="Operator"
              options={employees.map((e) => ({ value: e.id, label: `${e.name} (${e.code})` }))} onChange={(v) => patch({ ironOperatorId: v })} />
          </div>
        </Space>
      </Card>

      {overall.result === 'FAIL' && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title="A measurement point is out of tolerance — the entire lot will be HELD for re-measurement or re-iron (PRD 10.3)" />
      )}

      <Card title={`Spec vs Actual — ${order?.styleNo || ''} size ${report.size} (from buyer spec sheet)`}>
        <Table rowKey="point" size="small" columns={columns} dataSource={report.points} pagination={false} scroll={{ x: 700 }} />
        <div style={{ marginTop: 12 }}>
          <FieldLabel>Remarks</FieldLabel>
          <Input.TextArea rows={2} value={report.remarks} placeholder="Shrinkage observations, re-iron instructions…"
            onChange={(e) => patch({ remarks: e.target.value })} />
        </div>
      </Card>
    </div>
  );
};

export default FinishingMeasurementForm;
