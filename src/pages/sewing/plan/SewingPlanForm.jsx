import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, DatePicker, InputNumber, Button, Card,
  Row, Col, Space, Table, Skeleton, Descriptions,
} from 'antd';
import { SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import {
  createSewingPlan, updateSewingPlan, getSewingPlanById,
  getAllActiveLines, getSamByStyle, searchOperators,
} from '../../../services/sewing/sewingService';
import { SEW_PLAN_EDITABLE, MACHINE_TYPES } from '../../../utils/sewingConstants';
import { searchOrders } from '../../../services/orders/orderService';
import { formatNumber } from '../../../utils/formatters';

const { TextArea } = Input;

const SewingPlanForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [record, setRecord] = useState(null);

  const [lineOptions, setLineOptions] = useState([]);
  const [orderOptions, setOrderOptions] = useState([]);
  const [orderSearching, setOrderSearching] = useState(false);
  const [operatorOptions, setOperatorOptions] = useState([]);
  const [operations, setOperations] = useState([]);

  // Watched form values for auto-calc
  const samPerPiece = Form.useWatch('samPerPiece', form);
  const numOperators = Form.useWatch('numOperators', form);
  const targetEfficiencyPct = Form.useWatch('targetEfficiencyPct', form);
  const workingHours = Form.useWatch('workingHours', form);

  // Auto-calc targets
  const targetPerHour = useMemo(() => {
    if (!samPerPiece || samPerPiece <= 0 || !numOperators) return 0;
    return Math.round((numOperators * 60 / samPerPiece) * (targetEfficiencyPct || 0) / 100);
  }, [samPerPiece, numOperators, targetEfficiencyPct]);

  const targetPerDay = useMemo(() => {
    return targetPerHour * (workingHours || 0);
  }, [targetPerHour, workingHours]);

  // Load active lines
  useEffect(() => {
    getAllActiveLines()
      .then((lines) => {
        setLineOptions((lines || []).map((l) => ({ value: l.id, label: l.lineName || l.lineCode })));
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Load operators for operations table
  useEffect(() => {
    searchOperators({ status: 'ACTIVE', page: 0, size: 500 })
      .then((res) => {
        setOperatorOptions((res.content || []).map((op) => ({
          value: op.id,
          label: `${op.empCode} - ${op.operatorName}`,
        })));
      })
      .catch(() => { /* ignore */ });
  }, []);

  // Load record in edit mode
  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getSewingPlanById(id)
        .then((data) => {
          setRecord(data);
          form.setFieldsValue({
            orderId: data.orderId,
            lineId: data.lineId,
            cutPlanId: data.cutPlanId,
            planDate: data.planDate ? dayjs(data.planDate) : null,
            productionStartDate: data.productionStartDate ? dayjs(data.productionStartDate) : null,
            productionEndDate: data.productionEndDate ? dayjs(data.productionEndDate) : null,
            samPerPiece: data.samPerPiece,
            numOperators: data.numOperators,
            helperCount: data.helperCount,
            workingHours: data.workingHours,
            targetEfficiencyPct: data.targetEfficiencyPct,
            pricePerPiece: data.pricePerPiece,
            remarks: data.remarks,
          });
          setOperations(data.operations || []);
          if (data.orderId) {
            setOrderOptions([{ value: data.orderId, label: `${data.orderNo || ''} — ${data.styleNo || ''}` }]);
          }
        })
        .catch(() => message.error('Failed to load sewing plan'))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  // Search orders
  const handleOrderSearch = useCallback(async (search) => {
    if (!search || search.length < 2) return;
    setOrderSearching(true);
    try {
      const res = await searchOrders({ search, page: 0, size: 20 });
      setOrderOptions((res.content || []).map((o) => ({
        value: o.id,
        label: `${o.orderNo || ''} — ${o.styleNo || ''} — ${o.buyerName || ''}`,
        order: o,
      })));
    } catch { /* ignore */ }
    finally { setOrderSearching(false); }
  }, []);

  // When order is selected, load SAM operations for the style
  const handleOrderSelect = useCallback(async (_value, option) => {
    const order = option?.order;
    if (!order) return;
    try {
      const samList = await getSamByStyle(order.styleId || order.id);
      if (samList && samList.length > 0) {
        setOperations(samList.map((s) => ({
          operationName: s.operationName,
          machineType: s.machineType,
          samMinutes: s.samMinutes,
          sequenceNo: s.sequenceNo,
          operatorId: null,
        })));
        // Auto-set total SAM
        const totalSam = samList.reduce((sum, s) => sum + (s.samMinutes || 0), 0);
        form.setFieldsValue({ samPerPiece: Math.round(totalSam * 100) / 100 });
      }
    } catch { /* ignore */ }
  }, [form]);

  // Operations table handlers
  const addOperationRow = useCallback(() => {
    setOperations((prev) => [...prev, {
      operationName: '', machineType: null, samMinutes: 0, operatorId: null, sequenceNo: prev.length + 1,
    }]);
  }, []);

  const removeOperationRow = useCallback((index) => {
    setOperations((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateOperationRow = useCallback((index, field, value) => {
    setOperations((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }, []);

  const handleSave = useCallback(async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        orderId: values.orderId,
        lineId: values.lineId,
        cutPlanId: values.cutPlanId,
        planDate: values.planDate?.format('YYYY-MM-DD'),
        productionStartDate: values.productionStartDate?.format('YYYY-MM-DD'),
        productionEndDate: values.productionEndDate?.format('YYYY-MM-DD'),
        samPerPiece: values.samPerPiece,
        numOperators: values.numOperators,
        helperCount: values.helperCount,
        workingHours: values.workingHours,
        targetEfficiencyPct: values.targetEfficiencyPct,
        targetPerHour,
        targetPerDay,
        pricePerPiece: values.pricePerPiece,
        remarks: values.remarks,
        operations: operations.map((op) => ({
          id: op.id,
          operationName: op.operationName,
          machineType: op.machineType,
          samMinutes: op.samMinutes,
          operatorId: op.operatorId,
          sequenceNo: op.sequenceNo,
        })),
        version: record?.version,
      };
      if (isEdit) {
        await updateSewingPlan(id, payload);
        message.success('Sewing plan updated');
      } else {
        await createSewingPlan(payload);
        message.success('Sewing plan created');
      }
      navigate('/sewing/plan/list');
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [form, operations, targetPerHour, targetPerDay, record, isEdit, id, navigate]);

  const isEditable = !isEdit || (record && SEW_PLAN_EDITABLE.includes(record.status));

  const machineTypeOptions = useMemo(() => MACHINE_TYPES, []);

  const operationColumns = useMemo(() => [
    {
      title: '#', dataIndex: 'sequenceNo', key: 'sequenceNo', width: 60, align: 'center',
      render: (val, _, index) => (
        <InputNumber size="small" min={1} value={val} style={{ width: '100%' }}
          onChange={(v) => updateOperationRow(index, 'sequenceNo', v)} disabled={!isEditable} />
      ),
    },
    {
      title: 'Operation', dataIndex: 'operationName', key: 'operationName', width: 200,
      render: (val, _, index) => (
        <Input size="small" value={val} placeholder="Operation name"
          onChange={(e) => updateOperationRow(index, 'operationName', e.target.value)} disabled={!isEditable} />
      ),
    },
    {
      title: 'Machine Type', dataIndex: 'machineType', key: 'machineType', width: 130,
      render: (val, _, index) => (
        <Select size="small" value={val} allowClear options={machineTypeOptions}
          style={{ width: '100%' }} placeholder="Select"
          onChange={(v) => updateOperationRow(index, 'machineType', v)} disabled={!isEditable} />
      ),
    },
    {
      title: 'SAM (min)', dataIndex: 'samMinutes', key: 'samMinutes', width: 100, align: 'right',
      render: (val, _, index) => (
        <InputNumber size="small" min={0} precision={2} value={val} style={{ width: '100%' }}
          onChange={(v) => updateOperationRow(index, 'samMinutes', v)} disabled={!isEditable} />
      ),
    },
    {
      title: 'Operator', dataIndex: 'operatorId', key: 'operatorId', width: 220,
      render: (val, _, index) => (
        <Select size="small" value={val} allowClear showSearch optionFilterProp="label"
          options={operatorOptions} style={{ width: '100%' }} placeholder="Select operator"
          onChange={(v) => updateOperationRow(index, 'operatorId', v)} disabled={!isEditable} />
      ),
    },
    ...(isEditable ? [{
      title: '', key: 'action', width: 50,
      render: (_, __, index) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeOperationRow(index)} />
      ),
    }] : []),
  ], [isEditable, operatorOptions, machineTypeOptions, updateOperationRow, removeOperationRow]);

  if (loading) return <Skeleton active paragraph={{ rows: 12 }} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit Plan: ${record?.planNo || ''}` : 'New Sewing Production Plan'}
        onBack={() => navigate('/sewing/plan/list')}
        extra={isEditable && (
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave}>
            {isEdit ? 'Update' : 'Save'}
          </Button>
        )}
      />

      <Card title="Plan Details" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" disabled={!isEditable}
          initialValues={{ planDate: dayjs(), workingHours: 8, targetEfficiencyPct: 60 }}
        >
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="orderId" label="Order" rules={[{ required: true, message: 'Select an order' }]}>
                <Select
                  showSearch filterOption={false}
                  onSearch={handleOrderSearch} onSelect={handleOrderSelect}
                  loading={orderSearching} options={orderOptions}
                  placeholder="Search orders..." disabled={isEdit}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="lineId" label="Sewing Line" rules={[{ required: true, message: 'Select a line' }]}>
                <Select showSearch optionFilterProp="label" options={lineOptions} placeholder="Select line" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="cutPlanId" label="Cut Plan (optional)">
                <InputNumber style={{ width: '100%' }} placeholder="Cut plan ID" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="planDate" label="Plan Date">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="productionStartDate" label="Production Start">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8}>
              <Form.Item name="productionEndDate" label="Production End">
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="samPerPiece" label="SAM / Piece" rules={[{ required: true, message: 'SAM is required' }]}>
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="numOperators" label="No. of Operators" rules={[{ required: true, message: 'Required' }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="helperCount" label="Helper Count">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="workingHours" label="Working Hours">
                <InputNumber min={1} max={24} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="targetEfficiencyPct" label="Target Efficiency %">
                <InputNumber min={0} max={200} precision={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="Target / Hour">
                <InputNumber value={targetPerHour} disabled style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item label="Target / Day">
                <InputNumber value={targetPerDay} disabled style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="pricePerPiece" label="Price / Piece">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
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
        title="Operations (from SAM)"
        extra={isEditable && (
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addOperationRow}>Add Operation</Button>
        )}
      >
        <Table
          rowKey={(_, index) => index}
          columns={operationColumns}
          dataSource={operations}
          pagination={false}
          size="small"
          scroll={{ x: 800 }}
          locale={{ emptyText: <EmptyState description="No operations. Select an order to auto-load SAM." /> }}
          summary={() => {
            const totalSam = operations.reduce((sum, op) => sum + (op.samMinutes || 0), 0);
            return (
              <Table.Summary.Row>
                <Table.Summary.Cell index={0} />
                <Table.Summary.Cell index={1}><strong>Total</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={2} />
                <Table.Summary.Cell index={3} align="right"><strong>{totalSam.toFixed(2)}</strong></Table.Summary.Cell>
                <Table.Summary.Cell index={4} />
                {isEditable && <Table.Summary.Cell index={5} />}
              </Table.Summary.Row>
            );
          }}
        />
      </Card>
    </>
  );
};

export default SewingPlanForm;
