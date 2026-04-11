import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, DatePicker, InputNumber, Button, Card,
  Row, Col, Table, Skeleton, Select, Tag,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createMeasurementReport, getMeasurementReportById, searchSewingPlans,
} from '../../../services/sewing/sewingService';
import {
  INSPECTION_STAGES,
  getMeasurementResultLabel, getMeasurementResultColor,
} from '../../../utils/sewingConstants';

const MeasurementReportForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isView = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [planOptions, setPlanOptions] = useState([]);
  const [planSearching, setPlanSearching] = useState(false);
  const [points, setPoints] = useState([]);

  useEffect(() => {
    if (isView) {
      setLoading(true);
      getMeasurementReportById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            sewingPlanId: data.sewingPlanId,
            inspectionStage: data.inspectionStage,
            sizeInspected: data.sizeInspected,
            inspectionDate: data.inspectionDate ? dayjs(data.inspectionDate) : null,
            inspector: data.inspector,
          });
          setPoints(data.measurementPoints || []);
          setPlanOptions([{ value: data.sewingPlanId, label: `${data.planNo || ''} - ${data.styleNo || ''}` }]);
        })
        .catch(() => message.error('Failed to load measurement report'))
        .finally(() => setLoading(false));
    } else {
      form.setFieldsValue({ inspectionDate: dayjs() });
    }
  }, [id, isView, form]);

  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchSewingPlans({ search, status: 'APPROVED', page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo} - ${p.styleNo || ''} - ${p.color || ''}`,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  const addPoint = useCallback(() => {
    setPoints((prev) => [...prev, {
      measurementPoint: '', specValue: null, tolerance: null, actualValue: null,
      deviation: null, result: null,
    }]);
  }, []);

  const removePoint = useCallback((index) => {
    setPoints((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updatePoint = useCallback((index, field, value) => {
    setPoints((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      if (field === 'actualValue' || field === 'specValue' || field === 'tolerance') {
        const spec = field === 'specValue' ? value : updated.specValue;
        const actual = field === 'actualValue' ? value : updated.actualValue;
        const tol = field === 'tolerance' ? value : updated.tolerance;
        if (spec != null && actual != null) {
          updated.deviation = Number((actual - spec).toFixed(2));
          if (tol != null) {
            updated.result = Math.abs(updated.deviation) <= tol ? 'PASS' : 'FAIL';
          }
        }
      }
      return updated;
    }));
  }, []);

  // Derive overall result
  const overallResult = useMemo(() => {
    if (points.length === 0) return 'PENDING';
    const results = points.map((p) => p.result).filter(Boolean);
    if (results.length === 0) return 'PENDING';
    if (results.some((r) => r === 'FAIL')) return 'NOT_APPROVED';
    return 'APPROVED';
  }, [points]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (points.length === 0) {
        message.warning('Add at least one measurement point');
        return;
      }
      setSaving(true);
      const payload = {
        sewingPlanId: values.sewingPlanId,
        inspectionStage: values.inspectionStage,
        sizeInspected: values.sizeInspected,
        inspectionDate: values.inspectionDate?.format('YYYY-MM-DD'),
        inspector: values.inspector,
        overallResult,
        measurementPoints: points.map((p) => ({
          measurementPoint: p.measurementPoint,
          specValue: p.specValue,
          tolerance: p.tolerance,
          actualValue: p.actualValue,
          deviation: p.deviation,
          result: p.result,
        })),
      };
      await createMeasurementReport(payload);
      message.success('Measurement report created');
      navigate('/sewing/measurement/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, points, overallResult, navigate]);

  const pointColumns = useMemo(() => [
    {
      title: 'Measurement Point',
      dataIndex: 'measurementPoint',
      key: 'measurementPoint',
      width: 180,
      render: (val, _, index) => (
        isView ? val : (
          <Input
            size="small"
            value={val}
            onChange={(e) => updatePoint(index, 'measurementPoint', e.target.value)}
            placeholder="e.g. Chest Width"
          />
        )
      ),
    },
    {
      title: 'Spec Value',
      dataIndex: 'specValue',
      key: 'specValue',
      width: 110,
      align: 'right',
      render: (val, _, index) => (
        isView ? val : (
          <InputNumber size="small" value={val} onChange={(v) => updatePoint(index, 'specValue', v)} style={{ width: '100%' }} />
        )
      ),
    },
    {
      title: 'Tolerance',
      dataIndex: 'tolerance',
      key: 'tolerance',
      width: 100,
      align: 'right',
      render: (val, _, index) => (
        isView ? val : (
          <InputNumber size="small" min={0} value={val} onChange={(v) => updatePoint(index, 'tolerance', v)} style={{ width: '100%' }} />
        )
      ),
    },
    {
      title: 'Actual Value',
      dataIndex: 'actualValue',
      key: 'actualValue',
      width: 110,
      align: 'right',
      render: (val, _, index) => (
        isView ? val : (
          <InputNumber size="small" value={val} onChange={(v) => updatePoint(index, 'actualValue', v)} style={{ width: '100%' }} />
        )
      ),
    },
    {
      title: 'Deviation',
      dataIndex: 'deviation',
      key: 'deviation',
      width: 100,
      align: 'right',
      render: (val) => {
        if (val == null) return '—';
        const color = val === 0 ? '#52c41a' : Math.abs(val) > 0 ? '#faad14' : undefined;
        return <span style={{ color, fontWeight: 500 }}>{val > 0 ? `+${val}` : val}</span>;
      },
    },
    {
      title: 'Result',
      dataIndex: 'result',
      key: 'result',
      width: 90,
      align: 'center',
      render: (val) => {
        if (!val) return '—';
        return <Tag color={val === 'PASS' ? 'success' : 'error'}>{val}</Tag>;
      },
    },
    ...(!isView ? [{
      title: '',
      key: 'action',
      width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removePoint(index)} />
      ),
    }] : []),
  ], [isView, updatePoint, removePoint]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isView ? `Measurement Report: ${record?.reportNo || ''}` : 'New Measurement Report'}
        onBack={() => navigate('/sewing/measurement/list')}
        extra={!isView && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Report Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isView}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="sewingPlanId" label="Sewing Plan" rules={[{ required: true, message: 'Select a plan' }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handlePlanSearch}
                  loading={planSearching}
                  options={planOptions}
                  placeholder="Search sewing plans..."
                  disabled={isView}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="inspectionStage" label="Inspection Stage" rules={[{ required: true, message: 'Select stage' }]}>
                <Select options={INSPECTION_STAGES} placeholder="Select stage" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="sizeInspected" label="Size Inspected" rules={[{ required: true, message: 'Enter size' }]}>
                <Input placeholder="e.g. M, L, XL" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="inspectionDate" label="Inspection Date" rules={[{ required: true, message: 'Select date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="inspector" label="Inspector" rules={[{ required: true, message: 'Enter inspector name' }]}>
                <Input placeholder="Inspector" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Overall Result">
                <Tag color={getMeasurementResultColor(overallResult)} style={{ fontSize: 14, padding: '4px 12px' }}>
                  {getMeasurementResultLabel(overallResult)}
                </Tag>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title="Measurement Points"
        extra={!isView && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addPoint}>Add Point</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={pointColumns}
          dataSource={points}
          pagination={false}
          size="small"
          scroll={{ x: 750 }}
          locale={{ emptyText: <span style={{ color: '#999' }}>Add measurement points to begin</span> }}
        />
      </Card>
    </>
  );
};

export default MeasurementReportForm;
