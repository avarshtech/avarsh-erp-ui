import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Card, Space, DatePicker, InputNumber, Spin, Tag, Alert } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import EmptyState from '../../../components/EmptyState';
import { FormSelect } from '../../../components/form';
import { getActiveShifts } from '../../../services/master/hrMasterService';
import { completedOf, efficiencyPct, workedHoursOf } from '../../../utils/sewingCalc';
import { TRAFFIC_COLORS } from '../../../utils/sewingConstants';
import {
  listPlans, getPlan, getOperators, getHourlySheet, saveHourlySheet, findHourConflicts, listCutReceipts,
} from '../../../services/production/sewingService';
import HourlyGrid from './HourlyGrid';

const LIGHT_KEY = { GREEN: 'green', YELLOW: 'yellow', RED: 'red' };

/**
 * PRD 4.3 — the sewing floor's most-used screen: operator x hour inline grid.
 * The server owns every derived figure; what is computed here is only the live
 * preview between keystroke and save.
 */
const HourlyProductionTab = () => {
  const { message, modal } = App.useApp();
  const [plans, setPlans] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [operators, setOperators] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [planId, setPlanId] = useState(null);
  const [plan, setPlan] = useState(null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [shiftId, setShiftId] = useState(null);
  const [sheet, setSheet] = useState(null);
  // The plan / date / shift the open sheet was loaded for: the save goes there, whatever the pickers show (U261)
  const [sheetSlot, setSheetSlot] = useState(null);
  const [sheetFailed, setSheetFailed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const sheetRequest = useRef(0);
  const confirming = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [pl, sh, ops, recs] = await Promise.all([
          listPlans(), getActiveShifts(), getOperators(), listCutReceipts(),
        ]);
        setPlans(pl); setShifts(sh); setOperators(ops); setReceipts(recs);
        setPlanId(pl.find((p) => p.status === 'IN_PROGRESS')?.id ?? pl[0]?.id ?? null);
        setShiftId(sh[0]?.id ?? null);
      } catch { message.error('Failed to load plans and shifts'); }
      finally { setLoaded(true); }
    })();
  }, [message]);

  // The plan carries the operations the grid may book against and the SAM the
  // efficiency preview is measured with, so it is fetched in full.
  useEffect(() => {
    if (!planId) { setPlan(null); return undefined; }
    let current = true;
    getPlan(planId)
      .then((p) => { if (current) setPlan(p); })
      .catch(() => { if (current) message.error('Failed to load the plan'); });
    return () => { current = false; };
  }, [planId, message]);

  // Each change of plan, date or shift closes the open sheet and opens that slot's; a reply for a slot
  // no longer chosen is dropped, so a slow or failed load never leaves another slot's sheet under the pickers.
  const loadSheet = useCallback(async () => {
    if (!planId || !shiftId) return;
    const request = sheetRequest.current + 1;
    sheetRequest.current = request;
    const slot = { planId, date, shiftId };
    setSheet(null); setSheetSlot(null); setSheetFailed(false); setDirty(false);
    try {
      const loadedSheet = await getHourlySheet(slot);
      if (sheetRequest.current !== request) return;
      setSheet(loadedSheet); setSheetSlot(slot); setOpened(true);
    } catch {
      if (sheetRequest.current !== request) return;
      setSheetFailed(true);
      message.error('Failed to load the hourly sheet');
    }
  }, [planId, date, shiftId, message]);

  useEffect(() => { loadSheet(); }, [loadSheet]);

  /** Typed rows are only discarded after a yes: a change of plan, date or shift opens another sheet. */
  const switchSlot = (apply) => (value) => {
    if (!dirty) { apply(value); return; }
    // The date picker reports the same choice again when focus moves to the dialog: ask once
    if (confirming.current) return;
    confirming.current = true;
    // Opened after the picker has finished with the key or click that chose the value
    setTimeout(() => modal.confirm({
      afterClose: () => { confirming.current = false; },
      title: 'Discard unsaved entries?',
      content: 'This sheet has changes that are not saved. Opening another plan, date or shift discards them.',
      okText: 'Discard',
      okButtonProps: { danger: true },
      cancelText: 'Keep editing',
      onOk: () => apply(value),
    }), 0);
  };

  const editSheet = useCallback((next) => { setSheet(next); setDirty(true); }, []);

  /** The plan's last operation is what the line's finished output is read from. */
  const lastOperationId = useMemo(() => (plan?.operations || [])
    .reduce((last, o) => (last == null || o.seq > last.seq ? o : last), null)?.operationId ?? null, [plan]);

  const live = useMemo(() => {
    if (!sheet || !plan) return null;
    const completed = completedOf(sheet.rows, lastOperationId);
    const workedHours = workedHoursOf(sheet.rows);
    const eff = efficiencyPct(completed, plan.sam, sheet.presentOperators, workedHours);
    const due = (sheet.targetPerHour || 0) * workedHours;
    return {
      completed,
      workedHours,
      efficiencyPct: eff,
      performancePct: due > 0 ? Math.round((completed / due) * 100) : 0,
      absenteeismPct: sheet.plannedOperators
        ? Math.round(((sheet.plannedOperators - sheet.presentOperators) / sheet.plannedOperators) * 100) : 0,
      trafficLight: eff >= (sheet.efficiencyGreenPct ?? 70) ? 'GREEN'
        : eff >= (sheet.efficiencyYellowPct ?? 50) ? 'YELLOW' : 'RED',
    };
  }, [sheet, plan, lastOperationId]);

  const toPayload = useCallback(() => ({
    id: sheet.id ?? undefined,
    planId: sheetSlot.planId,
    sheetDate: sheetSlot.date,
    shiftId: sheetSlot.shiftId,
    presentOperators: sheet.presentOperators,
    remarks: sheet.remarks,
    rows: sheet.rows,
  }), [sheet, sheetSlot]);

  const handleSave = async () => {
    if (!sheet || !sheetSlot) return;
    setSaving(true);
    try {
      // Warn before posting: the server refuses the same clash on save, but the
      // supervisor should see whose hour it is while the grid is still open.
      const conflicts = await findHourConflicts(toPayload());
      if (conflicts.length) {
        conflicts.forEach((c) => message.error(c.message));
        return;
      }
      setSheet(await saveHourlySheet(toPayload()));
      setDirty(false);
      message.success('Hourly production saved');
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save the sheet');
    } finally { setSaving(false); }
  };

  const slotPickers = (
    <>
      <FormSelect value={planId} style={{ width: 320 }}
        options={plans.map((p) => ({ value: p.id, label: `${p.line} · ${p.orderNo} · ${p.styleNo}` }))}
        onChange={switchSlot(setPlanId)} />
      <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(date)}
        onChange={switchSlot((d) => setDate(d.format('YYYY-MM-DD')))} />
      <FormSelect value={shiftId} style={{ width: 150 }} placeholder="Shift"
        options={shifts.map((s) => ({ value: s.id, label: s.name }))} onChange={switchSlot(setShiftId)} />
    </>
  );

  // Without a plan or a shift there is no sheet to open: say what is missing instead of spinning
  if (loaded && (!plans.length || !shifts.length)) {
    return (
      <Card>
        {!plans.length
          ? <EmptyState title="No sewing plan yet" description="Create one under Production Plan to record hourly output" />
          : <EmptyState title="No active shift" description="Add a shift under HR masters to record hourly output" />}
      </Card>
    );
  }
  // The first sheet opens behind the page spinner, as before; later switches keep the pickers on screen
  if (!plan || (!sheet && !sheetFailed && !opened)) {
    return <Card><div style={{ textAlign: 'center', padding: 60 }}><Spin /></div></Card>;
  }
  if (!sheet) {
    return (
      <div>
        <Card style={{ marginBottom: 16 }}>
          <Space size="middle" wrap>
            {slotPickers}
            {sheetFailed
              ? (
                <span style={{ color: 'var(--error-color)' }}>
                  Could not load this sheet. <Button type="link" size="small" onClick={loadSheet}>Try again</Button>
                </span>
              )
              : <Spin size="small" />}
          </Space>
        </Card>
      </div>
    );
  }

  const light = TRAFFIC_COLORS[LIGHT_KEY[live?.trafficLight] ?? 'red'];
  const orderReceipts = receipts.filter((r) => r.orderId === plan.orderId);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          {slotPickers}
          <Space size="small">
            <span style={{ color: 'var(--text-secondary)' }}>Manpower:</span>
            <span>planned <strong>{sheet.plannedOperators}</strong></span>
            <span>present</span>
            <InputNumber size="small" min={0} max={sheet.plannedOperators} value={sheet.presentOperators}
              style={{ width: 64 }} onChange={(v) => editSheet((prev) => ({ ...prev, presentOperators: v ?? 0 }))} />
            {live?.absenteeismPct > (sheet.absenteeismAlertPct ?? 10)
              && <Tag color="red">Absenteeism {live.absenteeismPct}%</Tag>}
          </Space>
          <ActionButton action="save" text="Save Sheet" loading={saving} onClick={handleSave} />
        </Space>
        <div style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
          {sheet.sheetNo ? <code>{sheet.sheetNo}</code> : 'Not saved yet'}
          {' · '}{plan.buyer || plan.orderNo} · {plan.unit} · Order qty {plan.totalQty} · SAM {plan.sam}
        </div>
      </Card>

      {live && (
        <Card size="small" style={{ marginBottom: 16, borderLeft: `4px solid ${light}` }}>
          <Space size="large" wrap>
            <Space size={6}>
              <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', background: light }} />
              <strong>{sheet.line}</strong>
            </Space>
            <span>Line Efficiency: <strong style={{ color: light }}>{live.efficiencyPct}%</strong>
              <span style={{ color: 'var(--text-secondary)' }}>
                {' '}(green ≥{sheet.efficiencyGreenPct}%, yellow ≥{sheet.efficiencyYellowPct}%)
              </span>
            </span>
            <span>Total Garment Output: <strong>{live.completed}</strong> (last operation)</span>
            <span>Target: <strong>{sheet.targetPerHour}/hr · {sheet.targetPerDay}/day</strong></span>
            <span>Performance vs target ({live.workedHours}h): <strong>{live.performancePct}%</strong></span>
          </Space>
        </Card>
      )}

      {sheet.carriedFromDate && !sheet.id && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          title={`Line continuity — operators copied from ${dayjs(sheet.carriedFromDate).format('DD-MMM')}'s sheet (editable); hours start blank.`} />
      )}

      {live?.trafficLight === 'RED' && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title={`Line running below ${sheet.efficiencyYellowPct}% efficiency — immediate supervision needed (traffic-light rule, PRD 4.3.4)`} />
      )}

      <Card title={`Cut Parts Received for ${plan.orderNo} (per DC)`} size="small" style={{ marginBottom: 16 }}>
        {orderReceipts.length === 0
          ? <span style={{ color: 'var(--text-secondary)' }}>No cut parts received yet for this order</span>
          : orderReceipts.map((r) => (
            <Space key={r.id} size="middle" wrap style={{ display: 'flex', marginBottom: 4 }}>
              <code>{r.receiptNo}</code>
              <span style={{ color: 'var(--text-secondary)' }}>DC / Bundle Issue: <code>{r.bundleIssueNo}</code></span>
              <span>{dayjs(r.receiptDate).format('DD-MMM')}</span>
              {r.bundles.map((b) => <Tag key={b.bundleNo}>{b.bundleNo} {b.size}×{b.receivedQty}</Tag>)}
              <strong>{r.receivedQty} pcs</strong>
            </Space>
          ))}
      </Card>

      <HourlyGrid sheet={sheet} operators={operators} operations={plan.operations || []}
        lastOperationId={lastOperationId} targetPerDay={sheet.targetPerDay || 0} onChange={editSheet} />
    </div>
  );
};

export default HourlyProductionTab;
