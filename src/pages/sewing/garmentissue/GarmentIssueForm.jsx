import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, DatePicker, InputNumber, Button, Card,
  Row, Col, Table, Skeleton, Select,
} from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createGarmentIssue, getGarmentIssueById, searchSewingPlans,
} from '../../../services/sewing/sewingService';

const GarmentIssueForm = () => {
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
  const [items, setItems] = useState([]);

  // Load record in view mode
  useEffect(() => {
    if (isView) {
      setLoading(true);
      getGarmentIssueById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            sewingPlanId: data.sewingPlanId,
            issueDate: data.issueDate ? dayjs(data.issueDate) : null,
            issuedBy: data.issuedBy,
            receivedBy: data.receivedBy,
          });
          setItems(data.items || []);
          setPlanOptions([{ value: data.sewingPlanId, label: `${data.planNo || ''} - ${data.styleNo || ''}` }]);
        })
        .catch(() => message.error('Failed to load garment issue'))
        .finally(() => setLoading(false));
    } else {
      form.setFieldsValue({ issueDate: dayjs() });
    }
  }, [id, isView, form]);

  // Search approved sewing plans
  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchSewingPlans({ search, status: 'APPROVED', page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo} - ${p.styleNo || ''} - ${p.color || ''}`,
        plan: p,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  // When plan is selected, populate items from plan sizes
  const handlePlanSelect = useCallback((_value, option) => {
    const plan = option?.plan;
    if (!plan) return;
    const planItems = (plan.sizes || []).map((s) => ({
      size: s.size,
      orderQty: s.orderQty || 0,
      prevIssued: s.prevIssued || 0,
      currentQty: 0,
      totalIssued: s.prevIssued || 0,
      balance: (s.orderQty || 0) - (s.prevIssued || 0),
    }));
    setItems(planItems);
  }, []);

  // Update item row
  const updateItem = useCallback((index, field, value) => {
    setItems((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const updated = { ...row, [field]: value };
      if (field === 'currentQty') {
        updated.totalIssued = (updated.prevIssued || 0) + (value || 0);
        updated.balance = (updated.orderQty || 0) - updated.totalIssued;
      }
      return updated;
    }));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) {
        message.warning('Select a plan to populate items');
        return;
      }
      setSaving(true);
      const payload = {
        sewingPlanId: values.sewingPlanId,
        issueDate: values.issueDate?.format('YYYY-MM-DD'),
        issuedBy: values.issuedBy,
        receivedBy: values.receivedBy,
        items: items.map((it) => ({
          size: it.size,
          orderQty: it.orderQty,
          prevIssued: it.prevIssued,
          currentQty: it.currentQty || 0,
          totalIssued: it.totalIssued,
          balance: it.balance,
        })),
      };
      await createGarmentIssue(payload);
      message.success('Garment issue created');
      navigate('/sewing/garment-issue/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, items, navigate]);

  const itemColumns = useMemo(() => [
    { title: 'Size', dataIndex: 'size', key: 'size', width: 100 },
    { title: 'Order Qty', dataIndex: 'orderQty', key: 'orderQty', width: 110, align: 'right' },
    { title: 'Prev Issued', dataIndex: 'prevIssued', key: 'prevIssued', width: 110, align: 'right' },
    {
      title: 'Current Qty',
      dataIndex: 'currentQty',
      key: 'currentQty',
      width: 120,
      align: 'right',
      render: (val, _, index) => (
        isView ? val : (
          <InputNumber
            size="small"
            min={0}
            value={val}
            onChange={(v) => updateItem(index, 'currentQty', v)}
            style={{ width: '100%' }}
          />
        )
      ),
    },
    { title: 'Total Issued', dataIndex: 'totalIssued', key: 'totalIssued', width: 110, align: 'right' },
    {
      title: 'Balance',
      dataIndex: 'balance',
      key: 'balance',
      width: 100,
      align: 'right',
      render: (val) => (
        <span style={{ color: val < 0 ? '#ff4d4f' : undefined, fontWeight: val < 0 ? 600 : undefined }}>
          {val}
        </span>
      ),
    },
  ], [isView, updateItem]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isView ? `Garment Issue: ${record?.issueNo || ''}` : 'New Garment Issue'}
        onBack={() => navigate('/sewing/garment-issue/list')}
        extra={!isView && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Issue Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isView}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="sewingPlanId" label="Sewing Plan" rules={[{ required: true, message: 'Select a plan' }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handlePlanSearch}
                  onSelect={handlePlanSelect}
                  loading={planSearching}
                  options={planOptions}
                  placeholder="Search sewing plans..."
                  disabled={isView}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="issueDate" label="Issue Date" rules={[{ required: true, message: 'Select date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="issuedBy" label="Issued By" rules={[{ required: true, message: 'Enter name' }]}>
                <Input placeholder="Issued By" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="receivedBy" label="Received By" rules={[{ required: true, message: 'Enter name' }]}>
                <Input placeholder="Received By" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card title="Issue Items">
        <Table
          rowKey={(_, index) => index}
          columns={itemColumns}
          dataSource={items}
          pagination={false}
          size="small"
          scroll={{ x: 650 }}
          locale={{ emptyText: <span style={{ color: '#999' }}>Select a plan to load items</span> }}
        />
      </Card>
    </>
  );
};

export default GarmentIssueForm;
