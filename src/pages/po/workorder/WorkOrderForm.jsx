import { useState, useEffect, useCallback } from 'react';
import { App, Card, Form, Tabs, Col, Input, InputNumber, Button, Tag, Space, Typography, Spin, Alert } from 'antd';
import dayjs from 'dayjs';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect, FormDatePicker, FormInputNumber, FormSection } from '../../../components/form';
import { numericInputProps } from '../../../utils/inputHelpers';
import useBusyAction from '../../../hooks/useBusyAction';
import SizeColorMatrix from '../SizeColorMatrix';
import ProcessingUnitSelector from '../components/ProcessingUnitSelector';
import ConsumptionComparisonPanel from '../components/ConsumptionComparisonPanel';
import MaterialStockPanel from '../components/MaterialStockPanel';
import PpSampleGate from '../components/PpSampleGate';
import OrderCoveragePanel from '../components/OrderCoveragePanel';
import { PROCESSING_UNIT_TYPE, PO_TYPE, PO_ACTION, computeVariancePercent, VARIANCE_THRESHOLD, isPpApproved } from '../../../utils/productionConstants';
import {
  getConfirmedOrders, getOrderForPo, getConsumptionComparison, getStockByBom,
  getPpApprovalStatus, setPpApprovalStatus, getSewingLines,
} from '../../../services/po/production/productionLookupService';
import { getApprovedCuttingPos } from '../../../services/po/production/cuttingPoService';
import {
  getWorkOrder, createWorkOrder, updateWorkOrder, changeWorkOrderStatus, getWorkOrderCoverage,
} from '../../../services/po/production/workOrderService';

const { Text } = Typography;
const sum = (arr, f) => arr.reduce((s, i) => s + (i[f] || 0), 0);

// Trim Allocated defaults to BOM requirement and is editable on the Work Order trim panel.
const normTrimStock = (rows) => rows.map((r) => ({
  ...r, allocated: r.bomRequired, availableBalance: r.currentStock - r.bomRequired, shortageSurplus: r.currentStock - r.bomRequired,
}));

const WorkOrderForm = () => {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [form] = Form.useForm();
  const unitType = Form.useWatch('processingUnitType', form);

  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [cuttingPos, setCuttingPos] = useState([]);
  const [cuttingPo, setCuttingPo] = useState(null);
  const [items, setItems] = useState([]);
  const [consumption, setConsumption] = useState([]);
  const [justification, setJustification] = useState('');
  const [stock, setStock] = useState([]);
  const [ppStatus, setPpStatus] = useState(null);
  const [lines, setLines] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [allowanceWarn, setAllowanceWarn] = useState(null);
  const [hasShortage, setHasShortage] = useState(false);
  const [bulkRate, setBulkRate] = useState(null);
  const [booting, setBooting] = useState(isEdit);
  // 'draft' | 'submit' | null — each header button spins only for its own action
  const { setBusy, busyProps } = useBusyAction();

  useEffect(() => { getConfirmedOrders().then(setOrders); getSewingLines().then(setLines); }, []);

  const hydrateOrder = useCallback(async (orderId) => {
    const [o, pp, cps] = await Promise.all([getOrderForPo(orderId), getPpApprovalStatus(orderId), getApprovedCuttingPos(orderId)]);
    setOrder(o); setPpStatus(pp); setCuttingPos(cps);
    setStock(normTrimStock(await getStockByBom(o, 'trim')));
    return o;
  }, []);

  const applyCuttingPo = useCallback(async (cp, o) => {
    setCuttingPo(cp);
    setConsumption(await getConsumptionComparison(o, cp.cadConsumptionPerPc, cp.totalPlannedQty));
    setItems((cp.items || o.items || []).map((i) => ({ ...i, ratePerPiece: 0 })));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    getWorkOrder(id).then(async (wo) => {
      if (!wo) { message.error('Work Order not found'); return navigate('/purchase-orders/work-order/list'); }
      const o = await hydrateOrder(wo.orderId);
      getWorkOrderCoverage(wo.orderId, id).then(setCoverage);
      if (o && wo.allowancePercent != null && o.allowancePercent !== wo.allowancePercent) {
        setAllowanceWarn({ stored: wo.allowancePercent, live: o.allowancePercent });
      }
      const cp = (await getApprovedCuttingPos(wo.orderId)).find((c) => c.id === wo.cuttingPoId) || { id: wo.cuttingPoId, cuttingPoNo: wo.cuttingPoNo, cadConsumptionPerPc: wo.cadConsumptionPerPc, items: wo.items };
      setCuttingPo(cp);
      setConsumption(await getConsumptionComparison(o, wo.cadConsumptionPerPc, wo.totalPlannedQty));
      setItems(wo.items || []);
      form.setFieldsValue({
        orderId: wo.orderId, cuttingPoId: wo.cuttingPoId,
        plannedStartDate: wo.plannedStartDate ? dayjs(wo.plannedStartDate) : null,
        plannedEndDate: wo.plannedEndDate ? dayjs(wo.plannedEndDate) : null,
        plannedDeliveryDate: wo.plannedDeliveryDate ? dayjs(wo.plannedDeliveryDate) : null,
        processingUnitType: wo.processingUnitType, processingUnitId: wo.processingUnitId, processingUnitName: wo.processingUnitName,
        sewingLineId: wo.sewingLineId, samMinutes: wo.samMinutes, targetDailyOutput: wo.targetDailyOutput, remarks: wo.remarks,
      });
    }).finally(() => setBooting(false));
  }, [id, isEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOrderSelect = async (orderId) => {
    form.setFieldValue('cuttingPoId', undefined); setCuttingPo(null); setItems([]); setConsumption([]);
    setAllowanceWarn(null);
    await hydrateOrder(orderId);
    getWorkOrderCoverage(orderId).then(setCoverage);
  };

  const handleCuttingPoSelect = async (cpId) => {
    const cp = cuttingPos.find((c) => c.id === cpId);
    if (cp && order) await applyCuttingPo(cp, order);
  };

  const applyBulkRate = () => {
    if (bulkRate == null) return message.warning('Enter a rate to apply');
    setItems(items.map((i) => ({ ...i, ratePerPiece: bulkRate })));
  };

  // Editing Planned Qty re-derives the BOM-based requirement in the consumption totals
  // and the trim stock panel (requirement per garment = BOM consumption).
  const onItemsChange = (newItems) => {
    setItems(newItems);
    const total = sum(newItems, 'plannedQty');
    setConsumption((cons) => cons.map((r) => ({ ...r, plannedQty: total })));
    if (order) getStockByBom(order, 'trim', { plannedQty: total }).then((s) => setStock(normTrimStock(s)));
  };

  const thisPoQty = sum(items, 'plannedQty');
  const overAuth = coverage && (coverage.authorizedQty + thisPoQty) > coverage.orderQty;
  const redVariance = consumption.some((r) => Math.abs(computeVariancePercent(r.cadPerPc, r.bomPerPc)) > VARIANCE_THRESHOLD.YELLOW);

  const confirmWarnings = () => {
    const reasons = [];
    if (hasShortage) reasons.push('trim/accessory shortage');
    if (overAuth) reasons.push('quantity over the order qty');
    if (redVariance) reasons.push('consumption variance > 5%');
    if (!reasons.length) return Promise.resolve(true);
    return new Promise((res) => modal.confirm({
      title: 'Submit despite warnings?',
      content: `This Work Order has: ${reasons.join(', ')}. Submit for approval anyway?`,
      okText: 'Submit anyway', cancelText: 'Review',
      onOk: () => res(true), onCancel: () => res(false),
    }));
  };

  const buildPayload = (values) => ({
    orderId: order.id, orderNo: order.orderNo, styleId: order.styleId, styleNo: order.styleNo,
    buyer: order.buyer, bomId: order.bomId, bomNo: order.bomNo,
    cuttingPoId: cuttingPo?.id, cuttingPoNo: cuttingPo?.cuttingPoNo,
    processingUnitType: values.processingUnitType, processingUnitId: values.processingUnitId, processingUnitName: values.processingUnitName,
    sewingLineId: values.sewingLineId, samMinutes: values.samMinutes, targetDailyOutput: values.targetDailyOutput,
    plannedStartDate: values.plannedStartDate?.format('YYYY-MM-DD'), plannedEndDate: values.plannedEndDate?.format('YYYY-MM-DD'),
    plannedDeliveryDate: values.plannedDeliveryDate?.format('YYYY-MM-DD'),
    totalOrderQty: sum(items, 'orderQty'), allowancePercent: order.allowancePercent, totalPlannedQty: sum(items, 'plannedQty'),
    bomConsumptionPerPc: consumption[0]?.bomPerPc, cadConsumptionPerPc: consumption[0]?.cadPerPc,
    consumptionVariance: +computeVariancePercent(consumption[0]?.cadPerPc, consumption[0]?.bomPerPc).toFixed(2),
    garmentProcesses: order.garmentProcesses || [],
    consumptionOverrideNote: justification || null, items, remarks: values.remarks,
  });

  const save = async (submit) => {
    let values;
    try { values = await form.validateFields(); }
    catch { return message.warning('Please complete the required fields in General'); }
    if (!cuttingPo) return message.warning('Select an approved Cutting PO');
    if (!items.length || items.some((i) => !i.ratePerPiece || i.ratePerPiece <= 0)) {
      return message.warning('Enter a rate/price for every size-color row before saving');
    }
    if (submit && !(await confirmWarnings())) return;
    setBusy(submit ? 'submit' : 'draft');
    try {
      const payload = buildPayload(values);
      const saved = isEdit ? await updateWorkOrder(id, payload) : await createWorkOrder(payload);
      if (submit) await changeWorkOrderStatus(saved.id, PO_ACTION.SUBMIT, {});
      message.success(`${saved.workOrderNo} ${submit ? 'submitted' : 'saved'}`);
      navigate('/purchase-orders/work-order/list');
    } catch (e) {
      message.error(e.message || 'Save failed');
    } finally { setBusy(null); }
  };

  if (booting) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;
  const ppApproved = isPpApproved(ppStatus);
  const isVendor = unitType === PROCESSING_UNIT_TYPE.VENDOR;

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
        <FormSection title="Order & Cutting PO" columns={2}>
          <Form.Item name="orderId" label="Confirmed Order" rules={[{ required: true, message: 'Select an order' }]}>
            <FormSelect placeholder="Select order" disabled={isEdit} onChange={handleOrderSelect}
              options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo} · ${o.buyer}` }))} />
          </Form.Item>
          <Form.Item name="cuttingPoId" label="Approved Cutting PO" rules={[{ required: true, message: 'Select a Cutting PO' }]}>
            <FormSelect placeholder="Select approved cutting PO" disabled={isEdit || !order} onChange={handleCuttingPoSelect}
              options={cuttingPos.map((c) => ({ value: c.id, label: c.cuttingPoNo }))} />
          </Form.Item>
        </FormSection>
        {order?.garmentProcesses?.length > 0 && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="This garment requires additional process(es)"
            description={
              <Space wrap style={{ marginTop: 4 }}>
                {order.garmentProcesses.map((p) => <Tag key={p} color="purple">{p}</Tag>)}
                <Text type="secondary">— plan sewing output & hand-off accordingly.</Text>
              </Space>
            }
          />
        )}
        {allowanceWarn && (
          <Alert type="warning" showIcon style={{ marginBottom: 16 }}
            message={`Order allowance changed from ${allowanceWarn.stored}% to ${allowanceWarn.live}% since this PO was raised — review planned quantities.`} />
        )}
        {coverage && (
          <OrderCoveragePanel orderQty={coverage.orderQty} authorizedQty={coverage.authorizedQty}
            thisPoQty={thisPoQty} poNumbers={coverage.poNumbers} />
        )}
        <FormSection title="Schedule" columns={3}>
          <Form.Item name="plannedStartDate" label="Planned Start" rules={[{ required: true, message: 'Required' }]}><FormDatePicker /></Form.Item>
          <Form.Item name="plannedEndDate" label="Planned End" rules={[{ required: true, message: 'Required' }]}>
            <FormDatePicker disabledDate={(d) => { const s = form.getFieldValue('plannedStartDate'); return d && s && d.isBefore(s, 'day'); }} />
          </Form.Item>
        </FormSection>
        <FormSection title="Processing Unit">
          <Col span={24}><ProcessingUnitSelector poType={PO_TYPE.WORK_ORDER} /></Col>
        </FormSection>
        <FormSection title={`Sewing Details${isVendor ? ' (optional for vendor)' : ''}`} columns={3}>
          <Form.Item name="sewingLineId" label="Sewing Line"><FormSelect placeholder="Select line" options={lines} allowClear /></Form.Item>
          <Form.Item name="samMinutes" label="SAM (mins)"><FormInputNumber /></Form.Item>
          <Form.Item name="targetDailyOutput" label="Target / Day"><FormInputNumber variant="quantity" uom="pcs" /></Form.Item>
        </FormSection>
        <FormSection title="Other" columns={1}>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={1} maxLength={300} /></Form.Item>
        </FormSection>
      </>
    ) },
    { key: 'matrix', label: 'Size-Color Matrix', disabled: !cuttingPo, children: (
      <>
        <Space style={{ marginBottom: 12 }} wrap>
          <Text type="secondary">Set same rate for all rows:</Text>
          <InputNumber min={0} precision={2} value={bulkRate} onChange={setBulkRate} placeholder="Rate / Pc" style={{ width: 140 }} {...numericInputProps} />
          <Button onClick={applyBulkRate}>Apply to all</Button>
        </Space>
        <SizeColorMatrix items={items} onChange={onItemsChange} editable allowanceEditable={false} plannedQtyEditable />
      </>
    ) },
    { key: 'consumption', label: 'Consumption', disabled: !cuttingPo, children: (
      <ConsumptionComparisonPanel rows={consumption} mode="inherited" onChange={setConsumption}
        justification={justification} onJustificationChange={setJustification} />
    ) },
    { key: 'stock', label: 'Trim Stock', disabled: !order, children: (
      <MaterialStockPanel rows={stock} materialType="trim" allocatedEditable onChange={setStock} onShortageChange={setHasShortage} />
    ) },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title={isEdit ? 'Edit Work Order' : 'New Work Order'} backPath="/purchase-orders/work-order/list">
        <ActionButton action="save" variant="draft" text="Save Draft" {...busyProps('draft', !cuttingPo)} onClick={() => save(false)} />
        <ActionButton action="send" text="Save & Submit" {...busyProps('submit', !cuttingPo || !ppApproved)}
          tooltip={!ppApproved ? 'PP Sample not yet approved for this order' : undefined} onClick={() => save(true)} />
      </PageHeader>
      <Card><Form form={form} layout="vertical"><Tabs items={tabs} /></Form></Card>
    </div>
  );
};

export default WorkOrderForm;
