import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, DatePicker, InputNumber, Button, Card,
  Row, Col, Table, Skeleton,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createCutPartsReceipt, getCutPartsReceiptById,
  searchSewingPlans,
} from '../../../services/sewing/sewingService';

const QUALITY_OPTIONS = [
  { value: 'OK', label: 'OK' },
  { value: 'DEFECTIVE', label: 'Defective' },
  { value: 'SHORTAGE', label: 'Shortage' },
];

const CutPartsReceiptForm = () => {
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

  // Load existing receipt in view mode
  useEffect(() => {
    if (isView) {
      setLoading(true);
      getCutPartsReceiptById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            sewingPlanId: data.sewingPlanId,
            receiptDate: data.receiptDate ? dayjs(data.receiptDate) : null,
            receivedBy: data.receivedBy,
            remarks: data.remarks,
          });
          setItems(data.items || []);
          if (data.sewingPlanId) {
            setPlanOptions([{
              value: data.sewingPlanId,
              label: `${data.planNo || ''} — ${data.styleNo || ''}`,
            }]);
          }
        })
        .catch(() => message.error('Failed to load receipt'))
        .finally(() => setLoading(false));
    }
  }, [id, isView, form]);

  // Search sewing plans
  const handlePlanSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setPlanSearching(true);
    try {
      const res = await searchSewingPlans({ search, page: 0, size: 20 });
      setPlanOptions((res.content || []).map((p) => ({
        value: p.id,
        label: `${p.planNo || ''} — ${p.styleNo || ''} — ${p.lineName || ''}`,
        plan: p,
      })));
    } catch { /* ignore */ }
    finally { setPlanSearching(false); }
  }, []);

  // Items table handlers
  const addItemRow = useCallback(() => {
    setItems((prev) => [...prev, {
      bundleId: '', size: '', color: '', qtyReceived: 0, qualityStatus: 'OK',
    }]);
  }, []);

  const removeItemRow = useCallback((index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateItemRow = useCallback((index, field, value) => {
    setItems((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }, []);

  const totalBundles = items.length;
  const totalPieces = items.reduce((sum, item) => sum + (item.qtyReceived || 0), 0);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (items.length === 0) {
        message.warning('Add at least one item');
        return;
      }
      setSaving(true);
      const payload = {
        sewingPlanId: values.sewingPlanId,
        receiptDate: values.receiptDate?.format('YYYY-MM-DD'),
        receivedBy: values.receivedBy,
        remarks: values.remarks,
        totalBundles,
        totalPieces,
        items: items.map((item) => ({
          bundleId: item.bundleId,
          size: item.size,
          color: item.color,
          qtyReceived: item.qtyReceived || 0,
          qualityStatus: item.qualityStatus,
        })),
      };
      await createCutPartsReceipt(payload);
      message.success('Cut parts receipt created');
      navigate('/sewing/cut-parts-receipt/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, items, totalBundles, totalPieces, navigate]);

  const itemColumns = useMemo(() => [
    {
      title: 'Bundle ID', dataIndex: 'bundleId', key: 'bundleId', width: 140,
      render: (val, _, index) => (
        <Input size="small" value={val} placeholder="Bundle ID"
          onChange={(e) => updateItemRow(index, 'bundleId', e.target.value)} disabled={isView} />
      ),
    },
    {
      title: 'Size', dataIndex: 'size', key: 'size', width: 100,
      render: (val, _, index) => (
        <Input size="small" value={val} placeholder="Size"
          onChange={(e) => updateItemRow(index, 'size', e.target.value)} disabled={isView} />
      ),
    },
    {
      title: 'Color', dataIndex: 'color', key: 'color', width: 100,
      render: (val, _, index) => (
        <Input size="small" value={val} placeholder="Color"
          onChange={(e) => updateItemRow(index, 'color', e.target.value)} disabled={isView} />
      ),
    },
    {
      title: 'Qty Received', dataIndex: 'qtyReceived', key: 'qtyReceived', width: 120, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={0} value={val} style={{ width: '100%' }}
          onChange={(v) => updateItemRow(index, 'qtyReceived', v)} disabled={isView} />
      ),
    },
    {
      title: 'Quality', dataIndex: 'qualityStatus', key: 'qualityStatus', width: 130,
      render: (val, _, index) => (
        <Select size="small" value={val} options={QUALITY_OPTIONS} style={{ width: '100%' }}
          onChange={(v) => updateItemRow(index, 'qualityStatus', v)} disabled={isView} />
      ),
    },
    ...(!isView ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeItemRow(index)} />
      ),
    }] : []),
  ], [isView, updateItemRow, removeItemRow]);

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isView ? `Receipt: ${record?.receiptNo || ''}` : 'New Cut Parts Receipt'}
        onBack={() => navigate('/sewing/cut-parts-receipt/list')}
        extra={!isView && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            Save
          </Button>
        )}
      />

      <Card title="Receipt Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={isView}
          initialValues={{ receiptDate: dayjs(), qualityStatus: 'OK' }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="sewingPlanId" label="Sewing Plan" rules={[{ required: true, message: 'Select a sewing plan' }]}>
                <Select
                  showSearch filterOption={false}
                  onSearch={handlePlanSearch}
                  loading={planSearching} options={planOptions}
                  placeholder="Search sewing plans..."
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="receiptDate" label="Receipt Date" rules={[{ required: true, message: 'Date is required' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="receivedBy" label="Received By">
                <Input placeholder="Name of receiver" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="remarks" label="Remarks">
                <Input.TextArea rows={2} placeholder="Remarks" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>

      <Card
        title={`Items (${totalBundles} bundles, ${totalPieces} pieces)`}
        extra={!isView && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addItemRow}>Add Item</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={itemColumns}
          dataSource={items}
          pagination={false}
          size="small"
          scroll={{ x: 700 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} />
              <Table.Summary.Cell index={2} />
              <Table.Summary.Cell index={3} align="right"><strong>{totalPieces}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={4} />
              {!isView && <Table.Summary.Cell index={5} />}
            </Table.Summary.Row>
          )}
        />
      </Card>
    </>
  );
};

export default CutPartsReceiptForm;
