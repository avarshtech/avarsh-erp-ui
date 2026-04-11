import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, Button, Card, Row, Col, Table, Skeleton, DatePicker, InputNumber,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createReCutEntry, getReCutRegisterById, searchCutOrderPlans,
} from '../../../services/cutting/cuttingService';
import { PANEL_NAMES } from '../../../utils/cuttingConstants';

const { TextArea } = Input;

const ReCuttingForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get('view');
  const isViewMode = !!viewId;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [entries, setEntries] = useState([]);

  const [planOptions, setPlanOptions] = useState([]);
  const [planSearching, setPlanSearching] = useState(false);

  useEffect(() => {
    if (isViewMode) {
      setLoading(true);
      getReCutRegisterById(viewId)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            planId: data.planId,
            styleNo: data.styleNo,
            orderNo: data.orderNo,
            description: data.description,
          });
          setEntries(data.entries || []);
        })
        .catch(() => message.error('Failed to load re-cutting register'))
        .finally(() => setLoading(false));
    }
  }, [viewId, isViewMode, form]);

  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchCutOrderPlans({ search, page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo} — ${p.styleNo || ''} — ${p.color || ''}`,
        plan: p,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  const handlePlanSelect = useCallback((_value, option) => {
    const plan = option?.plan;
    if (plan) {
      form.setFieldsValue({ styleNo: plan.styleNo, orderNo: '' });
    }
  }, [form]);

  const addEntry = useCallback(() => {
    setEntries((prev) => [...prev, {
      recutDate: dayjs().format('YYYY-MM-DD'), line: '', partName: '', styleRef: '',
      rollNo: '', recutQty: 0, monitor: '', reason: '', qcSign: '',
    }]);
  }, []);

  const removeEntry = useCallback((index) => {
    setEntries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateEntry = useCallback((index, field, value) => {
    setEntries((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (entries.length === 0) {
        message.warning('Add at least one re-cut entry');
        return;
      }
      setSaving(true);
      const payload = {
        planId: values.planId,
        styleNo: values.styleNo,
        orderNo: values.orderNo,
        description: values.description,
        entries: entries.map((e) => ({
          recutDate: e.recutDate,
          line: e.line,
          partName: e.partName,
          styleRef: e.styleRef,
          rollNo: e.rollNo,
          recutQty: e.recutQty || 0,
          monitor: e.monitor,
          reason: e.reason,
          qcSign: e.qcSign,
        })),
      };
      await createReCutEntry(payload);
      message.success('Re-cutting register created');
      navigate('/cutting/recutting/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, entries, navigate]);

  const entryColumns = useMemo(() => [
    {
      title: 'Date', dataIndex: 'recutDate', key: 'recutDate', width: 120,
      render: (val, _, index) => isViewMode ? val : (
        <DatePicker size="small" value={val ? dayjs(val) : null} style={{ width: '100%' }}
          onChange={(d) => updateEntry(index, 'recutDate', d?.format('YYYY-MM-DD'))} />
      ),
    },
    {
      title: 'Line', dataIndex: 'line', key: 'line', width: 80,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} onChange={(e) => updateEntry(index, 'line', e.target.value)} />
      ),
    },
    {
      title: 'Part Name', dataIndex: 'partName', key: 'partName', width: 120,
      render: (val, _, index) => isViewMode ? val : (
        <Select size="small" value={val} onChange={(v) => updateEntry(index, 'partName', v)}
          style={{ width: '100%' }} options={PANEL_NAMES.map((p) => ({ value: p, label: p }))} />
      ),
    },
    {
      title: 'Style Ref', dataIndex: 'styleRef', key: 'styleRef', width: 100,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} onChange={(e) => updateEntry(index, 'styleRef', e.target.value)} />
      ),
    },
    {
      title: 'Roll No', dataIndex: 'rollNo', key: 'rollNo', width: 90,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} onChange={(e) => updateEntry(index, 'rollNo', e.target.value)} />
      ),
    },
    {
      title: 'Recut Qty', dataIndex: 'recutQty', key: 'recutQty', width: 90, align: 'right',
      render: (val, _, index) => isViewMode ? val : (
        <InputNumber size="small" min={0} value={val}
          onChange={(v) => updateEntry(index, 'recutQty', v)} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Monitor', dataIndex: 'monitor', key: 'monitor', width: 100,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} onChange={(e) => updateEntry(index, 'monitor', e.target.value)} />
      ),
    },
    {
      title: 'Reason', dataIndex: 'reason', key: 'reason', width: 120,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} onChange={(e) => updateEntry(index, 'reason', e.target.value)} />
      ),
    },
    {
      title: 'QC Sign', dataIndex: 'qcSign', key: 'qcSign', width: 100,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} onChange={(e) => updateEntry(index, 'qcSign', e.target.value)} />
      ),
    },
    ...(!isViewMode ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeEntry(index)} />
      ),
    }] : []),
  ], [isViewMode, updateEntry, removeEntry]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isViewMode ? `Re-Cutting Register #${record?.id || ''}` : 'New Re-Cutting Register'}
        onBack={() => navigate('/cutting/recutting/list')}
        extra={!isViewMode && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Register Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isViewMode}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="planId" label="Cut Order Plan" rules={[{ required: true, message: 'Select a plan' }]}>
                <Select
                  showSearch filterOption={false}
                  onSearch={handlePlanSearch}
                  onSelect={handlePlanSelect}
                  loading={planSearching}
                  options={planOptions}
                  placeholder="Search plans..."
                  disabled={isViewMode}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="styleNo" label="Style No">
                <Input placeholder="Style" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="orderNo" label="Order No">
                <Input placeholder="Order" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="description" label="Description">
                <TextArea rows={2} placeholder="Description" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title={`Re-Cut Entries (${entries.length})`}
        extra={!isViewMode && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addEntry}>Add Entry</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={entryColumns}
          dataSource={entries}
          pagination={false}
          size="small"
          scroll={{ x: 1100 }}
        />
      </Card>
    </>
  );
};

export default ReCuttingForm;
