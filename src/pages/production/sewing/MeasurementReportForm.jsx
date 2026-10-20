import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, Table, InputNumber, Input, Tag, DatePicker, Button, Upload, Alert } from 'antd';
import { FileExcelOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import useSewingMasters from '../../../hooks/useSewingMasters';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { searchEmployees } from '../../../services/hr/employeeService';
import { uploadFile } from '../../../services/core/fileService';
import { pointStatus, measurementResult } from '../../../utils/sewingCalc';
import {
  getMeasurement, saveMeasurement, getOrders, getMeasurementOpeningPoints,
} from '../../../services/production/sewingService';
import MeasurementChartUpload from './MeasurementChartUpload';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const STATUS_COLOR = { PASS: 'green', FAIL: 'red', AT_LIMIT: 'orange', PENDING: undefined };
const STATUS_LABEL = { PASS: 'Pass', FAIL: 'Fail', AT_LIMIT: 'At limit', PENDING: 'Pending' };

/**
 * PRD 4.6 — measurement report. Spec and tolerance come from the style's
 * uploaded chart and are copied onto the report, so a chart revised later
 * cannot rewrite an inspection that already happened. The verdict is derived,
 * never chosen; the server recomputes it on save.
 */
const MeasurementReportForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { options } = useSewingMasters();
  const { selectOrder, defaultOrderId } = useModuleSelection('sewing');
  const [report, setReport] = useState(null);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [chartOpen, setChartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const stageOptions = options('MEASUREMENT_STAGE');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [record, ords, staff] = await Promise.all([
          isEdit ? getMeasurement(id) : Promise.resolve(null),
          getOrders(),
          searchEmployees({ status: 'ACTIVE', size: 200 }),
        ]);
        setOrders(ords);
        setEmployees(staff.content);
        const first = ords.find((o) => o.id === defaultOrderId(ords));
        setReport(record || {
          orderId: first?.id,
          stage: null,
          size: first?.sizes?.[0],
          reportDate: dayjs().format('YYYY-MM-DD'),
          inspectorId: null,
          points: [],
          photos: [],
        });
      } catch { message.error('Failed to load the report'); } finally { setLoading(false); }
    })();
    // The remembered order only seeds a new record; it must not reload the
    // form when another screen in the module changes the selection mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, message]);

  // Default the stage once the master has loaded, rather than assuming a code.
  useEffect(() => {
    if (!report || report.stage || !stageOptions.length) return;
    setReport((prev) => ({ ...prev, stage: stageOptions[0].value }));
  }, [report, stageOptions]);

  const order = useMemo(() => orders.find((o) => o.id === report?.orderId), [orders, report?.orderId]);

  const patch = useCallback((p) => setReport((prev) => ({ ...prev, ...p })), []);
  const setPoint = useCallback((idx, field, val) => {
    setReport((prev) => ({ ...prev, points: prev.points.map((x, i) => (i === idx ? { ...x, [field]: val } : x)) }));
  }, []);

  /** Loads the style's chart for a size; an empty chart says so rather than inventing rows. */
  const loadPoints = useCallback(async (orderId, size) => {
    if (!orderId || !size) return;
    try {
      const points = await getMeasurementOpeningPoints(orderId, size);
      patch({ points });
      if (!points.length) message.warning('No measurement chart uploaded for this style yet');
    } catch { message.error('Failed to load the measurement chart'); }
  }, [patch, message]);

  useEffect(() => {
    if (isEdit || !report?.orderId || !report?.size || report.points.length) return;
    loadPoints(report.orderId, report.size);
  }, [isEdit, report?.orderId, report?.size, report?.points?.length, loadPoints]);

  const summary = useMemo(() => measurementResult(report?.points || []), [report?.points]);

  const columns = useMemo(() => [
    {
      title: 'Measurement Point', dataIndex: 'point', width: 200,
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
      title: 'Tol ±', dataIndex: 'tolerance', width: 90, align: 'center',
      render: (v, p, idx) => (p.manual
        ? <InputNumber size="small" step={0.1} min={0} controls={false} value={v} style={{ width: 70 }} onChange={(val) => setPoint(idx, 'tolerance', val)} />
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
        return s.deviation == null ? '—'
          : <strong style={{ color: `var(--${s.status === 'FAIL' ? 'error' : s.status === 'AT_LIMIT' ? 'warning' : 'success'}-color)` }}>
            {s.deviation > 0 ? '+' : ''}{s.deviation}
          </strong>;
      },
    },
    {
      title: 'Status', key: 'status', width: 95, align: 'center',
      render: (_, p) => {
        const { status } = pointStatus(p);
        return <Tag color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Tag>;
      },
    },
    {
      title: 'Remarks', dataIndex: 'remarks', width: 220,
      render: (v, _, idx) => <Input size="small" value={v} onChange={(e) => setPoint(idx, 'remarks', e.target.value)} />,
    },
  ], [setPoint]);

  const handlePhoto = useCallback(async (file) => {
    try {
      const stored = await uploadFile(file, {
        module: 'PRODUCTION', entity: 'SEW_MEASUREMENT_REPORT',
        entityId: report?.id, fileCategory: 'PHOTO',
      });
      patch({ photos: [...(report.photos || []), { fileId: stored.id, fileName: stored.originalFilename || file.name }] });
    } catch { message.error(`Failed to upload ${file.name}`); }
    return false;
  }, [report, patch, message]);

  const handleSave = async () => {
    if (!report.inspectorId) return message.warning('Select the inspector');
    if (!report.points.length) return message.warning('Load or add at least one measurement point');
    setSaving(true);
    try {
      const saved = await saveMeasurement(report);
      message.success(`${saved.reportNo} saved — overall ${saved.result.replace('_', ' ')}`);
      navigate('/production/sewing?tab=measurement');
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save the report');
    } finally { setSaving(false); }
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
          <Button icon={<FileExcelOutlined />} disabled={!order} onClick={() => setChartOpen(true)}>
            Upload Measurement Chart
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
                selectOrder(o);
                patch({ orderId: v, size: o?.sizes?.[0], points: [] });
              }} />
          </div>
          <div>
            <FieldLabel>Stage</FieldLabel>
            <FormSelect value={report.stage} style={{ width: 180 }} options={stageOptions}
              onChange={(v) => patch({ stage: v })} />
          </div>
          <div>
            <FieldLabel>Size (from the order&apos;s size run)</FieldLabel>
            <FormSelect value={report.size} style={{ width: 110 }}
              options={(order?.sizes || []).map((s) => ({ value: s, label: s }))}
              onChange={(v) => { patch({ size: v, points: [] }); loadPoints(report.orderId, v); }} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(report.reportDate)}
              onChange={(d) => patch({ reportDate: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Inspector (employee master)</FieldLabel>
            <FormSelect value={report.inspectorId} style={{ width: 220 }} placeholder="Select inspector" showSearch
              optionFilterProp="label"
              options={employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.employeeNo})` }))}
              onChange={(v) => patch({ inspectorId: v })} />
          </div>
          {summary.failCount > 0 && <Tag color="red" style={{ fontSize: 13 }}>{summary.failCount} point(s) out of tolerance — QA review</Tag>}
        </Space>
      </Card>

      <Card title={`Measurement Points — ${order?.styleNo || ''} · Size ${report.size || '—'}`}
        extra={<Tag color={summary.result === 'APPROVED' ? 'green' : summary.result === 'NOT_APPROVED' ? 'red' : 'orange'}>
          {summary.result.replace('_', ' ')}
        </Tag>}>
        {report.points.length === 0 && (
          <Alert type="warning" showIcon style={{ marginBottom: 12 }}
            title="No measurement chart for this style and size"
            description="Upload the buyer's chart above, or add the points by hand below." />
        )}
        <Table rowKey={(r) => report.points.indexOf(r)} size="small" columns={columns}
          dataSource={report.points} pagination={false} scroll={{ x: 920 }} />
        <Button icon={<PlusOutlined />} size="small" style={{ marginTop: 12 }}
          onClick={() => patch({ points: [...report.points, { point: '', spec: null, tolerance: 0.5, actual: null, remarks: '', manual: true }] })}>
          Add Measurement Point
        </Button>
      </Card>

      <Card title="Reference Images (measurement photos / defects)" size="small" style={{ marginTop: 16 }}>
        <Upload
          listType="picture-card"
          accept="image/*"
          fileList={(report.photos || []).map((p) => ({ uid: p.fileId, name: p.fileName, status: 'done' }))}
          beforeUpload={handlePhoto}
          onRemove={(file) => patch({ photos: report.photos.filter((p) => p.fileId !== file.uid) })}
        >
          <div><PlusOutlined /><div style={{ marginTop: 6 }}>Add Image</div></div>
        </Upload>
      </Card>

      <MeasurementChartUpload open={chartOpen} styleNo={order?.styleNo}
        onClose={() => setChartOpen(false)}
        onSaved={() => { setChartOpen(false); loadPoints(report.orderId, report.size); }} />
    </div>
  );
};

export default MeasurementReportForm;
