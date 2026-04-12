import { useState, useEffect, useCallback } from 'react';
import {
  App, Form, Input, Select, DatePicker, InputNumber, Button, Card,
  Row, Col, Space, Table, Skeleton,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createCutOrderPlan, updateCutOrderPlan, getCutOrderPlanById,
} from '../../../services/cutting/cuttingService';
import { searchCuttingPOs } from '../../../services/cuttingpo/cuttingPoService';
import { CUT_PLAN_EDITABLE } from '../../../utils/cuttingConstants';

const { TextArea } = Input;

const CutOrderPlanForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);
  const [cpoOptions, setCpoOptions] = useState([]);
  const [cpoSearching, setCpoSearching] = useState(false);
  const [sizes, setSizes] = useState([]);

  // Load record in edit mode
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getCutOrderPlanById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            cuttingPoId: data.cuttingPoId,
            color: data.color,
            deliveryDate: data.deliveryDate ? dayjs(data.deliveryDate) : null,
            allowancePct: data.allowancePct,
            remarks: data.remarks,
          });
          setSizes(data.sizes || []);
          // Populate CPO dropdown with current value
          setCpoOptions([{ value: data.cuttingPoId, label: `CPO-${data.cuttingPoId} — ${data.styleNo}` }]);
        })
        .catch(() => message.error('Failed to load plan'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  // Search approved Cutting POs
  const handleCpoSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setCpoSearching(true);
    try {
      const res = await searchCuttingPOs({ search, status: 'APPROVED', page: 0, size: 20 });
      setCpoOptions((res.content || []).map((c) => ({
        value: c.id,
        label: `${c.cuttingPoNo} — ${c.styleNo || ''} — ${c.processingUnitName || ''}`,
        cpo: c,
      })));
    } catch { /* ignore */ }
    finally { setCpoSearching(false); }
  }, []);

  // When CPO is selected, auto-populate fields
  const handleCpoSelect = useCallback((value, option) => {
    const cpo = option?.cpo;
    if (!cpo) return;
    form.setFieldsValue({
      color: cpo.items?.[0]?.color || '',
    });
    // Populate sizes from CPO items (aggregate by size)
    const sizeMap = {};
    (cpo.items || []).forEach((item) => {
      if (sizeMap[item.size]) {
        sizeMap[item.size].orderQty += item.orderQty || 0;
        sizeMap[item.size].planQty += item.plannedQty || 0;
      } else {
        sizeMap[item.size] = {
          size: item.size,
          orderQty: item.orderQty || 0,
          planQty: item.plannedQty || 0,
          ratio: 1,
        };
      }
    });
    setSizes(Object.values(sizeMap));
  }, [form]);

  // Add a size row manually
  const addSizeRow = useCallback(() => {
    setSizes((prev) => [...prev, { size: '', orderQty: 0, planQty: 0, ratio: 1 }]);
  }, []);

  // Remove a size row
  const removeSizeRow = useCallback((index) => {
    setSizes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Update a size row field
  const updateSizeRow = useCallback((index, field, value) => {
    setSizes((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }, []);

  // Calculate totals
  const totalOrderQty = sizes.reduce((sum, s) => sum + (s.orderQty || 0), 0);
  const totalPlanQty = sizes.reduce((sum, s) => sum + (s.planQty || 0), 0);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      if (sizes.length === 0) {
        message.warning('Add at least one size');
        return;
      }
      setSaving(true);
      const payload = {
        cuttingPoId: values.cuttingPoId,
        color: values.color,
        deliveryDate: values.deliveryDate?.format('YYYY-MM-DD'),
        allowancePct: values.allowancePct,
        totalOrderQty: totalOrderQty,
        totalPlanQty: totalPlanQty,
        remarks: values.remarks,
        sizes: sizes.map((s) => ({
          id: s.id,
          size: s.size,
          orderQty: s.orderQty || 0,
          planQty: s.planQty || 0,
          ratio: s.ratio || 1,
        })),
        version: record?.version,
      };
      if (isEdit) {
        await updateCutOrderPlan(id, payload);
        message.success('Plan updated');
      } else {
        await createCutOrderPlan(payload);
        message.success('Plan created');
      }
      navigate('/cutting/order-plan/list');
    } catch (err) {
      if (err?.errorFields) return; // form validation
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, sizes, totalOrderQty, totalPlanQty, record, isEdit, id, navigate]);

  const isEditable = !isEdit || (record && CUT_PLAN_EDITABLE.includes(record.status));

  const sizeColumns = [
    {
      title: 'Size', dataIndex: 'size', key: 'size', width: 120,
      render: (val, _, index) => (
        <Input size="small" value={val} placeholder="e.g. S, M, L"
          onChange={(e) => updateSizeRow(index, 'size', e.target.value)} disabled={!isEditable} />
      ),
    },
    {
      title: 'Order Qty', dataIndex: 'orderQty', key: 'orderQty', width: 120, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={0} value={val}
          onChange={(v) => updateSizeRow(index, 'orderQty', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Plan Qty', dataIndex: 'planQty', key: 'planQty', width: 120, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={0} value={val}
          onChange={(v) => updateSizeRow(index, 'planQty', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Ratio', dataIndex: 'ratio', key: 'ratio', width: 80, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={1} value={val}
          onChange={(v) => updateSizeRow(index, 'ratio', v)} disabled={!isEditable} style={{ width: '100%' }} />
      ),
    },
    ...(isEditable ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeSizeRow(index)} />
      ),
    }] : []),
  ];

  if (loading) return <Skeleton active paragraph={{ rows: 10 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit Plan: ${record?.planNo || ''}` : 'New Cut Order Plan'}
        onBack={() => navigate('/cutting/order-plan/list')}
        extra={isEditable && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        )}
      />

      <Card title="Plan Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={!isEditable}>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="cuttingPoId" label="Cutting PO" rules={[{ required: true, message: 'Select a Cutting PO' }]}>
                <Select
                  showSearch
                  filterOption={false}
                  onSearch={handleCpoSearch}
                  onSelect={handleCpoSelect}
                  loading={cpoSearching}
                  options={cpoOptions}
                  placeholder="Search approved Cutting POs..."
                  disabled={isEdit}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="color" label="Color">
                <Input placeholder="Color" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="deliveryDate" label="Delivery Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="allowancePct" label="Allowance %">
                <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Total Order Qty">
                <InputNumber value={totalOrderQty} disabled style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item label="Total Plan Qty">
                <InputNumber value={totalPlanQty} disabled style={{ width: '100%' }} />
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
        title="Size Breakdown"
        extra={isEditable && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addSizeRow}>Add Size</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={sizeColumns}
          dataSource={sizes}
          pagination={false}
          size="small"
          scroll={{ x: 500 }}
          summary={() => (
            <Table.Summary.Row>
              <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={1} align="right"><strong>{totalOrderQty}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={2} align="right"><strong>{totalPlanQty}</strong></Table.Summary.Cell>
              <Table.Summary.Cell index={3} />
              {isEditable && <Table.Summary.Cell index={4} />}
            </Table.Summary.Row>
          )}
        />
      </Card>
    </>
  );
};

export default CutOrderPlanForm;
