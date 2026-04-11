import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, Button, Card, Row, Col, Table, Skeleton, DatePicker, InputNumber,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createPanelIssue, getPanelIssueById, searchCutOrderPlans,
} from '../../../services/cuttingService';
import { EXTERNAL_PROCESSES, PANEL_NAMES } from '../../../utils/cuttingConstants';

const { TextArea } = Input;

const PanelIssueForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const viewId = searchParams.get('view');
  const isViewMode = !!viewId;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [items, setItems] = useState([]);

  const [planOptions, setPlanOptions] = useState([]);
  const [planSearching, setPlanSearching] = useState(false);

  useEffect(() => {
    if (isViewMode) {
      setLoading(true);
      getPanelIssueById(viewId)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            planId: data.planId,
            processName: data.processName,
            issuedBy: data.issuedBy,
            issueDate: data.issueDate ? dayjs(data.issueDate) : null,
            remarks: data.remarks,
          });
          setItems(data.items || []);
        })
        .catch(() => message.error('Failed to load panel issue'))
        .finally(() => setLoading(false));
    }
  }, [viewId, isViewMode, form]);

  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchCutOrderPlans({ search, status: 'APPROVED', page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo} — ${p.styleNo || ''} — ${p.color || ''}`,
        plan: p,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, { panelName: '', size: '', orderQty: 0, issueQty: 0 }]);
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback((index, field, value) => {
    setItems((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }, []);

  const totalPieces = items.reduce((sum, i) => sum + (i.issueQty || 0), 0);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) {
        message.warning('Add at least one panel item');
        return;
      }
      setSaving(true);
      const payload = {
        planId: values.planId,
        processName: values.processName,
        issuedBy: values.issuedBy,
        issueDate: values.issueDate?.format('YYYY-MM-DD'),
        remarks: values.remarks,
        items: items.map((i) => ({
          panelName: i.panelName,
          size: i.size,
          orderQty: i.orderQty || 0,
          issueQty: i.issueQty || 0,
        })),
      };
      await createPanelIssue(payload);
      message.success('Panel issue created');
      navigate('/cutting/panel-issue/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, items, navigate]);

  const itemColumns = useMemo(() => [
    {
      title: 'Panel Name', dataIndex: 'panelName', key: 'panelName', width: 150,
      render: (val, _, index) => isViewMode ? val : (
        <Select size="small" value={val} onChange={(v) => updateItem(index, 'panelName', v)}
          placeholder="Select panel" style={{ width: '100%' }}
          options={PANEL_NAMES.map((p) => ({ value: p, label: p }))} />
      ),
    },
    {
      title: 'Size', dataIndex: 'size', key: 'size', width: 100,
      render: (val, _, index) => isViewMode ? val : (
        <Input size="small" value={val} placeholder="e.g. M"
          onChange={(e) => updateItem(index, 'size', e.target.value)} />
      ),
    },
    {
      title: 'Order Qty', dataIndex: 'orderQty', key: 'orderQty', width: 100, align: 'right',
      render: (val, _, index) => isViewMode ? val : (
        <InputNumber size="small" min={0} value={val}
          onChange={(v) => updateItem(index, 'orderQty', v)} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Issue Qty', dataIndex: 'issueQty', key: 'issueQty', width: 100, align: 'right',
      render: (val, _, index) => isViewMode ? val : (
        <InputNumber size="small" min={0} value={val}
          onChange={(v) => updateItem(index, 'issueQty', v)} style={{ width: '100%' }} />
      ),
    },
    ...(!isViewMode ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(index)} />
      ),
    }] : []),
  ], [isViewMode, updateItem, removeItem]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isViewMode ? `Panel Issue: ${record?.issueNo || ''}` : 'New Panel Issue'}
        onBack={() => navigate('/cutting/panel-issue/list')}
        extra={!isViewMode && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Issue Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isViewMode}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="planId" label="Cut Order Plan" rules={[{ required: true, message: 'Select a plan' }]}>
                <Select
                  showSearch filterOption={false}
                  onSearch={handlePlanSearch}
                  loading={planSearching}
                  options={planOptions}
                  placeholder="Search approved plans..."
                  disabled={isViewMode}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="processName" label="External Process" rules={[{ required: true, message: 'Select process' }]}>
                <Select options={EXTERNAL_PROCESSES} placeholder="Select process" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="issueDate" label="Issue Date" initialValue={dayjs()}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="issuedBy" label="Issued By">
                <Input placeholder="Name of issuer" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Total Pieces">
                <InputNumber value={totalPieces} disabled style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="remarks" label="Remarks">
                <TextArea rows={2} placeholder="Remarks" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title="Panel Items"
        extra={!isViewMode && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addItem}>Add Item</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={itemColumns}
          dataSource={items}
          pagination={false}
          size="small"
          scroll={{ x: 550 }}
        />
      </Card>
    </>
  );
};

export default PanelIssueForm;
