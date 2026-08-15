import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Table, InputNumber, Input, Tag, DatePicker } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { MEASUREMENT_STAGES } from '../../../utils/sewingConstants';
import { getMeasurement, saveMeasurement, getOrders, specPoints } from '../../../services/production/sewingService';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const pointStatus = (p) => {
  if (p.actual == null) return { label: 'Pending', color: undefined };
  const dev = Math.round((p.actual - p.spec) * 100) / 100;
  if (Math.abs(dev) > p.tol) return { label: 'FAIL', color: 'var(--error-color)', dev };
  if (Math.abs(Math.abs(dev) - p.tol) < 0.001) return { label: 'At limit', color: 'var(--warning-color)', dev };
  return { label: 'PASS', color: 'var(--success-color)', dev };
};

/** PRD 4.6 — measurement report: spec/tolerance from Tech Pack, deviation auto. */
const MeasurementReportForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [report, setReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [record, ords] = await Promise.all([isEdit ? getMeasurement(id) : Promise.resolve(null), getOrders()]);
        setOrders(ords);
        const first = ords[0];
        setReport(record || {
          orderId: first?.id, stage: 'IN_LINE', size: first?.sizes[1] || first?.sizes[0],
          date: dayjs().format('YYYY-MM-DD'), inspector: '', result: 'CONDITIONAL',
          points: specPoints(first?.styleNo, first?.sizes[1] || first?.sizes[0]),
        });
      } catch { message.error('Failed to load report'); } finally { setLoading(false); }
    })();
  }, [id, isEdit, message]);

  const order = useMemo(() => orders.find((o) => o.id === report?.orderId), [orders, report]);
  const patch = useCallback((p) => setReport((prev) => ({ ...prev, ...p })), []);
  const setPoint = useCallback((idx, field, val) => {
    setReport((prev) => ({ ...prev, points: prev.points.map((x, i) => (i === idx ? { ...x, [field]: val } : x)) }));
  }, []);

  const fails = useMemo(() => (report ? report.points.filter((p) => pointStatus(p).label === 'FAIL').length : 0), [report]);

  const columns = useMemo(() => [
    { title: 'Measurement Point', dataIndex: 'point', width: 190 },
    { title: 'Spec (cm)', dataIndex: 'spec', width: 90, align: 'right' },
    { title: 'Tol ±', dataIndex: 'tol', width: 70, align: 'center' },
    {
      title: 'Actual (cm)', dataIndex: 'actual', width: 110, align: 'center',
      render: (v, _, idx) => (
        <InputNumber size="small" step={0.1} controls={false} value={v} style={{ width: 90 }}
          onChange={(val) => setPoint(idx, 'actual', val)} />
      ),
    },
    {
      title: 'Deviation', key: 'dev', width: 100, align: 'right',
      render: (_, p) => {
        const s = pointStatus(p);
        return s.dev != null ? <strong style={{ color: s.color }}>{s.dev > 0 ? '+' : ''}{s.dev}</strong> : '—';
      },
    },
    {
      title: 'Status', key: 'status', width: 90, align: 'center',
      render: (_, p) => {
        const s = pointStatus(p);
        return <Tag color={s.label === 'PASS' ? 'green' : s.label === 'FAIL' ? 'red' : s.label === 'At limit' ? 'orange' : undefined}>{s.label}</Tag>;
      },
    },
    {
      title: 'Remarks', dataIndex: 'remarks', width: 220,
      render: (v, _, idx) => <Input size="small" value={v} onChange={(e) => setPoint(idx, 'remarks', e.target.value)} />,
    },
  ], [setPoint]);

  const handleSave = async () => {
    if (!report.inspector.trim()) return message.warning('Enter the inspector name');
    const result = fails > 0 ? 'NOT_APPROVED' : report.points.some((p) => pointStatus(p).label === 'At limit') ? 'CONDITIONAL' : 'APPROVED';
    setSaving(true);
    try {
      await saveMeasurement({ ...report, result });
      message.success(`Report saved — overall ${result.replace('_', ' ')}`);
      navigate('/production/sewing?tab=measurement');
    } catch { message.error('Failed to save report'); } finally { setSaving(false); }
  };

  if (loading || !report) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `Measurement — ${report.reportNo}` : 'New Measurement Report'}
        backPath="/production/sewing?tab=measurement"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <ActionButton action="save" text="Save Report" loading={saving} onClick={handleSave} />
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end">
          <div>
            <FieldLabel>Order</FieldLabel>
            <FormSelect value={report.orderId} style={{ width: 240 }} disabled={isEdit}
              options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
              onChange={(v) => {
                const o = orders.find((x) => x.id === v);
                patch({ orderId: v, size: o?.sizes[0], points: specPoints(o?.styleNo, o?.sizes[0]) });
              }} />
          </div>
          <div>
            <FieldLabel>Stage</FieldLabel>
            <FormSelect value={report.stage} style={{ width: 130 }}
              options={MEASUREMENT_STAGES.map((s) => ({ value: s, label: s.replace('_', ' ') }))}
              onChange={(v) => patch({ stage: v })} />
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
            <FieldLabel>Inspector</FieldLabel>
            <Input value={report.inspector} style={{ width: 170 }} placeholder="QC name" onChange={(e) => patch({ inspector: e.target.value })} />
          </div>
          {fails > 0 && <Tag color="red" style={{ fontSize: 13 }}>{fails} point(s) out of tolerance — QA review</Tag>}
        </Space>
      </Card>

      <Card title={`Measurement Points — ${order?.styleNo || ''} · Size ${report.size}`}>
        <Table rowKey="point" size="small" columns={columns} dataSource={report.points} pagination={false} scroll={{ x: 880 }} />
      </Card>
    </div>
  );
};

export default MeasurementReportForm;
