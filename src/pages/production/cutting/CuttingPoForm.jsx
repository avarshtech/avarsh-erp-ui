import { useState, useEffect, useCallback } from 'react';
import { App, Card, Form, Tabs, Col, Input, Typography, Space, Spin, Alert } from 'antd';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect, FormDatePicker, FormInputNumber, FormSection } from '../../../components/form';
import SizeColorMatrix from '../../po/SizeColorMatrix';
import ProcessingUnitSelector from '../components/ProcessingUnitSelector';
import ConsumptionComparisonPanel from '../components/ConsumptionComparisonPanel';
import MaterialStockPanel from '../components/MaterialStockPanel';
import MarkerUploadCard from '../components/MarkerUploadCard';
import PpSampleGate from '../components/PpSampleGate';
import OrderCoveragePanel from '../components/OrderCoveragePanel';
import { PO_TYPE, PO_ACTION, isPpApproved, computeVariancePercent, VARIANCE_THRESHOLD } from '../../../utils/productionConstants';
import {
  getConfirmedOrders, getOrderForPo, getConsumptionComparison, getStockByBom, getPpApprovalStatus,
  getCuttingPo, createCuttingPo, updateCuttingPo, changeCuttingPoStatus, getOrderCoverage,
} from '../../../services/production/productionService';

const { Text } = Typography;
const sum = (arr, f) => arr.reduce((s, i) => s + (i[f] || 0), 0);

const CuttingPoForm = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();

  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [consumption, setConsumption] = useState([]);
  const [stock, setStock] = useState([]);
  const [ppStatus, setPpStatus] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [allowanceWarn, setAllowanceWarn] = useState(null);
  const [hasShortage, setHasShortage] = useState(false);
  const [booting, setBooting] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getConfirmedOrders().then(setOrders); }, []);

  const hydrateFromOrder = useCallback(async (orderId, cadPerPc) => {
    const [o, cons, pp] = await Promise.all([
      getOrderForPo(orderId), getConsumptionComparison(orderId, cadPerPc), getPpApprovalStatus(orderId),
    ]);
    setOrder(o); setConsumption(cons); setPpStatus(pp);
    setStock(await getStockByBom(orderId, 'fabric', { cadPerPc: cons[0]?.cadPerPc }));
    return o;
  }, []);

  // Edit: load existing PO
  useEffect(() => {
    if (!isEdit) return;
    getCuttingPo(id).then(async (po) => {
      if (!po) { message.error('Cutting PO not found'); return navigate('/production/cutting-po/list'); }
      const o = await hydrateFromOrder(po.orderId, po.cadConsumptionPerPc);
      setItems(po.items || []);
      getOrderCoverage(PO_TYPE.CUTTING, po.orderId, id).then(setCoverage);
      if (o && po.allowancePercent != null && o.allowancePercent !== po.allowancePercent) {
        setAllowanceWarn({ stored: po.allowancePercent, live: o.allowancePercent });
      }
      form.setFieldsValue({
        orderId: po.orderId, plannedCutDate: po.plannedCutDate ? dayjs(po.plannedCutDate) : null,
        plannedDeliveryDate: po.plannedDeliveryDate ? dayjs(po.plannedDeliveryDate) : null,
        processingUnitType: po.processingUnitType, processingUnitId: po.processingUnitId, processingUnitName: po.processingUnitName,
        fabricWastagePercent: po.fabricWastagePercent, markerFileUrl: po.markerFileUrl, markerEfficiency: po.markerEfficiency, remarks: po.remarks,
      });
    }).finally(() => setBooting(false));
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOrderSelect = async (orderId) => {
    const o = await hydrateFromOrder(orderId);
    setItems((o.items || []).map((i) => ({ ...i, ratePerPiece: 0 })));
    setAllowanceWarn(null);
    getOrderCoverage(PO_TYPE.CUTTING, orderId).then(setCoverage);
  };

  const thisPoQty = sum(items, 'plannedQty');
  const overAuth = coverage && (coverage.authorizedQty + thisPoQty) > coverage.orderQty;
  const redVariance = consumption.some((r) => Math.abs(computeVariancePercent(r.cadPerPc, r.bomPerPc)) > VARIANCE_THRESHOLD.YELLOW);

  const confirmWarnings = () => {
    const reasons = [];
    if (hasShortage) reasons.push('fabric shortage');
    if (overAuth) reasons.push('quantity over the order qty');
    if (redVariance) reasons.push('consumption variance > 5%');
    if (!reasons.length) return Promise.resolve(true);
    return new Promise((res) => modal.confirm({
      title: 'Submit despite warnings?',
      content: `This PO has: ${reasons.join(', ')}. Submit for approval anyway?`,
      okText: 'Submit anyway', cancelText: 'Review',
      onOk: () => res(true), onCancel: () => res(false),
    }));
  };

  const refreshStock = (rows) => {
    setConsumption(rows);
    if (order) getStockByBom(order.id, 'fabric', { cadPerPc: rows[0]?.cadPerPc }).then(setStock);
  };

  const buildPayload = (values) => ({
    orderId: order.id, orderNo: order.orderNo, styleId: order.styleId, styleNo: order.styleNo,
    buyer: order.buyer, bomId: order.bomId, bomNo: order.bomNo,
    processingUnitType: values.processingUnitType, processingUnitId: values.processingUnitId, processingUnitName: values.processingUnitName,
    plannedCutDate: values.plannedCutDate?.format('YYYY-MM-DD'), plannedDeliveryDate: values.plannedDeliveryDate?.format('YYYY-MM-DD'),
    totalOrderQty: sum(items, 'orderQty'), allowancePercent: order.allowancePercent, totalPlannedQty: sum(items, 'plannedQty'),
    bomConsumptionPerPc: consumption[0]?.bomPerPc, cadConsumptionPerPc: consumption[0]?.cadPerPc,
    fabricWastagePercent: values.fabricWastagePercent, markerFileUrl: values.markerFileUrl, markerEfficiency: values.markerEfficiency,
    items, remarks: values.remarks,
  });

  const save = async (submit) => {
    let values;
    try { values = await form.validateFields(); }
    catch { return message.warning('Please complete the required fields in General'); }
    if (submit && !(await confirmWarnings())) return;
    setSaving(true);
    try {
      const payload = buildPayload(values);
      const saved = isEdit ? await updateCuttingPo(id, payload) : await createCuttingPo(payload);
      if (submit) await changeCuttingPoStatus(saved.id, PO_ACTION.SUBMIT, {});
      message.success(`${saved.cuttingPoNo} ${submit ? 'submitted' : 'saved'}`);
      navigate('/production/cutting-po/list');
    } catch (e) {
      message.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (booting) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;
  const ppApproved = isPpApproved(ppStatus);

  const tabs = [
    { key: 'general', label: 'General', children: (
      <>
        {ppStatus && <PpSampleGate status={ppStatus} />}
        <FormSection title="Order & Style" columns={2}>
          <Form.Item name="orderId" label="Confirmed Order" rules={[{ required: true, message: 'Select an order' }]}>
            <FormSelect placeholder="Select a confirmed order" disabled={isEdit} onChange={handleOrderSelect}
              options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo} · ${o.buyer}` }))} />
          </Form.Item>
          <Form.Item label="Planned Cut Date" name="plannedCutDate" rules={[{ required: true, message: 'Select cut date' }]}>
            <FormDatePicker />
          </Form.Item>
        </FormSection>
        {order && (
          <Space size="large" wrap style={{ margin: '8px 0 16px' }}>
            <Text type="secondary">Style: <Text strong>{order.styleNo}</Text></Text>
            <Text type="secondary">Buyer: <Text strong>{order.buyer}</Text></Text>
            <Text type="secondary">BOM: <Text strong>{order.bomNo}</Text></Text>
            <Text type="secondary">Allowance: <Text strong>{order.allowancePercent}%</Text></Text>
          </Space>
        )}
        {allowanceWarn && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }}
            message={`Order allowance changed from ${allowanceWarn.stored}% to ${allowanceWarn.live}% since this PO was raised — review planned quantities.`} />
        )}
        {coverage && (
          <OrderCoveragePanel orderQty={coverage.orderQty} authorizedQty={coverage.authorizedQty}
            thisPoQty={thisPoQty} poNumbers={coverage.poNumbers} />
        )}
        <FormSection title="Processing Unit">
          <Col span={24}><ProcessingUnitSelector poType={PO_TYPE.CUTTING} /></Col>
        </FormSection>
        <FormSection title="Other" columns={2}>
          <Form.Item name="fabricWastagePercent" label="Fabric Wastage %" initialValue={4}><FormInputNumber variant="percentage" /></Form.Item>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={1} maxLength={300} /></Form.Item>
        </FormSection>
      </>
    ) },
    { key: 'matrix', label: 'Size-Color Matrix', disabled: !order, children: (
      <SizeColorMatrix items={items} onChange={setItems} editable allowanceEditable={false} />
    ) },
    { key: 'consumption', label: 'Consumption & Marker', disabled: !order, children: (
      <>
        <Card size="small" style={{ marginBottom: 16 }}><MarkerUploadCard /></Card>
        <ConsumptionComparisonPanel rows={consumption} mode="editable" onChange={refreshStock} />
      </>
    ) },
    { key: 'stock', label: 'Fabric Stock', disabled: !order, children: (
      <MaterialStockPanel rows={stock} materialType="fabric" onShortageChange={setHasShortage} />
    ) },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isEdit ? 'Edit Cutting PO' : 'New Cutting PO'} backPath="/production/cutting-po/list">
        <ActionButton action="save" variant="draft" text="Save Draft" loading={saving} onClick={() => save(false)} disabled={!order} />
        <ActionButton action="send" text="Save & Submit" loading={saving} disabled={!order || !ppApproved}
          tooltip={!ppApproved ? 'PP Sample not yet approved for this order' : undefined} onClick={() => save(true)} />
      </PageHeader>
      <Card><Form form={form} layout="vertical"><Tabs items={tabs} /></Form></Card>
    </div>
  );
};

export default CuttingPoForm;
