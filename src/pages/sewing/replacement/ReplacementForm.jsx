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
  createReplacement, getReplacementById, searchSewingPlans,
} from '../../../services/sewingService';
import {
  REPLACEMENT_REASONS,
  getReplacementLabel, getReplacementColor,
} from '../../../utils/sewingConstants';
import { formatDate } from '../../../utils/formatters';

const ReplacementForm = () => {
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

  useEffect(() => {
    if (isView) {
      setLoading(true);
      getReplacementById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            sewingPlanId: data.sewingPlanId,
            requestDate: data.requestDate ? dayjs(data.requestDate) : null,
            requestedBy: data.requestedBy,
          });
          setItems(data.items || []);
          setPlanOptions([{ value: data.sewingPlanId, label: `${data.planNo || ''} - ${data.styleNo || ''}` }]);
        })
        .catch(() => message.error('Failed to load replacement request'))
        .finally(() => setLoading(false));
    } else {
      form.setFieldsValue({ requestDate: dayjs() });
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

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, {
      size: '', serialNo: '', partName: '', reason: null, qtyNeeded: 1,
      replacementStatus: null, replacementDate: null,
    }]);
  }, []);

  const removeItem = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItem = useCallback((index, field, value) => {
    setItems((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) {
        message.warning('Add at least one replacement item');
        return;
      }
      setSaving(true);
      const payload = {
        sewingPlanId: values.sewingPlanId,
        requestDate: values.requestDate?.format('YYYY-MM-DD'),
        requestedBy: values.requestedBy,
        items: items.map((it) => ({
          size: it.size,
          serialNo: it.serialNo,
          partName: it.partName,
          reason: it.reason,
          qtyNeeded: it.qtyNeeded || 1,
        })),
      };
      await createReplacement(payload);
      message.success('Replacement request created');
      navigate('/sewing/replacement/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, items, navigate]);

  const itemColumns = useMemo(() => [
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 90,
      render: (val, _, index) => (
        isView ? val : (
          <Input size="small" value={val} onChange={(e) => updateItem(index, 'size', e.target.value)} placeholder="Size" />
        )
      ),
    },
    {
      title: 'Serial No',
      dataIndex: 'serialNo',
      key: 'serialNo',
      width: 120,
      render: (val, _, index) => (
        isView ? val : (
          <Input size="small" value={val} onChange={(e) => updateItem(index, 'serialNo', e.target.value)} placeholder="Serial No" />
        )
      ),
    },
    {
      title: 'Part Name',
      dataIndex: 'partName',
      key: 'partName',
      width: 160,
      render: (val, _, index) => (
        isView ? val : (
          <Input size="small" value={val} onChange={(e) => updateItem(index, 'partName', e.target.value)} placeholder="Part name" />
        )
      ),
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: 160,
      render: (val, _, index) => (
        isView ? (REPLACEMENT_REASONS.find((r) => r.value === val)?.label || val) : (
          <Select
            size="small"
            value={val}
            onChange={(v) => updateItem(index, 'reason', v)}
            options={REPLACEMENT_REASONS}
            placeholder="Reason"
            style={{ width: '100%' }}
          />
        )
      ),
    },
    {
      title: 'Qty Needed',
      dataIndex: 'qtyNeeded',
      key: 'qtyNeeded',
      width: 100,
      align: 'right',
      render: (val, _, index) => (
        isView ? val : (
          <InputNumber size="small" min={1} value={val} onChange={(v) => updateItem(index, 'qtyNeeded', v)} style={{ width: '100%' }} />
        )
      ),
    },
    ...(isView ? [
      {
        title: 'Status',
        dataIndex: 'replacementStatus',
        key: 'replacementStatus',
        width: 130,
        render: (s) => s ? <Tag color={getReplacementColor(s)}>{getReplacementLabel(s)}</Tag> : '—',
      },
      {
        title: 'Replacement Date',
        dataIndex: 'replacementDate',
        key: 'replacementDate',
        width: 130,
        render: (d) => formatDate(d),
      },
    ] : [
      {
        title: '',
        key: 'action',
        width: 50,
        render: (_, __, index) => (
          <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeItem(index)} />
        ),
      },
    ]),
  ], [isView, updateItem, removeItem]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isView ? `Replacement: ${record?.requestNo || ''}` : 'New Replacement Request'}
        onBack={() => navigate('/sewing/replacement/list')}
        extra={!isView && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Request Details" style={{ marginBottom: 16 }}>
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
              <Form.Item name="requestDate" label="Request Date" rules={[{ required: true, message: 'Select date' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="requestedBy" label="Requested By" rules={[{ required: true, message: 'Enter name' }]}>
                <Input placeholder="Requested By" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title="Replacement Items"
        extra={!isView && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addItem}>Add Item</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={itemColumns}
          dataSource={items}
          pagination={false}
          size="small"
          scroll={{ x: 850 }}
          locale={{ emptyText: <span style={{ color: '#999' }}>Add replacement items</span> }}
        />
      </Card>
    </>
  );
};

export default ReplacementForm;
