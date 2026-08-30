import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, InputNumber, DatePicker, Descriptions, Button, Statistic, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { UNITS, LINES_BY_UNIT } from '../../../utils/sewingConstants';
import { getPlan, savePlan, setPlanStatus, getOrders, targetPerHour } from '../../../services/production/sewingService';
import SewingStatusTag from './SewingStatusTag';
import OperationBreakdownGrid from './OperationBreakdownGrid';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

/** PRD 4.1 — production plan with SAM targets, operation breakdown and line balancing. */
const SewingPlanForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [plan, setPlan] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [record, ords] = await Promise.all([
          isEdit ? getPlan(id) : Promise.resolve(null), getOrders(),
        ]);
        setOrders(ords);
        setPlan(record || {
          orderId: ords[0]?.id, unit: UNITS[0], line: LINES_BY_UNIT[UNITS[0]][0], planDate: dayjs().format('YYYY-MM-DD'),
          startDate: dayjs().add(3, 'day').format('YYYY-MM-DD'), endDate: dayjs().add(25, 'day').format('YYYY-MM-DD'),
          totalQty: ords[0]?.orderQty, sam: null, operators: 6, helpers: 2, workingHours: 8,
          targetEfficiencyPct: 60, pricePerPiece: ords[0]?.cmRate, otherChargesPct: 8,
          loadingDate: dayjs().add(3, 'day').format('YYYY-MM-DD'),
          settingHours: 4, status: 'DRAFT', operations: [],
        });
      } catch { message.error('Failed to load plan'); } finally { setLoading(false); }
    })();
  }, [id, isEdit, message]);

  const order = useMemo(() => orders.find((o) => o.id === plan?.orderId), [orders, plan]);
  const patch = useCallback((p) => setPlan((prev) => ({ ...prev, ...p })), []);
  const totalSam = useMemo(() => (plan ? Math.round(plan.operations.reduce((s, o) => s + (o.sam || 0), 0) * 100) / 100 : 0), [plan]);
  const tph = plan ? targetPerHour(plan.operators, plan.sam || totalSam || 1, plan.targetEfficiencyPct) : 0;
  /** CM Rate/Pc = Σ operation rates × (1 + other charges %). */
  const cmRatePerPc = useMemo(() => {
    if (!plan) return 0;
    const rateSum = plan.operations.reduce((s, o) => s + (o.rate || 0), 0);
    return Math.round(rateSum * (1 + (plan.otherChargesPct || 0) / 100) * 100) / 100;
  }, [plan]);

  const handleSave = async () => {
    if (!plan.operations.length) return message.warning('Add the operation breakdown before saving');
    setSaving(true);
    try {
      const saved = await savePlan({ ...plan, sam: plan.sam || totalSam });
      message.success(`${saved.planNo} saved`);
      if (!isEdit) navigate(`/production/sewing/plan/${saved.id}`, { replace: true });
      else setPlan(saved);
    } catch { message.error('Failed to save plan'); } finally { setSaving(false); }
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
            <Button onClick={async () => { setPlan(await setPlanStatus(plan.id, 'APPROVED')); message.success('Plan approved'); }}>Approve</Button>
          )}
          {plan.status === 'APPROVED' && (
            <Button onClick={async () => { setPlan(await setPlanStatus(plan.id, 'IN_PROGRESS')); message.success('Line loaded — production started'); }}>Start Line</Button>
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
                patch({ orderId: v, totalQty: o?.orderQty, pricePerPiece: o?.cmRate });
              }} />
          </div>
          <div>
            <FieldLabel>Unit</FieldLabel>
            <FormSelect value={plan.unit} style={{ width: 160 }}
              options={UNITS.map((u) => ({ value: u, label: u }))}
              onChange={(v) => patch({ unit: v, line: LINES_BY_UNIT[v][0] })} />
          </div>
          <div>
            <FieldLabel>Sewing Line (of unit)</FieldLabel>
            <FormSelect value={plan.line} style={{ width: 120 }}
              options={(LINES_BY_UNIT[plan.unit] || []).map((l) => ({ value: l, label: l }))} onChange={(v) => patch({ line: v })} />
          </div>
          <div>
            <FieldLabel>Production Start</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(plan.startDate)} onChange={(d) => patch({ startDate: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Production End</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(plan.endDate)} onChange={(d) => patch({ endDate: d.format('YYYY-MM-DD') })} />
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
              { key: 'd', label: 'Delivery', children: dayjs(order.deliveryDate).format('DD-MMM-YYYY') },
              { key: 'c', label: 'Color', children: order.color },
            ]} />
        )}
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Garment SAM (min)" value={plan.sam || totalSam} precision={1} /></Card></Col>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Target / Hour" value={tph} /></Card></Col>
        <Col xs={8} md={4}><Card size="small"><Statistic title="Target / Day" value={tph * plan.workingHours} /></Card></Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title={`CM Rate ₹/pc (Σ rates + ${plan.otherChargesPct || 0}% other charges)`} value={cmRatePerPc} precision={2} prefix="₹" />
          </Card>
        </Col>
      </Row>

      <OperationBreakdownGrid plan={plan} onChange={setPlan} />
    </div>
  );
};

export default SewingPlanForm;
