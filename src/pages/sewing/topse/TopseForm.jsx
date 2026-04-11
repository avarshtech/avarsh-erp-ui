import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, DatePicker, InputNumber, Button, Card,
  Row, Col, Table, Skeleton, Select, Statistic,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createEndlineTopse, getEndlineTopseById, searchSewingPlans, getAllActiveLines,
} from '../../../services/sewingService';
import { DEFECT_CATEGORIES, DHU_THRESHOLD } from '../../../utils/sewingConstants';
import { formatPercentage } from '../../../utils/formatters';

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8];

const TopseForm = () => {
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
  const [lineOptions, setLineOptions] = useState([]);
  const [defects, setDefects] = useState([]);

  // Load line options
  useEffect(() => {
    getAllActiveLines()
      .then((data) => {
        const lines = Array.isArray(data) ? data : (data?.content || []);
        setLineOptions(lines.map((l) => ({ value: l.id, label: l.lineCode || l.lineName })));
      })
      .catch(() => { /* ignore */ });
  }, []);

  useEffect(() => {
    if (isView) {
      setLoading(true);
      getEndlineTopseById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            sewingPlanId: data.sewingPlanId,
            lineId: data.lineId,
            inspectionDate: data.inspectionDate ? dayjs(data.inspectionDate) : null,
            totalInspected: data.totalInspected,
            totalRework: data.totalRework,
            checkedBy: data.checkedBy,
          });
          setDefects(data.defects || []);
          setPlanOptions([{ value: data.sewingPlanId, label: `${data.planNo || ''} - ${data.styleNo || ''}` }]);
        })
        .catch(() => message.error('Failed to load TOPSE record'))
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

  const addDefect = useCallback(() => {
    setDefects((prev) => [...prev, {
      defectCategory: null, defectName: '',
      hour1: 0, hour2: 0, hour3: 0, hour4: 0, hour5: 0, hour6: 0, hour7: 0, hour8: 0,
      total: 0,
    }]);
  }, []);

  const removeDefect = useCallback((index) => {
    setDefects((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateDefect = useCallback((index, field, value) => {
    setDefects((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      if (field.startsWith('hour')) {
        updated.total = HOURS.reduce((sum, h) => sum + (updated[`hour${h}`] || 0), 0);
      }
      return updated;
    }));
  }, []);

  // Summary calculations
  const totalDefects = useMemo(() => defects.reduce((sum, d) => sum + (d.total || 0), 0), [defects]);
  const totalInspected = Form.useWatch('totalInspected', form) || 0;
  const dhuPct = useMemo(() => totalInspected > 0 ? Number(((totalDefects / totalInspected) * 100).toFixed(2)) : 0, [totalDefects, totalInspected]);
  const totalRework = Form.useWatch('totalRework', form) || 0;
  const passRatePct = useMemo(() => totalInspected > 0 ? Number((((totalInspected - totalRework) / totalInspected) * 100).toFixed(2)) : 0, [totalInspected, totalRework]);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        sewingPlanId: values.sewingPlanId,
        lineId: values.lineId,
        inspectionDate: values.inspectionDate?.format('YYYY-MM-DD'),
        totalInspected: values.totalInspected,
        totalRework: values.totalRework,
        checkedBy: values.checkedBy,
        totalDefects,
        dhuPct,
        passRatePct,
        defects: defects.map((d) => ({
          defectCategory: d.defectCategory,
          defectName: d.defectName,
          hour1: d.hour1 || 0, hour2: d.hour2 || 0, hour3: d.hour3 || 0, hour4: d.hour4 || 0,
          hour5: d.hour5 || 0, hour6: d.hour6 || 0, hour7: d.hour7 || 0, hour8: d.hour8 || 0,
          total: d.total || 0,
        })),
      };
      await createEndlineTopse(payload);
      message.success('TOPSE record created');
      navigate('/sewing/topse/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, defects, totalDefects, dhuPct, passRatePct, navigate]);

  const defectColumns = useMemo(() => [
    {
      title: 'Category',
      dataIndex: 'defectCategory',
      key: 'defectCategory',
      width: 160,
      render: (val, _, index) => (
        isView ? (DEFECT_CATEGORIES.find((c) => c.value === val)?.label || val) : (
          <Select
            size="small"
            value={val}
            onChange={(v) => updateDefect(index, 'defectCategory', v)}
            options={DEFECT_CATEGORIES}
            placeholder="Category"
            style={{ width: '100%' }}
          />
        )
      ),
    },
    {
      title: 'Defect Name',
      dataIndex: 'defectName',
      key: 'defectName',
      width: 160,
      render: (val, _, index) => (
        isView ? val : (
          <Input size="small" value={val} onChange={(e) => updateDefect(index, 'defectName', e.target.value)} placeholder="Name" />
        )
      ),
    },
    ...HOURS.map((h) => ({
      title: `H${h}`,
      dataIndex: `hour${h}`,
      key: `hour${h}`,
      width: 65,
      align: 'right',
      render: (val, _, index) => (
        isView ? (val || 0) : (
          <InputNumber size="small" min={0} value={val || 0} onChange={(v) => updateDefect(index, `hour${h}`, v)} style={{ width: '100%' }} />
        )
      ),
    })),
    {
      title: 'Total',
      dataIndex: 'total',
      key: 'total',
      width: 80,
      align: 'right',
      render: (val) => <strong>{val || 0}</strong>,
    },
    ...(!isView ? [{
      title: '',
      key: 'action',
      width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeDefect(index)} />
      ),
    }] : []),
  ], [isView, updateDefect, removeDefect]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isView ? `TOPSE: ${record?.checkNo || ''}` : 'New End-line TOPSE'}
        onBack={() => navigate('/sewing/topse/list')}
        extra={!isView && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Inspection Details" style={{ marginBottom: 16 }}>
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
              <Form.Item name="lineId" label="Line" rules={[{ required: true, message: 'Select a line' }]}>
                <Select options={lineOptions} placeholder="Select line" showSearch optionFilterProp="label" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="inspectionDate" label="Inspection Date" rules={[{ required: true, message: 'Select date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="totalInspected" label="Total Inspected" rules={[{ required: true, message: 'Enter quantity' }]}>
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="totalRework" label="Total Rework">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="checkedBy" label="Checked By" rules={[{ required: true, message: 'Enter name' }]}>
                <Input placeholder="Checked By" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title="Defects Grid"
        extra={!isView && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addDefect}>Add Defect</Button>
        )}
        style={{ marginBottom: 16 }}
      >
        <Table
          rowKey={(_, index) => index}
          columns={defectColumns}
          dataSource={defects}
          pagination={false}
          size="small"
          scroll={{ x: 1100 }}
          locale={{ emptyText: <span style={{ color: '#999' }}>Add defects to begin</span> }}
        />
      </Card>

      <Card title="Summary">
        <Row gutter={24}>
          <Col xs={12} sm={6}>
            <Statistic title="Total Defects" value={totalDefects} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic
              title="DHU %"
              value={dhuPct}
              suffix="%"
              valueStyle={{ color: dhuPct > DHU_THRESHOLD ? '#ff4d4f' : '#52c41a' }}
            />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="Pass Rate %" value={formatPercentage(passRatePct)} />
          </Col>
          <Col xs={12} sm={6}>
            <Statistic title="Total Inspected" value={totalInspected} />
          </Col>
        </Row>
      </Card>
    </>
  );
};

export default TopseForm;
