import { useState, useEffect, useCallback } from 'react';
import { App, Card, Form, Tabs, Col, Input, InputNumber, Button, Typography, Space, Spin, Alert } from 'antd';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect, FormDatePicker, FormSection } from '../../../components/form';
import { numericInputProps } from '../../../utils/inputHelpers';
import SizeColorMatrix from '../SizeColorMatrix';
import ProcessingUnitSelector from '../components/ProcessingUnitSelector';
import ConsumptionComparisonPanel from '../components/ConsumptionComparisonPanel';
import MaterialStockPanel from '../components/MaterialStockPanel';
import MarkerUploadCard from '../components/MarkerUploadCard';
import PpSampleGate from '../components/PpSampleGate';
import { PO_TYPE, PO_ACTION, isPpApproved, computeVariancePercent, VARIANCE_THRESHOLD } from '../../../utils/productionConstants';
import {
  getConfirmedOrders, getOrderForPo, getConsumptionComparison, getStockByBom, getPpApprovalStatus, setPpApprovalStatus,
} from '../../../services/po/production/productionLookupService';
import {
  getCuttingPo, createCuttingPo, updateCuttingPo, changeCuttingPoStatus, getCuttingPoCoverage,
} from '../../../services/po/production/cuttingPoService';

const { Text } = Typography;
const sum = (arr, f) => arr.reduce((s, i) => s + (i[f] || 0), 0);

// Allocated defaults to CAD requirement and is editable on the Cutting PO fabric panel.
const normFabricStock = (rows) => rows.map((r) => ({
  ...r, allocated: r.cadRequired, availableBalance: r.currentStock - r.cadRequired, shortageSurplus: r.currentStock - r.cadRequired,
}));

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
  const [bulkRate, setBulkRate] = useState(null);
  const [booting, setBooting] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getConfirmedOrders().then(setOrders); }, []);

  const hydrateFromOrder = useCallback(async (orderId, cadPerPc) => {
    const [o, pp] = await Promise.all([getOrderForPo(orderId), getPpApprovalStatus(orderId)]);
    const cons = await getConsumptionComparison(o, cadPerPc);
    setOrder(o); setConsumption(cons); setPpStatus(pp);
    setStock(normFabricStock(await getStockByBom(o, 'fabric', { cadPerPc: cons[0]?.cadPerPc })));
    return o;
  }, []);

  // Edit: load existing PO
  useEffect(() => {
    if (!isEdit) return;
    getCuttingPo(id).then(async (po) => {
      if (!po) { message.error('Cutting PO not found'); return navigate('/purchase-orders/cutting-po/list'); }
      const o = await hydrateFromOrder(po.orderId, po.cadConsumptionPerPc);
      setItems(po.items || []);
      getCuttingPoCoverage(po.orderId, id).then(setCoverage);
      if (o && po.allowancePercent != null && o.allowancePercent !== po.allowancePercent) {
        setAllowanceWarn({ stored: po.allowancePercent, live: o.allowancePercent });
      }
      form.setFieldsValue({
        orderId: po.orderId, plannedCutDate: po.plannedCutDate ? dayjs(po.plannedCutDate) : null,
        plannedDeliveryDate: po.plannedDeliveryDate ? dayjs(po.plannedDeliveryDate) : null,
        processingUnitType: po.processingUnitType, processingUnitId: po.processingUnitId, processingUnitName: po.processingUnitName,
        markerFileUrl: po.markerFileUrl, markerEfficiency: po.markerEfficiency, remarks: po.remarks,
      });
    }).finally(() => setBooting(false));
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOrderSelect = async (orderId) => {
    const o = await hydrateFromOrder(orderId);
    setItems((o.items || []).map((i) => ({ ...i, ratePerPiece: 0 })));
    setAllowanceWarn(null);
    getCuttingPoCoverage(orderId).then(setCoverage);
  };

  // Allowance % is editable on the PO (decision ②) — default comes from the
  // order's BOM items; changing it recomputes every row's planned qty.
  const applyAllowance = (pct) => {
    const val = pct == null ? 0 : pct;
    setOrder((o) => ({ ...o, allowancePercent: val }));
    setItems((rows) => rows.map((i) => ({
      ...i, allowancePercent: val,
      plannedQty: Math.ceil((i.orderQty || 0) * (1 + val / 100)),
    })));
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
    if (order) getStockByBom(order, 'fabric', { cadPerPc: rows[0]?.cadPerPc, plannedQty: sum(items, 'plannedQty') }).then((s) => setStock(normFabricStock(s)));
  };

  // Editing Planned Qty re-derives the BOM-based requirement (per-garment from BOM × planned qty)
  // in the consumption totals and the fabric stock panel.
  const onItemsChange = (newItems) => {
    setItems(newItems);
    const total = sum(newItems, 'plannedQty');
    setConsumption((cons) => cons.map((r) => ({ ...r, plannedQty: total })));
    if (order) getStockByBom(order, 'fabric', { cadPerPc: consumption[0]?.cadPerPc, plannedQty: total }).then((s) => setStock(normFabricStock(s)));
  };

  const applyBulkRate = () => {
    if (bulkRate == null) return message.warning('Enter a rate to apply');
    setItems(items.map((i) => ({ ...i, ratePerPiece: bulkRate })));
  };

  const buildPayload = (values) => ({
    orderId: order.id, orderNo: order.orderNo, styleId: order.styleId, styleNo: order.styleNo,
    buyer: order.buyer, bomId: order.bomId, bomNo: order.bomNo,
    processingUnitType: values.processingUnitType, processingUnitId: values.processingUnitId, processingUnitName: values.processingUnitName,
    plannedCutDate: values.plannedCutDate?.format('YYYY-MM-DD'), plannedDeliveryDate: values.plannedDeliveryDate?.format('YYYY-MM-DD'),
    totalOrderQty: sum(items, 'orderQty'), allowancePercent: order.allowancePercent, totalPlannedQty: sum(items, 'plannedQty'),
    bomConsumptionPerPc: consumption[0]?.bomPerPc, cadConsumptionPerPc: consumption[0]?.cadPerPc,
    markerFileUrl: values.markerFileUrl, markerEfficiency: values.markerEfficiency,
    items, remarks: values.remarks,
  });

  const save = async (submit) => {
    let values;
    try { values = await form.validateFields(); }
    catch { return message.warning('Please complete the required fields in General'); }
    if (!items.length || items.some((i) => !i.ratePerPiece || i.ratePerPiece <= 0)) {
      return message.warning('Enter a rate/price for every size-color row before saving');
    }
    if (submit && !(await confirmWarnings())) return;
    setSaving(true);
    try {
      const payload = buildPayload(values);
      const saved = isEdit ? await updateCuttingPo(id, payload) : await createCuttingPo(payload);
      if (submit) await changeCuttingPoStatus(saved.id, PO_ACTION.SUBMIT, {});
      message.success(`${saved.cuttingPoNo} ${submit ? 'submitted' : 'saved'}`);
      navigate('/purchase-orders/cutting-po/list');
    } catch (e) {
      message.error(e.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (booting) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;
  const ppApproved = isPpApproved(ppStatus);

  const tabs = [
    { key: 'general', label: 'General', children: (
      <>
        {ppStatus && (
          <PpSampleGate
            status={ppStatus}
            onMarkApproved={order ? async () => {
              const next = await setPpApprovalStatus(order.id, 'COMPLETED');
              setPpStatus(next);
              message.success('PP Sample marked approved for this order');
            } : undefined}
          />
        )}
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
            <Text type="secondary">
              Allowance:{' '}
              <InputNumber size="small" min={0} max={50} value={order.allowancePercent}
                onChange={applyAllowance} style={{ width: 80 }} addonAfter="%" {...numericInputProps} />
            </Text>
          </Space>
        )}
        {allowanceWarn && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }}
            message={`Order allowance changed from ${allowanceWarn.stored}% to ${allowanceWarn.live}% since this PO was raised — review planned quantities.`} />
        )}
        <FormSection title="Processing Unit">
          <Col span={24}><ProcessingUnitSelector poType={PO_TYPE.CUTTING} /></Col>
        </FormSection>
        <FormSection title="Other" columns={1}>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} maxLength={300} /></Form.Item>
        </FormSection>
      </>
    ) },
    { key: 'matrix', label: 'Size-Color Matrix', disabled: !order, children: (
      <>
        <Space style={{ marginBottom: 12 }} wrap>
          <Text type="secondary">Set same rate for all rows:</Text>
          <InputNumber min={0} precision={2} value={bulkRate} onChange={setBulkRate} placeholder="Rate / Pc" style={{ width: 140 }} {...numericInputProps} />
          <Button onClick={applyBulkRate}>Apply to all</Button>
        </Space>
        <SizeColorMatrix items={items} onChange={onItemsChange} editable allowanceEditable={false} plannedQtyEditable />
      </>
    ) },
    { key: 'consumption', label: 'Consumption & Marker', disabled: !order, children: (
      <>
        <Card size="small" style={{ marginBottom: 16 }}><MarkerUploadCard /></Card>
        <ConsumptionComparisonPanel rows={consumption} mode="editable" onChange={refreshStock} />
      </>
    ) },
    { key: 'stock', label: 'Fabric Stock', disabled: !order, children: (
      <MaterialStockPanel rows={stock} materialType="fabric" allocatedEditable onChange={setStock} onShortageChange={setHasShortage} />
    ) },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isEdit ? 'Edit Cutting PO' : 'New Cutting PO'} backPath="/purchase-orders/cutting-po/list">
        <ActionButton action="save" variant="draft" text="Save Draft" loading={saving} onClick={() => save(false)} disabled={!order} />
        <ActionButton action="send" text="Save & Submit" loading={saving} disabled={!order || !ppApproved}
          tooltip={!ppApproved ? 'PP Sample not yet approved for this order' : undefined} onClick={() => save(true)} />
      </PageHeader>
      <Card><Form form={form} layout="vertical"><Tabs items={tabs} /></Form></Card>
    </div>
  );
};

export default CuttingPoForm;
