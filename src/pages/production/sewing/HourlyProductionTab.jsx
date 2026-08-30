import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, DatePicker, InputNumber, Spin, Tag, Alert } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { SHIFTS, EFFICIENCY_BANDS, trafficLight, TRAFFIC_COLORS } from '../../../utils/sewingConstants';
import {
  listPlans, getOrders, getOperators, getHourlySheet, saveHourlySheet, findHourConflicts, rowTotal, efficiencyPct, targetPerHour, listCutReceipts,
} from '../../../services/production/sewingService';
import HourlyGrid from './HourlyGrid';

/**
 * PRD 4.3 — the sewing floor's most-used screen: operator × hour inline grid
 * with live totals, efficiency traffic light and (SME gap-fill) explicit
 * planned-vs-present manpower for absenteeism impact.
 */
const HourlyProductionTab = () => {
  const { message } = App.useApp();
  const [plans, setPlans] = useState([]);
  const [orders, setOrders] = useState([]);
  const [operators, setOperators] = useState([]);
  const [planId, setPlanId] = useState(null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [shift, setShift] = useState('DAY');
  const [sheet, setSheet] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [pl, ords, ops] = await Promise.all([listPlans(), getOrders(), getOperators()]);
        setPlans(pl); setOrders(ords); setOperators(ops);
        setReceipts(await listCutReceipts());
        setPlanId(pl.find((p) => p.status === 'IN_PROGRESS')?.id ?? pl[0]?.id ?? null);
      } catch { message.error('Failed to load plans'); }
    })();
  }, [message]);

  const loadSheet = useCallback(async () => {
    if (!planId) return;
    try { setSheet(await getHourlySheet({ planId, date, shift })); }
    catch { message.error('Failed to load hourly sheet'); }
  }, [planId, date, shift, message]);

  useEffect(() => { loadSheet(); }, [loadSheet]);

  const plan = useMemo(() => plans.find((p) => p.id === planId), [plans, planId]);
  const order = useMemo(() => orders.find((o) => o.id === plan?.orderId), [orders, plan]);

  const kpis = useMemo(() => {
    if (!sheet || !plan) return null;
    // Final output = last OPERATION's output — summed across parallel operators
    // doing that same operation, not just the last row.
    const lastPart = sheet.rows[sheet.rows.length - 1]?.part;
    const completed = lastPart
      ? sheet.rows.filter((r) => r.part === lastPart).reduce((s, r) => s + rowTotal(r), 0)
      : 0;
    const workedHours = ['hr1', 'hr2', 'hr3', 'hr4', 'hr5', 'hr6', 'hr7', 'hr8'].filter((h) => sheet.rows.some((r) => r[h] != null)).length || 1;
    const eff = efficiencyPct(completed, plan.sam, sheet.presentOperators || plan.operators, workedHours);
    const tph = targetPerHour(plan.operators, plan.sam, plan.targetEfficiencyPct);
    const absenteeismPct = plan.operators ? Math.round(((sheet.plannedOperators - sheet.presentOperators) / sheet.plannedOperators) * 100) : 0;
    return {
      completed, eff, tph, targetDay: tph * plan.workingHours,
      performance: tph * workedHours > 0 ? Math.round((completed / (tph * workedHours)) * 100) : 0,
      light: trafficLight(eff), absenteeismPct, workedHours,
    };
  }, [sheet, plan]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Duplicate guard: one operation per tailor per hour across styles/lines.
      const conflicts = await findHourConflicts(sheet);
      if (conflicts.length) {
        conflicts.forEach((c) => message.error(c));
        return;
      }
      const saved = await saveHourlySheet(sheet);
      setSheet(saved);
      message.success('Hourly production saved');
    } catch { message.error('Failed to save'); } finally { setSaving(false); }
  };

  if (!plan) return <Card><div style={{ textAlign: 'center', padding: 60 }}><Spin /></div></Card>;

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <FormSelect value={planId} style={{ width: 300 }}
            options={plans.map((p) => {
              const o = orders.find((x) => x.id === p.orderId);
              return { value: p.id, label: `${p.line} · ${o?.orderNo || ''} · ${o?.styleNo || ''}` };
            })}
            onChange={setPlanId} />
          <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(date)} onChange={(d) => setDate(d.format('YYYY-MM-DD'))} />
          <FormSelect value={shift} style={{ width: 130 }} options={SHIFTS.map((s) => ({ value: s, label: s }))} onChange={setShift} />
          {sheet && (
            <Space size="small">
              <span style={{ color: 'var(--text-secondary)' }}>Manpower:</span>
              <span>planned <strong>{sheet.plannedOperators}</strong></span>
              <span>present</span>
              <InputNumber size="small" min={0} max={sheet.plannedOperators} value={sheet.presentOperators}
                style={{ width: 64 }} onChange={(v) => setSheet((prev) => ({ ...prev, presentOperators: v ?? 0 }))} />
              {kpis?.absenteeismPct > 10 && <Tag color="red">Absenteeism {kpis.absenteeismPct}%</Tag>}
            </Space>
          )}
          <ActionButton action="save" text="Save Sheet" loading={saving} onClick={handleSave} />
        </Space>
        {order && (
          <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
            {order.buyer} · {order.color} · {order.description} · Order qty {order.orderQty}
          </div>
        )}
      </Card>

      {kpis && (
        <Card size="small" style={{ marginBottom: 16, borderLeft: `4px solid ${TRAFFIC_COLORS[kpis.light]}` }}>
          <Space size="large" wrap>
            <Space size={6}>
              <span style={{
                display: 'inline-block', width: 14, height: 14, borderRadius: '50%',
                background: TRAFFIC_COLORS[kpis.light],
              }} />
              <strong>{plan.line}</strong>
            </Space>
            <span>Line Efficiency: <strong style={{ color: TRAFFIC_COLORS[kpis.light] }}>{kpis.eff}%</strong>
              <span style={{ color: 'var(--text-secondary)' }}> (green ≥{EFFICIENCY_BANDS.green}%, yellow ≥{EFFICIENCY_BANDS.yellow}%)</span>
            </span>
            <span>Total Garment Output: <strong>{kpis.completed}</strong> (final output from the last operation)</span>
            <span>Target: <strong>{kpis.tph}/hr · {kpis.targetDay}/day</strong></span>
            <span>Performance vs target ({kpis.workedHours}h): <strong>{kpis.performance}%</strong></span>
          </Space>
        </Card>
      )}

      {sheet?.carriedFrom && !sheet.id && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          title={`Line continuity — operators copied from ${dayjs(sheet.carriedFrom).format('DD-MMM')}'s sheet (editable); hours start blank.`} />
      )}

      {sheet && kpis?.light === 'red' && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title="Line running below 50% efficiency — immediate supervision needed (traffic-light rule, PRD 4.3.4)" />
      )}

      {order && (
        <Card title={`Cut Parts Received for ${order.orderNo} (per DC)`} size="small" style={{ marginBottom: 16 }}>
          {receipts.filter((r) => r.orderId === order.id).length === 0
            ? <span style={{ color: 'var(--text-secondary)' }}>No cut parts received yet for this order</span>
            : receipts.filter((r) => r.orderId === order.id).map((r) => (
              <Space key={r.id} size="middle" wrap style={{ display: 'flex', marginBottom: 4 }}>
                <code>{r.receiptNo}</code>
                <span style={{ color: 'var(--text-secondary)' }}>DC / Bundle Issue: <code>{r.bundleIssueNo}</code></span>
                <span>{dayjs(r.date).format('DD-MMM')}</span>
                {r.bundles.map((b) => <Tag key={b.bundleNo}>{b.bundleNo} {b.size}×{b.qty}</Tag>)}
                <strong>{r.bundles.reduce((s, b) => s + b.qty, 0)} pcs</strong>
              </Space>
            ))}
        </Card>
      )}

      {sheet && <HourlyGrid sheet={sheet} operators={operators} targetPerDay={kpis?.targetDay || 0} onChange={setSheet} />}
    </div>
  );
};

export default HourlyProductionTab;
