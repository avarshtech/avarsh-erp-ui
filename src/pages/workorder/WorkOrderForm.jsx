import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Card,
  Row,
  Col,
  Space,
  Typography,
  Tabs,
  Table,
  Radio,
  Tag,
  Descriptions,
  Skeleton,
} from 'antd';
import { SaveOutlined, SendOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import { ActionButton } from '../../components/buttons';
import {
  createWorkOrder,
  updateWorkOrder,
  getWorkOrderById,
  changeWorkOrderStatus,
} from '../../services/workOrderService';
import { searchOrders } from '../../services/orderService';
import { getApprovedCuttingPOsByOrder } from '../../services/cuttingPoService';
import {
  WORK_ORDER_STATUS,
  EDITABLE_STATUSES,
  PROCESSING_UNIT_TYPE,
  PROCESSING_UNIT_TYPE_OPTIONS,
  getStatusLabel,
  getStatusColor,
} from '../../utils/workOrderConstants';
import { numericInputProps } from '../../utils/inputHelpers';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';

const { Text, Title } = Typography;
const { TextArea } = Input;

const WorkOrderForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [workOrder, setWorkOrder] = useState(null);
  const [orderOptions, setOrderOptions] = useState([]);
  const [orderSearching, setOrderSearching] = useState(false);
  const [sizeColorItems, setSizeColorItems] = useState([]);
  const [cuttingPoOptions, setCuttingPoOptions] = useState([]);
  const [activeTab, setActiveTab] = useState('general');

  const [isDirty, setHasChanges] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  // Load existing work order for edit
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getWorkOrderById(id)
        .then((data) => {
          setWorkOrder(data);
          form.setFieldsValue({
            orderId: data.orderId,
            cuttingPoId: data.cuttingPoId,
            styleNo: data.styleNo,
            bomId: data.bomId,
            sewingLine: data.sewingLine,
            processingUnitType: data.processingUnitType || PROCESSING_UNIT_TYPE.UNIT,
            processingUnitName: data.processingUnitName,
            plannedStartDate: data.plannedStartDate ? dayjs(data.plannedStartDate) : null,
            plannedEndDate: data.plannedEndDate ? dayjs(data.plannedEndDate) : null,
            plannedDeliveryDate: data.plannedDeliveryDate ? dayjs(data.plannedDeliveryDate) : null,
            totalOrderQty: data.totalOrderQty,
            allowancePercent: data.allowancePercent,
            totalPlannedQty: data.totalPlannedQty,
            sam: data.sam,
            targetDailyOutput: data.targetDailyOutput,
            remarks: data.remarks,
          });
          setSizeColorItems(data.items || []);
          // Set order option for display
          if (data.orderId && data.orderNo) {
            setOrderOptions([{
              value: data.orderId,
              label: `${data.orderNo} — ${data.buyerName || ''}`,
              orderNo: data.orderNo,
              buyerName: data.buyerName,
              styleNo: data.styleNo,
              styleId: data.styleId,
            }]);
            // Load approved Cutting POs for this order
            getApprovedCuttingPOsByOrder(data.orderId)
              .then((cpos) => setCuttingPoOptions(cpos.map((c) => ({
                value: c.id, label: c.cuttingPoNo,
              }))))
              .catch(() => {});
          }
        })
        .catch(() => message.error('Failed to load work order'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  // Search orders for dropdown
  const handleOrderSearch = useCallback(async (value) => {
    if (!value || value.length < 2) return;
    setOrderSearching(true);
    try {
      const result = await searchOrders({ search: value, status: 'CONFIRMED', size: 20 });
      setOrderOptions(
        (result.content || []).map((o) => ({
          value: o.id,
          label: `${o.orderNo} — ${o.buyerName || ''}`,
          orderNo: o.orderNo,
          buyerName: o.buyerName,
          styleNo: o.styleNo,
          styleId: o.styleId,
          totalOrderQty: o.totalOrderQty,
          orderLines: o.orderLines,
        }))
      );
    } catch {
      // silent
    } finally {
      setOrderSearching(false);
    }
  }, []);

  // On order selection — auto-populate fields and load CPOs
  const handleOrderSelect = useCallback((orderId) => {
    const order = orderOptions.find((o) => o.value === orderId);
    if (order) {
      form.setFieldsValue({
        styleNo: order.styleNo,
        totalOrderQty: order.totalOrderQty,
        cuttingPoId: undefined,
      });
      // Load approved Cutting POs for dropdown
      getApprovedCuttingPOsByOrder(orderId)
        .then((cpos) => setCuttingPoOptions(cpos.map((c) => ({
          value: c.id, label: c.cuttingPoNo,
        }))))
        .catch(() => setCuttingPoOptions([]));
      // Build size-color items from order lines
      const items = [];
      (order.orderLines || []).forEach((line) => {
        (line.colorRows || []).forEach((colorRow) => {
          const quantities = colorRow.quantities || {};
          Object.entries(quantities).forEach(([size, qty]) => {
            if (qty > 0) {
              items.push({
                color: colorRow.colorName,
                size,
                orderQty: qty,
                allowancePercent: 0,
                plannedQty: qty,
                ratePerPiece: 0,
              });
            }
          });
        });
      });
      setSizeColorItems(items);
      setHasChanges(true);
    }
  }, [orderOptions, form, setHasChanges]);

  // Handle rate change in size-color matrix
  const handleRateChange = useCallback((index, value) => {
    setSizeColorItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ratePerPiece: value || 0 };
      return updated;
    });
    setHasChanges(true);
  }, [setHasChanges]);

  // Handle allowance change
  const handleAllowanceChange = useCallback((index, value) => {
    setSizeColorItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };
      item.allowancePercent = value || 0;
      item.plannedQty = Math.ceil(item.orderQty * (1 + (value || 0) / 100));
      updated[index] = item;
      return updated;
    });
    setHasChanges(true);
  }, [setHasChanges]);

  // Size-color matrix columns
  const sizeColorColumns = useMemo(() => [
    { title: 'Color', dataIndex: 'color', key: 'color', width: 120 },
    { title: 'Size', dataIndex: 'size', key: 'size', width: 80 },
    {
      title: 'Order Qty',
      dataIndex: 'orderQty',
      key: 'orderQty',
      width: 100,
      align: 'right',
      render: (qty) => (qty || 0).toLocaleString(),
    },
    {
      title: 'Allowance %',
      dataIndex: 'allowancePercent',
      key: 'allowancePercent',
      width: 120,
      align: 'right',
      render: (val, _, index) => (
        isEditable ? (
          <InputNumber
            size="small"
            min={0}
            max={50}
            value={val}
            onChange={(v) => handleAllowanceChange(index, v)}
            style={{ width: 80 }}
            {...numericInputProps}
          />
        ) : `${val || 0}%`
      ),
    },
    {
      title: 'Planned Qty',
      dataIndex: 'plannedQty',
      key: 'plannedQty',
      width: 110,
      align: 'right',
      render: (qty) => <Text strong>{(qty || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Rate/Pc',
      dataIndex: 'ratePerPiece',
      key: 'ratePerPiece',
      width: 120,
      align: 'right',
      render: (val, _, index) => (
        isEditable ? (
          <InputNumber
            size="small"
            min={0}
            precision={2}
            value={val}
            onChange={(v) => handleRateChange(index, v)}
            style={{ width: 100 }}
            {...numericInputProps}
          />
        ) : (val || 0).toFixed(2)
      ),
    },
    {
      title: 'Total Cost',
      key: 'totalCost',
      width: 120,
      align: 'right',
      render: (_, record) => {
        const total = (record.plannedQty || 0) * (record.ratePerPiece || 0);
        return <Text strong>{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>;
      },
    },
  ], [handleRateChange, handleAllowanceChange]);

  const isEditable = !isEdit || (workOrder && EDITABLE_STATUSES.includes(workOrder.status));

  // Compute totals
  const totals = useMemo(() => {
    const totalOrderQty = sizeColorItems.reduce((sum, item) => sum + (item.orderQty || 0), 0);
    const totalPlannedQty = sizeColorItems.reduce((sum, item) => sum + (item.plannedQty || 0), 0);
    const totalCost = sizeColorItems.reduce(
      (sum, item) => sum + (item.plannedQty || 0) * (item.ratePerPiece || 0), 0
    );
    return { totalOrderQty, totalPlannedQty, totalCost };
  }, [sizeColorItems]);

  // Build payload
  const buildPayload = useCallback(() => {
    const values = form.getFieldsValue();
    const selectedOrder = orderOptions.find((o) => o.value === values.orderId);

    return {
      orderId: values.orderId,
      cuttingPoId: values.cuttingPoId,
      styleId: selectedOrder?.styleId || workOrder?.styleId,
      styleNo: values.styleNo || selectedOrder?.styleNo,
      bomId: values.bomId,
      sewingLine: values.sewingLine,
      processingUnitType: values.processingUnitType || PROCESSING_UNIT_TYPE.UNIT,
      processingUnitName: values.processingUnitName,
      plannedStartDate: values.plannedStartDate?.format('YYYY-MM-DD'),
      plannedEndDate: values.plannedEndDate?.format('YYYY-MM-DD'),
      plannedDeliveryDate: values.plannedDeliveryDate?.format('YYYY-MM-DD'),
      totalOrderQty: totals.totalOrderQty,
      allowancePercent: values.allowancePercent || 0,
      totalPlannedQty: totals.totalPlannedQty,
      sam: values.sam,
      targetDailyOutput: values.targetDailyOutput,
      remarks: values.remarks,
      version: workOrder?.version,
      items: sizeColorItems.map((item) => ({
        id: item.id,
        color: item.color,
        size: item.size,
        orderQty: item.orderQty,
        allowancePercent: item.allowancePercent || 0,
        plannedQty: item.plannedQty,
        ratePerPiece: item.ratePerPiece || 0,
      })),
    };
  }, [form, orderOptions, workOrder, totals, sizeColorItems]);

  // Save as Draft
  const handleSave = useCallback(async () => {
    try {
      await form.validateFields();
    } catch {
      message.warning('Please fill required fields');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await updateWorkOrder(id, payload);
        message.success('Work Order updated');
      } else {
        const result = await createWorkOrder(payload);
        message.success(`Work Order ${result.workOrderNo} created`);
        setHasChanges(false);
        clearDirty();
        navigate(`/work-orders/edit/${result.id}`, { replace: true });
        return;
      }
      setHasChanges(false);
      // Reload
      const updated = await getWorkOrderById(id);
      setWorkOrder(updated);
      setSizeColorItems(updated.items || []);
    } catch {
      message.error('Failed to save work order');
    } finally {
      setSaving(false);
    }
  }, [form, buildPayload, isEdit, id, navigate, setHasChanges]);

  // Submit for Approval
  const handleSubmit = useCallback(async () => {
    // Save first, then submit
    try {
      await form.validateFields();
    } catch {
      message.warning('Please fill required fields before submitting');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      let savedId = id;
      if (isEdit) {
        await updateWorkOrder(id, payload);
      } else {
        const result = await createWorkOrder(payload);
        savedId = result.id;
      }
      await changeWorkOrderStatus(savedId, { status: WORK_ORDER_STATUS.PENDING_APPROVAL });
      message.success('Work Order submitted for approval');
      setHasChanges(false);
      clearDirty();
      navigate('/work-orders/list');
    } catch {
      message.error('Failed to submit work order');
    } finally {
      setSubmitting(false);
    }
  }, [form, buildPayload, isEdit, id, navigate, setHasChanges, clearDirty]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 10 }} />
      </div>
    );
  }

  const tabItems = [
    {
      key: 'general',
      label: 'General',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Form.Item
              name="orderId"
              label="Order"
              rules={[{ required: true, message: 'Select an order' }]}
            >
              <Select
                showSearch
                filterOption={false}
                onSearch={handleOrderSearch}
                onSelect={handleOrderSelect}
                loading={orderSearching}
                options={orderOptions}
                placeholder="Search order no..."
                disabled={!isEditable}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="cuttingPoId" label="Cutting PO">
              <Select
                options={cuttingPoOptions}
                placeholder={cuttingPoOptions.length === 0 ? 'No approved CPOs' : 'Select Cutting PO'}
                allowClear
                disabled={!isEditable || cuttingPoOptions.length === 0}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="styleNo" label="Style No">
              <Input disabled />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="processingUnitType" label="Processing Unit Type">
              <Radio.Group
                options={PROCESSING_UNIT_TYPE_OPTIONS}
                optionType="button"
                buttonStyle="solid"
                disabled={!isEditable}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="processingUnitName" label="Processing Unit / Vendor Name">
              <Input placeholder="Enter unit or vendor name" disabled={!isEditable} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="sewingLine" label="Sewing Line">
              <Input placeholder="e.g. Line 3" disabled={!isEditable} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="sam" label="SAM (Std. Allowed Minutes)">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={2}
                placeholder="e.g. 12.5"
                disabled={!isEditable}
                {...numericInputProps}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="targetDailyOutput" label="Target Daily Output">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                precision={0}
                placeholder="e.g. 500"
                disabled={!isEditable}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="plannedStartDate" label="Planned Start Date">
              <DatePicker style={{ width: '100%' }} disabled={!isEditable} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="plannedEndDate" label="Planned End Date">
              <DatePicker style={{ width: '100%' }} disabled={!isEditable} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="plannedDeliveryDate" label="Planned Delivery Date">
              <DatePicker style={{ width: '100%' }} disabled={!isEditable} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="allowancePercent" label="Overall Allowance %">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={50}
                precision={2}
                disabled={!isEditable}
                {...numericInputProps}
              />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item name="remarks" label="Remarks">
              <TextArea rows={3} placeholder="Notes or instructions" disabled={!isEditable} />
            </Form.Item>
          </Col>
        </Row>
      ),
    },
    {
      key: 'sizeColor',
      label: `Size-Color Matrix (${sizeColorItems.length})`,
      children: (
        <div>
          <Table
            rowKey={(r, i) => `${r.color}-${r.size}-${i}`}
            columns={sizeColorColumns}
            dataSource={sizeColorItems}
            pagination={false}
            size="small"
            scroll={{ x: 800 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={2}>
                    <Text strong>Totals</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="right">
                    <Text strong>{totals.totalOrderQty.toLocaleString()}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} />
                  <Table.Summary.Cell index={4} align="right">
                    <Text strong>{totals.totalPlannedQty.toLocaleString()}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} />
                  <Table.Summary.Cell index={6} align="right">
                    <Text strong>
                      {totals.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `Edit Work Order — ${workOrder?.workOrderNo || ''}` : 'New Work Order'}
        extra={
          <Space>
            {isEdit && workOrder && (
              <Tag color={getStatusColor(workOrder.status)}>
                {getStatusLabel(workOrder.status)}
              </Tag>
            )}
          </Space>
        }
      >
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/work-orders/list')}>
            Back
          </Button>
          {isEditable && (
            <>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
              >
                Save Draft
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSubmit}
                loading={submitting}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
              >
                Submit for Approval
              </Button>
            </>
          )}
        </Space>
      </PageHeader>

      <Card>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            processingUnitType: PROCESSING_UNIT_TYPE.UNIT,
          }}
          onValuesChange={() => setHasChanges(true)}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        </Form>
      </Card>
    </div>
  );
};

export default WorkOrderForm;
