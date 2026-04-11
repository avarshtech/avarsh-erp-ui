import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, DatePicker, InputNumber, Button, Card,
  Row, Col, Space, Typography, Tabs, Table, Radio, Tag, Skeleton,
} from 'antd';
import { SaveOutlined, SendOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import { ActionButton } from '../../components/buttons';
import {
  createCuttingPO, updateCuttingPO, getCuttingPOById, changeCuttingPOStatus,
} from '../../services/cuttingpo/cuttingPoService';
import { searchOrders } from '../../services/orders/orderService';
import {
  CUTTING_PO_STATUS, EDITABLE_STATUSES, getStatusLabel, getStatusColor,
} from '../../utils/cuttingPoConstants';
import { PROCESSING_UNIT_TYPE, PROCESSING_UNIT_TYPE_OPTIONS } from '../../utils/workOrderConstants';
import { numericInputProps } from '../../utils/inputHelpers';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';

const { Text } = Typography;
const { TextArea } = Input;

const CuttingPOForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cuttingPO, setCuttingPO] = useState(null);
  const [orderOptions, setOrderOptions] = useState([]);
  const [orderSearching, setOrderSearching] = useState(false);
  const [sizeColorItems, setSizeColorItems] = useState([]);
  const [activeTab, setActiveTab] = useState('general');
  const { setHasChanges } = useUnsavedChanges();

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getCuttingPOById(id)
        .then((data) => {
          setCuttingPO(data);
          form.setFieldsValue({
            orderId: data.orderId,
            styleNo: data.styleNo,
            bomId: data.bomId,
            processingUnitType: data.processingUnitType || PROCESSING_UNIT_TYPE.UNIT,
            processingUnitName: data.processingUnitName,
            plannedCutDate: data.plannedCutDate ? dayjs(data.plannedCutDate) : null,
            plannedDeliveryDate: data.plannedDeliveryDate ? dayjs(data.plannedDeliveryDate) : null,
            allowancePercent: data.allowancePercent,
            markerEfficiency: data.markerEfficiency,
            cadConsumptionPerPc: data.cadConsumptionPerPc,
            bomConsumptionPerPc: data.bomConsumptionPerPc,
            fabricWastagePercent: data.fabricWastagePercent,
            remarks: data.remarks,
          });
          setSizeColorItems(data.items || []);
          if (data.orderId && data.orderNo) {
            setOrderOptions([{ value: data.orderId, label: `${data.orderNo} — ${data.buyerName || ''}`,
              orderNo: data.orderNo, buyerName: data.buyerName, styleNo: data.styleNo, styleId: data.styleId }]);
          }
        })
        .catch(() => message.error('Failed to load cutting PO'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  const handleOrderSearch = useCallback(async (value) => {
    if (!value || value.length < 2) return;
    setOrderSearching(true);
    try {
      const result = await searchOrders({ search: value, status: 'CONFIRMED', size: 20 });
      setOrderOptions((result.content || []).map((o) => ({
        value: o.id, label: `${o.orderNo} — ${o.buyerName || ''}`,
        orderNo: o.orderNo, buyerName: o.buyerName, styleNo: o.styleNo,
        styleId: o.styleId, totalOrderQty: o.totalOrderQty, orderLines: o.orderLines,
      })));
    } catch { /* silent */ }
    finally { setOrderSearching(false); }
  }, []);

  const handleOrderSelect = useCallback((orderId) => {
    const order = orderOptions.find((o) => o.value === orderId);
    if (order) {
      form.setFieldsValue({ styleNo: order.styleNo, totalOrderQty: order.totalOrderQty });
      const items = [];
      (order.orderLines || []).forEach((line) => {
        (line.colorRows || []).forEach((colorRow) => {
          const quantities = colorRow.quantities || {};
          Object.entries(quantities).forEach(([size, qty]) => {
            if (qty > 0) items.push({ color: colorRow.colorName, size, orderQty: qty, allowancePercent: 0, plannedQty: qty, ratePerPiece: 0 });
          });
        });
      });
      setSizeColorItems(items);
      setHasChanges(true);
    }
  }, [orderOptions, form, setHasChanges]);

  const handleRateChange = useCallback((index, value) => {
    setSizeColorItems((prev) => { const u = [...prev]; u[index] = { ...u[index], ratePerPiece: value || 0 }; return u; });
    setHasChanges(true);
  }, [setHasChanges]);

  const handleAllowanceChange = useCallback((index, value) => {
    setSizeColorItems((prev) => {
      const u = [...prev];
      const item = { ...u[index] };
      item.allowancePercent = value || 0;
      item.plannedQty = Math.ceil(item.orderQty * (1 + (value || 0) / 100));
      u[index] = item;
      return u;
    });
    setHasChanges(true);
  }, [setHasChanges]);

  const isEditable = !isEdit || (cuttingPO && EDITABLE_STATUSES.includes(cuttingPO.status));

  const sizeColorColumns = useMemo(() => [
    { title: 'Color', dataIndex: 'color', key: 'color', width: 120 },
    { title: 'Size', dataIndex: 'size', key: 'size', width: 80 },
    { title: 'Order Qty', dataIndex: 'orderQty', key: 'orderQty', width: 100, align: 'right', render: (q) => (q || 0).toLocaleString() },
    { title: 'Allowance %', dataIndex: 'allowancePercent', key: 'allowancePercent', width: 120, align: 'right',
      render: (val, _, index) => isEditable
        ? <InputNumber size="small" min={0} max={50} value={val} onChange={(v) => handleAllowanceChange(index, v)} style={{ width: 80 }} {...numericInputProps} />
        : `${val || 0}%`,
    },
    { title: 'Planned Qty', dataIndex: 'plannedQty', key: 'plannedQty', width: 110, align: 'right', render: (q) => <Text strong>{(q || 0).toLocaleString()}</Text> },
    { title: 'Rate/Pc', dataIndex: 'ratePerPiece', key: 'ratePerPiece', width: 120, align: 'right',
      render: (val, _, index) => isEditable
        ? <InputNumber size="small" min={0} precision={2} value={val} onChange={(v) => handleRateChange(index, v)} style={{ width: 100 }} {...numericInputProps} />
        : (val || 0).toFixed(2),
    },
    { title: 'Total Cost', key: 'totalCost', width: 120, align: 'right',
      render: (_, r) => <Text strong>{((r.plannedQty || 0) * (r.ratePerPiece || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text> },
  ], [handleRateChange, handleAllowanceChange, isEditable]);

  const totals = useMemo(() => ({
    totalOrderQty: sizeColorItems.reduce((s, i) => s + (i.orderQty || 0), 0),
    totalPlannedQty: sizeColorItems.reduce((s, i) => s + (i.plannedQty || 0), 0),
    totalCost: sizeColorItems.reduce((s, i) => s + (i.plannedQty || 0) * (i.ratePerPiece || 0), 0),
  }), [sizeColorItems]);

  const buildPayload = useCallback(() => {
    const values = form.getFieldsValue();
    const selectedOrder = orderOptions.find((o) => o.value === values.orderId);
    return {
      orderId: values.orderId,
      styleId: selectedOrder?.styleId || cuttingPO?.styleId,
      styleNo: values.styleNo || selectedOrder?.styleNo,
      bomId: values.bomId,
      processingUnitType: values.processingUnitType || PROCESSING_UNIT_TYPE.UNIT,
      processingUnitName: values.processingUnitName,
      plannedCutDate: values.plannedCutDate?.format('YYYY-MM-DD'),
      plannedDeliveryDate: values.plannedDeliveryDate?.format('YYYY-MM-DD'),
      totalOrderQty: totals.totalOrderQty,
      allowancePercent: values.allowancePercent || 0,
      totalPlannedQty: totals.totalPlannedQty,
      markerEfficiency: values.markerEfficiency,
      cadConsumptionPerPc: values.cadConsumptionPerPc,
      bomConsumptionPerPc: values.bomConsumptionPerPc,
      fabricWastagePercent: values.fabricWastagePercent || 0,
      remarks: values.remarks,
      version: cuttingPO?.version,
      items: sizeColorItems.map((item) => ({
        id: item.id, color: item.color, size: item.size,
        orderQty: item.orderQty, allowancePercent: item.allowancePercent || 0,
        plannedQty: item.plannedQty, ratePerPiece: item.ratePerPiece || 0,
      })),
    };
  }, [form, orderOptions, cuttingPO, totals, sizeColorItems]);

  const handleSave = useCallback(async () => {
    try { await form.validateFields(); } catch { message.warning('Please fill required fields'); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) { await updateCuttingPO(id, payload); message.success('Cutting PO updated'); }
      else { const result = await createCuttingPO(payload); message.success(`${result.cuttingPoNo} created`); navigate(`/cutting-po/edit/${result.id}`, { replace: true }); return; }
      setHasChanges(false);
      const updated = await getCuttingPOById(id);
      setCuttingPO(updated);
      setSizeColorItems(updated.items || []);
    } catch { message.error('Failed to save'); }
    finally { setSaving(false); }
  }, [form, buildPayload, isEdit, id, navigate, setHasChanges]);

  const handleSubmit = useCallback(async () => {
    try { await form.validateFields(); } catch { message.warning('Please fill required fields'); return; }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      let savedId = id;
      if (isEdit) { await updateCuttingPO(id, payload); }
      else { const result = await createCuttingPO(payload); savedId = result.id; }
      await changeCuttingPOStatus(savedId, { status: CUTTING_PO_STATUS.PENDING_APPROVAL });
      message.success('Cutting PO submitted for approval');
      setHasChanges(false);
      navigate('/cutting-po/list');
    } catch { message.error('Failed to submit'); }
    finally { setSubmitting(false); }
  }, [form, buildPayload, isEdit, id, navigate, setHasChanges]);

  if (loading) return <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 10 }} /></div>;

  const tabItems = [
    {
      key: 'general', label: 'General',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Form.Item name="orderId" label="Order" rules={[{ required: true, message: 'Select an order' }]}>
              <Select showSearch filterOption={false} onSearch={handleOrderSearch} onSelect={handleOrderSelect}
                loading={orderSearching} options={orderOptions} placeholder="Search order no..." disabled={!isEditable} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}><Form.Item name="styleNo" label="Style No"><Input disabled /></Form.Item></Col>
          <Col xs={24} md={8}>
            <Form.Item name="processingUnitType" label="Processing Unit Type">
              <Radio.Group options={PROCESSING_UNIT_TYPE_OPTIONS} optionType="button" buttonStyle="solid" disabled={!isEditable} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}><Form.Item name="processingUnitName" label="Processing Unit / Vendor"><Input placeholder="Enter unit or vendor" disabled={!isEditable} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="plannedCutDate" label="Planned Cut Date"><DatePicker style={{ width: '100%' }} disabled={!isEditable} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="plannedDeliveryDate" label="Planned Delivery Date"><DatePicker style={{ width: '100%' }} disabled={!isEditable} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="allowancePercent" label="Overall Allowance %"><InputNumber style={{ width: '100%' }} min={0} max={50} precision={2} disabled={!isEditable} {...numericInputProps} /></Form.Item></Col>
          <Col xs={24}><Form.Item name="remarks" label="Remarks"><TextArea rows={3} placeholder="Notes" disabled={!isEditable} /></Form.Item></Col>
        </Row>
      ),
    },
    {
      key: 'sizeColor', label: `Size-Color Matrix (${sizeColorItems.length})`,
      children: (
        <Table rowKey={(r, i) => `${r.color}-${r.size}-${i}`} columns={sizeColorColumns} dataSource={sizeColorItems}
          pagination={false} size="small" scroll={{ x: 800 }}
          summary={() => (
            <Table.Summary fixed>
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} colSpan={2}><Text strong>Totals</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={2} align="right"><Text strong>{totals.totalOrderQty.toLocaleString()}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={3} />
                <Table.Summary.Cell index={4} align="right"><Text strong>{totals.totalPlannedQty.toLocaleString()}</Text></Table.Summary.Cell>
                <Table.Summary.Cell index={5} />
                <Table.Summary.Cell index={6} align="right"><Text strong>{totals.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text></Table.Summary.Cell>
              </Table.Summary.Row>
            </Table.Summary>
          )} />
      ),
    },
    {
      key: 'consumption', label: 'Consumption',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}><Form.Item name="bomConsumptionPerPc" label="BOM Consumption/Pc"><InputNumber style={{ width: '100%' }} min={0} precision={4} disabled={!isEditable} {...numericInputProps} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="cadConsumptionPerPc" label="CAD Consumption/Pc"><InputNumber style={{ width: '100%' }} min={0} precision={4} disabled={!isEditable} {...numericInputProps} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="markerEfficiency" label="Marker Efficiency %"><InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} disabled={!isEditable} {...numericInputProps} /></Form.Item></Col>
          <Col xs={24} md={8}><Form.Item name="fabricWastagePercent" label="Fabric Wastage %"><InputNumber style={{ width: '100%' }} min={0} max={50} precision={2} disabled={!isEditable} {...numericInputProps} /></Form.Item></Col>
        </Row>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isEdit ? `Edit Cutting PO — ${cuttingPO?.cuttingPoNo || ''}` : 'New Cutting PO'}
        extra={<Space>{isEdit && cuttingPO && <Tag color={getStatusColor(cuttingPO.status)}>{getStatusLabel(cuttingPO.status)}</Tag>}</Space>}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/cutting-po/list')}>Back</Button>
          {isEditable && (
            <>
              <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>Save Draft</Button>
              <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} loading={submitting}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}>Submit for Approval</Button>
            </>
          )}
        </Space>
      </PageHeader>
      <Card>
        <Form form={form} layout="vertical" initialValues={{ processingUnitType: PROCESSING_UNIT_TYPE.UNIT }}
          onValuesChange={() => setHasChanges(true)}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </Form>
      </Card>
    </div>
  );
};

export default CuttingPOForm;
