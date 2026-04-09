import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App, Form, Input, Select, DatePicker, InputNumber, Button, Card,
  Row, Col, Space, Typography, Tabs, Table, Switch, Tag, Skeleton,
} from 'antd';
import { SaveOutlined, ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import SizeColorMatrix from '../po/SizeColorMatrix';
import { createProductionPO, updateProductionPO, getProductionPOById, changeProductionPOStatus } from '../../services/productionPoService';
import { searchOrders } from '../../services/orderService';
import { PPO_STATUS, getPPOStatusLabel, getPPOStatusColor, STAGE_TYPE_LABELS, OPTIONAL_STAGES, STAGE_STATUS_COLORS } from '../../utils/productionPoConstants';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';

const { Text } = Typography;

const ProductionPOForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ppo, setPpo] = useState(null);
  const [orderOptions, setOrderOptions] = useState([]);
  const [orderSearching, setOrderSearching] = useState(false);
  const [sizeColorItems, setSizeColorItems] = useState([]);
  const [stages, setStages] = useState(
    Object.keys(STAGE_TYPE_LABELS).map((type, i) => ({
      stageType: type, stageNumber: i + 1, isRequired: !OPTIONAL_STAGES.has(type),
      assignedType: 'UNIT', assignedName: '', status: 'NOT_STARTED',
    }))
  );
  const [activeTab, setActiveTab] = useState('general');
  const [isDirty, setHasChanges] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  useEffect(() => {
    if (isEdit) {
      setLoading(true);
      getProductionPOById(id).then(data => {
        setPpo(data);
        form.setFieldsValue({
          orderId: data.orderId, styleNo: data.styleNo, season: data.season,
          colour: data.colour, remarks: data.remarks,
          startDate: data.startDate ? dayjs(data.startDate) : null,
          endDate: data.endDate ? dayjs(data.endDate) : null,
        });
        setSizeColorItems(data.sizeColorItems || []);
        if (data.stages) setStages(data.stages);
        if (data.orderId && data.orderNo) {
          setOrderOptions([{ value: data.orderId, label: `${data.orderNo} — ${data.buyerName || ''}`,
            orderNo: data.orderNo, styleNo: data.styleNo, styleId: data.styleId }]);
        }
      }).catch(() => message.error('Failed to load')).finally(() => setLoading(false));
    }
  }, [id, isEdit, form]);

  const handleOrderSearch = useCallback(async (v) => {
    if (!v || v.length < 2) return;
    setOrderSearching(true);
    try {
      const res = await searchOrders({ search: v, status: 'CONFIRMED', size: 20 });
      setOrderOptions((res.content || []).map(o => ({
        value: o.id, label: `${o.orderNo} — ${o.buyerName || ''}`,
        orderNo: o.orderNo, buyerName: o.buyerName, styleNo: o.styleNo,
        styleId: o.styleId, totalOrderQty: o.totalOrderQty, orderLines: o.orderLines,
      })));
    } catch {} finally { setOrderSearching(false); }
  }, []);

  const handleOrderSelect = useCallback((orderId) => {
    const order = orderOptions.find(o => o.value === orderId);
    if (!order) return;
    form.setFieldsValue({ styleNo: order.styleNo });
    const items = [];
    (order.orderLines || []).forEach(line => {
      (line.colorRows || []).forEach(cr => {
        Object.entries(cr.quantities || {}).forEach(([size, qty]) => {
          if (qty > 0) items.push({ color: cr.colorName, size, orderQty: qty, allowancePercent: 0, plannedQty: qty, ratePerPiece: 0 });
        });
      });
    });
    setSizeColorItems(items);
    setHasChanges(true);
  }, [orderOptions, form, setHasChanges]);

  const isEditable = !isEdit || (ppo && ppo.status === PPO_STATUS.OPEN);

  const stageColumns = useMemo(() => [
    { title: '#', dataIndex: 'stageNumber', key: 'stageNumber', width: 40 },
    { title: 'Stage', dataIndex: 'stageType', key: 'stageType', width: 160,
      render: t => <Text strong>{STAGE_TYPE_LABELS[t] || t}</Text> },
    { title: 'Required', dataIndex: 'isRequired', key: 'isRequired', width: 80, align: 'center',
      render: (val, _, index) => (
        <Switch size="small" checked={val} disabled={!isEditable || !OPTIONAL_STAGES.has(stages[index]?.stageType)}
          onChange={v => { const u = [...stages]; u[index] = { ...u[index], isRequired: v }; setStages(u); setHasChanges(true); }} />
      ) },
    { title: 'Assignment', dataIndex: 'assignedType', key: 'assignedType', width: 120,
      render: (val, _, index) => isEditable
        ? <Select size="small" value={val} onChange={v => { const u = [...stages]; u[index] = { ...u[index], assignedType: v }; setStages(u); }}
            options={[{ value: 'UNIT', label: 'In-house' }, { value: 'VENDOR', label: 'Vendor' }]} style={{ width: 100 }} />
        : <Tag color={val === 'VENDOR' ? 'orange' : 'blue'}>{val === 'VENDOR' ? 'Vendor' : 'Unit'}</Tag> },
    { title: 'Unit/Vendor Name', dataIndex: 'assignedName', key: 'assignedName', width: 160,
      render: (val, _, index) => isEditable
        ? <Input size="small" value={val} onChange={e => { const u = [...stages]; u[index] = { ...u[index], assignedName: e.target.value }; setStages(u); }} placeholder="Name" />
        : val || '-' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: s => <Tag color={STAGE_STATUS_COLORS[s] || 'default'}>{s?.replace(/_/g, ' ') || '-'}</Tag> },
  ], [stages, isEditable, setHasChanges]);

  const buildPayload = useCallback(() => {
    const v = form.getFieldsValue();
    const order = orderOptions.find(o => o.value === v.orderId);
    return {
      orderId: v.orderId, styleId: order?.styleId || ppo?.styleId, styleNo: v.styleNo,
      season: v.season, colour: v.colour, remarks: v.remarks, version: ppo?.version,
      startDate: v.startDate?.format('YYYY-MM-DD'), endDate: v.endDate?.format('YYYY-MM-DD'),
      totalOrderQty: sizeColorItems.reduce((s, i) => s + (i.orderQty || 0), 0),
      totalPlannedQty: sizeColorItems.reduce((s, i) => s + (i.plannedQty || 0), 0),
      stages: stages.map(s => ({ stageType: s.stageType, isRequired: s.isRequired, assignedType: s.assignedType, assignedName: s.assignedName, plannedStartDate: s.plannedStartDate, plannedEndDate: s.plannedEndDate })),
      sizeColorItems: sizeColorItems.map(i => ({ color: i.color, size: i.size, orderQty: i.orderQty, allowancePercent: i.allowancePercent || 0, plannedQty: i.plannedQty })),
    };
  }, [form, orderOptions, ppo, stages, sizeColorItems]);

  const handleSave = useCallback(async () => {
    try { await form.validateFields(); } catch { message.warning('Fill required fields'); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit) { await updateProductionPO(id, payload); message.success('Production PO updated'); }
      else { const res = await createProductionPO(payload); message.success(`${res.ppoNumber} created`); setHasChanges(false); clearDirty(); navigate(`/production-po/edit/${res.id}`, { replace: true }); return; }
      setHasChanges(false);
      const updated = await getProductionPOById(id);
      setPpo(updated); setSizeColorItems(updated.sizeColorItems || []); if (updated.stages) setStages(updated.stages);
    } catch { message.error('Failed to save'); } finally { setSaving(false); }
  }, [form, buildPayload, isEdit, id, navigate, setHasChanges]);

  const handleStart = useCallback(async () => {
    try { await handleSave(); await changeProductionPOStatus(id, { status: PPO_STATUS.IN_PROGRESS }); message.success('Production started'); setHasChanges(false); clearDirty(); navigate('/production-po/list'); }
    catch { message.error('Failed to start'); }
  }, [handleSave, id, navigate, clearDirty]);

  if (loading) return <div style={{ padding: 24 }}><Skeleton active paragraph={{ rows: 10 }} /></div>;

  const tabItems = [
    { key: 'general', label: 'General', children: (
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Form.Item name="orderId" label="Order" rules={[{ required: true, message: 'Select order' }]}>
          <Select showSearch filterOption={false} onSearch={handleOrderSearch} onSelect={handleOrderSelect}
            loading={orderSearching} options={orderOptions} placeholder="Search order..." disabled={!isEditable} /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item name="styleNo" label="Style No"><Input disabled /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item name="season" label="Season"><Input placeholder="e.g. SS25" disabled={!isEditable} /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item name="colour" label="Colour"><Input placeholder="Colour + shade" disabled={!isEditable} /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item name="startDate" label="Start Date"><DatePicker style={{ width: '100%' }} disabled={!isEditable} /></Form.Item></Col>
        <Col xs={24} md={8}><Form.Item name="endDate" label="End Date"><DatePicker style={{ width: '100%' }} disabled={!isEditable} /></Form.Item></Col>
        <Col xs={24}><Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} disabled={!isEditable} /></Form.Item></Col>
      </Row>
    )},
    { key: 'sizeColor', label: `Size-Color (${sizeColorItems.length})`, children: (
      <SizeColorMatrix items={sizeColorItems} onChange={u => { setSizeColorItems(u); setHasChanges(true); }} editable={isEditable} />
    )},
    { key: 'stages', label: 'Production Stages (11)', children: (
      <Table rowKey="stageType" columns={stageColumns} dataSource={stages} pagination={false} size="small" scroll={{ x: 700 }} />
    )},
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isEdit ? `Edit PPO — ${ppo?.ppoNumber || ''}` : 'New Production PO'}
        extra={<Space>{isEdit && ppo && <Tag color={getPPOStatusColor(ppo.status)}>{getPPOStatusLabel(ppo.status)}</Tag>}</Space>}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/production-po/list')}>Back</Button>
          {isEditable && <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>Save</Button>}
          {isEdit && ppo?.status === PPO_STATUS.OPEN && <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}>Start Production</Button>}
        </Space>
      </PageHeader>
      <Card>
        <Form form={form} layout="vertical" onValuesChange={() => setHasChanges(true)}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </Form>
      </Card>
    </div>
  );
};

export default ProductionPOForm;
