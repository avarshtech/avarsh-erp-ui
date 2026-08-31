import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Table, InputNumber, Input, Tag, DatePicker, Button, Upload } from 'antd';
import { FileExcelOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { MEASUREMENT_STAGES, sewingStatusLabel } from '../../../utils/sewingConstants';
import { getMeasurement, saveMeasurement, getOrders, getOperators, specPoints, fullMeasurementChart } from '../../../services/production/sewingService';

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
  const [employees, setEmployees] = useState([]);
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [record, ords, emps] = await Promise.all([isEdit ? getMeasurement(id) : Promise.resolve(null), getOrders(), getOperators()]);
        setOrders(ords); setEmployees(emps);
        const first = ords[0];
        setReport(record || {
          orderId: first?.id, stage: 'IN_LINE', size: first?.sizes[1] || first?.sizes[0],
          date: dayjs().format('YYYY-MM-DD'), inspector: null, result: 'CONDITIONAL',
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
    {
      title: 'Measurement Point', dataIndex: 'point', width: 190,
      render: (v, p, idx) => (p.manual
        ? <Input size="small" value={v} placeholder="Point name" onChange={(e) => setPoint(idx, 'point', e.target.value)} />
        : v),
    },
    {
      title: 'Spec (cm)', dataIndex: 'spec', width: 100, align: 'right',
      render: (v, p, idx) => (p.manual
        ? <InputNumber size="small" step={0.1} controls={false} value={v} style={{ width: 80 }} onChange={(val) => setPoint(idx, 'spec', val)} />
        : v),
    },
    {
      title: 'Tol ±', dataIndex: 'tol', width: 90, align: 'center',
      render: (v, p, idx) => (p.manual
        ? <InputNumber size="small" step={0.1} controls={false} value={v} style={{ width: 70 }} onChange={(val) => setPoint(idx, 'tol', val)} />
        : v),
    },
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
    if (!report.inspector) return message.warning('Select the inspector');
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
        <Space>
          <Button icon={<FileExcelOutlined />}
            onClick={() => {
              patch({ points: fullMeasurementChart(order?.styleNo, report.size) });
              message.success('Measurement chart imported from Excel — all buyer spec points loaded');
            }}>
            Import Measurement Chart (Excel)
          </Button>
          <ActionButton action="save" text="Save Report" loading={saving} onClick={handleSave} />
        </Space>
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
            <FormSelect value={report.stage} style={{ width: 170 }}
              options={MEASUREMENT_STAGES.map((s) => ({ value: s, label: sewingStatusLabel(s) }))}
              onChange={(v) => patch({ stage: v })} />
          </div>
          <div>
            <FieldLabel>Size (from style size preset)</FieldLabel>
            <FormSelect value={report.size} style={{ width: 90 }}
              options={(order?.sizes || []).map((s) => ({ value: s, label: s }))}
              onChange={(v) => patch({ size: v, points: specPoints(order?.styleNo, v) })} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(report.date)} onChange={(d) => patch({ date: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Inspector (employee master)</FieldLabel>
            <FormSelect value={report.inspector} style={{ width: 190 }} placeholder="Select inspector" showSearch
              options={employees.map((e) => ({ value: `${e.name} (${e.code})`, label: `${e.name} (${e.code})` }))}
              onChange={(v) => patch({ inspector: v })} />
          </div>
          {fails > 0 && <Tag color="red" style={{ fontSize: 13 }}>{fails} point(s) out of tolerance — QA review</Tag>}
        </Space>
      </Card>

      <Card title={`Measurement Points — ${order?.styleNo || ''} · Size ${report.size}`}>
        <Table rowKey={(r) => report.points.indexOf(r)} size="small" columns={columns} dataSource={report.points} pagination={false} scroll={{ x: 880 }} />
        <Button icon={<PlusOutlined />} size="small" style={{ marginTop: 12 }}
          onClick={() => patch({ points: [...report.points, { point: '', spec: null, tol: 0.5, actual: null, remarks: '', manual: true }] })}>
          Add Measurement Point
        </Button>
      </Card>

      <Card title="Reference Images (measurement photos / defects)" size="small" style={{ marginTop: 16 }}>
        <Upload
          listType="picture-card"
          fileList={images}
          accept="image/*"
          beforeUpload={(file) => {
            setImages((prev) => [...prev, {
              uid: `${Date.now()}-${file.name}`, name: file.name, status: 'done',
              url: URL.createObjectURL(file),
            }]);
            return false; // mock phase — kept locally, uploads at backend integration
          }}
          onRemove={(file) => setImages((prev) => prev.filter((f) => f.uid !== file.uid))}
        >
          <div><PlusOutlined /><div style={{ marginTop: 6 }}>Add Image</div></div>
        </Upload>
      </Card>
    </div>
  );
};

export default MeasurementReportForm;
