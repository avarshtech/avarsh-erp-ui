import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, InputNumber, DatePicker, Descriptions, Button, Statistic, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import useSewingMasters from '../../../hooks/useSewingMasters';
import { targetPerHour, totalSamOf, cmRatePerPc } from '../../../utils/sewingCalc';
import {
  getPlan, savePlan, setPlanStatus, getOrders, getSuggestedOperations,
} from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';
import OperationBreakdownGrid from './OperationBreakdownGrid';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

/**
 * PRD 4.1 — production plan with SAM targets, operation breakdown and line
 * balancing. The saved plan carries the server's own figures; the numbers shown
 * while editing are a live preview of the same rules.
 */
const SewingPlanForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [plan, setPlan] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { lines, linesByFactory } = useSewingMasters();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [record, ords] = await Promise.all([
          isEdit ? getPlan(id) : Promise.resolve(null), getOrders(),
        ]);
        setOrders(ords);
        setPlan(record || {
          orderId: ords[0]?.id, lineId: null, planDate: dayjs().format('YYYY-MM-DD'),
          startDate: dayjs().add(3, 'day').format('YYYY-MM-DD'), endDate: dayjs().add(25, 'day').format('YYYY-MM-DD'),
          totalQty: ords[0]?.orderQty, operators: 6, helpers: 2, workingHours: 8,
          targetEfficiencyPct: 60, pricePerPiece: null, otherChargesPct: 8,
          loadingDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
          settingHours: 4, status: 'DRAFT', operations: [],
        });
      } catch { message.error('Failed to load plan'); } finally { setLoading(false); }
    })();
  }, [id, isEdit, message]);

  const order = useMemo(() => orders.find((o) => o.id === plan?.orderId), [orders, plan]);
  const patch = useCallback((p) => setPlan((prev) => ({ ...prev, ...p })), []);

  // The unit is read through the chosen line, so the two selects cannot disagree.
  const unitId = useMemo(
    () => lines.find((l) => l.id === plan?.lineId)?.factoryId ?? null,
    [lines, plan?.lineId],
  );
  const unitOptions = useMemo(() => {
    const seen = new Map();
    lines.forEach((l) => seen.set(l.factoryId, l.factoryName));
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [lines]);
  const lineOptions = useMemo(
    () => linesByFactory(unitId).map((l) => ({ value: l.id, label: l.name })),
    [linesByFactory, unitId],
  );

  const totalSam = useMemo(() => totalSamOf(plan?.operations), [plan?.operations]);
  const tph = plan ? targetPerHour(plan.operators, totalSam, plan.targetEfficiencyPct) : 0;
  const cmRate = useMemo(
    () => cmRatePerPc(plan?.operations, plan?.otherChargesPct),
    [plan?.operations, plan?.otherChargesPct],
  );

  /** Pre-fills the breakdown from the style's SAM sheet rather than re-timing it. */
  const loadFromSamSheet = useCallback(async () => {
    try {
      const suggested = await getSuggestedOperations(plan.orderId);
      if (!suggested.length) return message.info('No SAM sheet is maintained for this style yet');
      patch({ operations: suggested });
      message.success(`${suggested.length} operations loaded from the SAM sheet`);
    } catch { message.error('Failed to load the SAM sheet'); }
  }, [plan?.orderId, patch, message]);

  const changeStatus = async (status, note) => {
    try {
      setPlan(await setPlanStatus(plan.id, status));
      message.success(note);
    } catch (e) { message.error(e?.response?.data?.message || 'Status change refused'); }
  };

  const handleSave = async () => {
    if (!plan.lineId) return message.warning('Select the sewing line this plan loads');
    if (!plan.operations.length) return message.warning('Add the operation breakdown before saving');
    setSaving(true);
    try {
      const saved = await savePlan(plan);
      message.success(`${saved.planNo} saved`);
      if (!isEdit) navigate(`/production/sewing/plan/${saved.id}`, { replace: true });
      else setPlan(saved);
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save plan');
    } finally { setSaving(false); }
  };

  if (loading || !plan) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={<Space><span>{plan.planNo || 'New Production Plan'}</span><SewingStatusTag status={plan.status} /></Space>}
        backPath="/production/sewing?tab=plan"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <Space>
          {plan.status === 'DRAFT' && plan.id && (
            <Button onClick={() => changeStatus('APPROVED', 'Plan approved')}>Approve</Button>
          )}
          {plan.status === 'APPROVED' && (
            <Button onClick={() => changeStatus('IN_PROGRESS', 'Line loaded — production started')}>Start Line</Button>
          )}
          <ActionButton action="save" text="Save Plan" loading={saving} onClick={handleSave} />
        </Space>
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end">
          <div style={{ minWidth: 250 }}>
            <FieldLabel>Order</FieldLabel>
            <FormSelect value={plan.orderId} style={{ width: 240 }} disabled={isEdit}
              options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
              onChange={(v) => {
                const o = orders.find((x) => x.id === v);
                patch({ orderId: v, totalQty: o?.orderQty });
              }} />
          </div>
          <div>
            <FieldLabel>Unit</FieldLabel>
            <FormSelect value={unitId} style={{ width: 200 }} placeholder="Unit"
              options={unitOptions}
              onChange={(v) => patch({ lineId: linesByFactory(v)[0]?.id ?? null })} />
          </div>
          <div>
            <FieldLabel>Sewing Line (of unit)</FieldLabel>
            <FormSelect value={plan.lineId} style={{ width: 140 }} placeholder="Line"
              options={lineOptions} onChange={(v) => patch({ lineId: v })} />
          </div>
          <div>
            <FieldLabel>Production Start</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={plan.startDate ? dayjs(plan.startDate) : null}
              onChange={(d) => patch({ startDate: d ? d.format('YYYY-MM-DD') : null })} />
          </div>
          <div>
            <FieldLabel>Production End</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={plan.endDate ? dayjs(plan.endDate) : null}
              onChange={(d) => patch({ endDate: d ? d.format('YYYY-MM-DD') : null })} />
          </div>
          <div>
            <FieldLabel>Operators</FieldLabel>
            <InputNumber min={1} value={plan.operators} onChange={(v) => patch({ operators: v || 1 })} />
          </div>
          <div>
            <FieldLabel>Helpers</FieldLabel>
            <InputNumber min={0} value={plan.helpers} onChange={(v) => patch({ helpers: v || 0 })} />
          </div>
          <div>
            <FieldLabel>Working Hours</FieldLabel>
            <InputNumber min={1} max={12} value={plan.workingHours} onChange={(v) => patch({ workingHours: v || 8 })} />
          </div>
          <div>
            <FieldLabel>Target Efficiency %</FieldLabel>
            <InputNumber min={30} max={100} value={plan.targetEfficiencyPct} onChange={(v) => patch({ targetEfficiencyPct: v || 60 })} />
          </div>
          <div>
            <FieldLabel>Price / Piece ₹</FieldLabel>
            <InputNumber min={0} step={0.5} value={plan.pricePerPiece} onChange={(v) => patch({ pricePerPiece: v })} />
          </div>
          <div>
            <FieldLabel>Other Charges %</FieldLabel>
            <InputNumber min={0} max={50} value={plan.otherChargesPct} onChange={(v) => patch({ otherChargesPct: v || 0 })} />
          </div>
          <div>
            <FieldLabel>Setting Time (hrs)</FieldLabel>
            <InputNumber min={0} max={24} value={plan.settingHours} onChange={(v) => patch({ settingHours: v })} />
          </div>
        </Space>
        {order && (
          <Descriptions size="small" column={{ xs: 1, md: 4 }} style={{ marginTop: 16 }}
            items={[
              { key: 'b', label: 'Buyer', children: order.buyer },
              { key: 'q', label: 'Order Qty', children: order.orderQty },
              { key: 'd', label: 'Delivery', children: order.deliveryDate ? dayjs(order.deliveryDate).format('DD-MMM-YYYY') : '—' },
              { key: 'c', label: 'Color', children: order.color || '—' },
            ]} />
        )}
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Garment SAM (min)" value={plan.sam ?? totalSam} precision={2} /></Card></Col>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Target / Hour" value={plan.targetPerHour ?? tph} /></Card></Col>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Target / Day" value={plan.targetPerDay ?? tph * plan.workingHours} /></Card></Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title={`CM Rate ₹/pc (Σ rates + ${plan.otherChargesPct || 0}% other charges)`}
              value={plan.cmRatePerPc ?? cmRate} precision={2} prefix="₹" />
          </Card>
        </Col>
      </Row>

      <OperationBreakdownGrid plan={plan} onChange={setPlan} onLoadSamSheet={loadFromSamSheet} />
    </div>
  );
};

export default SewingPlanForm;
