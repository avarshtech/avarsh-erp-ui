import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, InputNumber, Alert, DatePicker, Row, Col, Statistic, Segmented, Checkbox, Tag } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { CHECK_STAGES, LABEL_CHECKS, DHU_ALERT_PCT } from '../../../utils/finishingConstants';
import { getChecking, saveChecking, getOrders, getEmployees, aqlSample, dhuPct, rowTotal } from '../../../services/production/finishingService';
import FinishingHourlyGrid from './FinishingHourlyGrid';
import CheckingDefectsCard from './CheckingDefectsCard';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const newSheet = (orders) => ({
  stage: 'PRE_FINAL', orderId: orders[0]?.id, color: orders[0]?.color, date: dayjs().format('YYYY-MM-DD'),
  target: 190, lotSize: null, rows: [], passQty: null, alterQty: null, rejectQty: null, defects: [],
  labelChecks: Object.fromEntries(LABEL_CHECKS.map((l) => [l, false])),
});

/** PRD Module 5 — checking sheet: 100% pre-final or AQL 2.5 final inspection. */
const CheckingForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [sheet, setSheet] = useState(null);
  const [orders, setOrders] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [record, ords, emps] = await Promise.all([isEdit ? getChecking(id) : Promise.resolve(null), getOrders(), getEmployees('CHECKING')]);
        setOrders(ords); setEmployees(emps);
        setSheet(record || newSheet(ords));
      } catch { message.error('Failed to load checking sheet'); }
    })();
  }, [id, isEdit, message]);

  const patch = useCallback((p) => setSheet((prev) => ({ ...prev, ...p })), []);

  const totals = useMemo(() => {
    if (!sheet) return null;
    const checked = (sheet.passQty || 0) + (sheet.alterQty || 0) + (sheet.rejectQty || 0);
    const gridTotal = sheet.rows.reduce((s, r) => s + rowTotal(r), 0);
    const defects = sheet.defects.reduce((s, d) => s + (d.count || 0), 0);
    const dhu = dhuPct(defects, checked);
    const aql = sheet.stage === 'FINAL' && sheet.lotSize ? aqlSample(sheet.lotSize) : null;
    const majorPlus = defects; // mock: all logged defects count toward the AQL decision
    const verdict = aql ? (majorPlus <= aql.accept ? 'ACCEPTED' : 'REJECTED') : null;
    return { checked, gridTotal, defects, dhu, aql, verdict, reconciled: checked === gridTotal };
  }, [sheet]);

  const handleSave = async () => {
    if (!totals.checked) return message.warning('Enter Pass / Alter / Reject quantities');
    if (!totals.reconciled) return message.warning(`Pass + Alter + Reject (${totals.checked}) must equal the grid total checked (${totals.gridTotal})`);
    setSaving(true);
    try {
      const saved = await saveChecking({ ...sheet, verdict: totals.verdict, sampleSize: totals.aql?.sample, acceptNo: totals.aql?.accept, rejectNo: totals.aql?.reject });
      message.success(`${saved.checkNo} saved${sheet.alterQty ? ` — ${sheet.alterQty} pcs auto-routed to alteration` : ''}`);
      navigate('/production/finishing?tab=checking');
    } catch { message.error('Failed to save checking sheet'); } finally { setSaving(false); }
  };

  if (!sheet || !totals) return <div style={{ textAlign: 'center', padding: 80 }}><Spin /></div>;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? `Checking — ${sheet.checkNo}` : 'New Checking Sheet'}
        backPath="/production/finishing?tab=checking"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <ActionButton action="save" text="Save Sheet" loading={saving} onClick={handleSave} />
      </PageHeader>

      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end">
          <div>
            <FieldLabel>Stage</FieldLabel>
            <Segmented options={CHECK_STAGES.map((s) => ({ value: s.key, label: s.label }))} value={sheet.stage}
              onChange={(v) => patch({ stage: v })} disabled={isEdit} />
          </div>
          <div>
            <FieldLabel>Order</FieldLabel>
            <FormSelect value={sheet.orderId} style={{ width: 230 }} disabled={isEdit}
              options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
              onChange={(v) => patch({ orderId: v, color: orders.find((o) => o.id === v)?.color })} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(sheet.date)} onChange={(d) => patch({ date: d.format('YYYY-MM-DD') })} />
          </div>
          <div>
            <FieldLabel>Target / checker</FieldLabel>
            <InputNumber min={0} value={sheet.target} style={{ width: 100 }} onChange={(v) => patch({ target: v })} />
          </div>
          {sheet.stage === 'FINAL' && (
            <>
              <div>
                <FieldLabel>Lot Size</FieldLabel>
                <InputNumber min={2} value={sheet.lotSize} style={{ width: 110 }} onChange={(v) => patch({ lotSize: v })} />
              </div>
              {totals.aql && (
                <div>
                  <FieldLabel>AQL 2.5 sampling</FieldLabel>
                  <Tag color="purple">Sample {totals.aql.sample} · Ac {totals.aql.accept} · Re {totals.aql.reject}</Tag>
                </div>
              )}
            </>
          )}
        </Space>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8} md={3}><Card size="small"><Statistic title="Checked (grid)" value={totals.gridTotal} /></Card></Col>
        <Col xs={8} md={3}>
          <Card size="small">
            <FieldLabel>Pass Qty</FieldLabel>
            <InputNumber min={0} value={sheet.passQty} style={{ width: '100%' }} onChange={(v) => patch({ passQty: v })} />
          </Card>
        </Col>
        <Col xs={8} md={3}>
          <Card size="small">
            <FieldLabel>Alter Qty</FieldLabel>
            <InputNumber min={0} value={sheet.alterQty} style={{ width: '100%' }} onChange={(v) => patch({ alterQty: v })} />
          </Card>
        </Col>
        <Col xs={8} md={3}>
          <Card size="small">
            <FieldLabel>Reject Qty</FieldLabel>
            <InputNumber min={0} value={sheet.rejectQty} style={{ width: '100%' }} onChange={(v) => patch({ rejectQty: v })} />
          </Card>
        </Col>
        <Col xs={8} md={3}>
          <Card size="small">
            <Statistic title="DHU %" value={totals.dhu} suffix="%"
              styles={{ content: { color: totals.dhu > DHU_ALERT_PCT ? 'var(--error-color)' : 'var(--success-color)' } }} />
          </Card>
        </Col>
        {totals.verdict && (
          <Col xs={8} md={3}>
            <Card size="small">
              <Statistic title="AQL Verdict" value={totals.verdict}
                styles={{ content: { color: totals.verdict === 'ACCEPTED' ? 'var(--success-color)' : 'var(--error-color)', fontSize: 20 } }} />
            </Card>
          </Col>
        )}
      </Row>

      {!totals.reconciled && totals.checked > 0 && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          title={`Pass + Alter + Reject = ${totals.checked} but the checker grid totals ${totals.gridTotal} — they must match (PRD 8.3)`} />
      )}
      {totals.dhu > DHU_ALERT_PCT && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title={`DHU ${totals.dhu}% exceeds the ${DHU_ALERT_PCT}% threshold — QA alert`} />
      )}

      {sheet.stage === 'PRE_FINAL' && (
        <Card title="Label Verification (mandatory at pre-final)" size="small" style={{ marginBottom: 16 }}>
          <Space size="large" wrap>
            {LABEL_CHECKS.map((l) => (
              <Checkbox key={l} checked={sheet.labelChecks?.[l]}
                onChange={(e) => patch({ labelChecks: { ...sheet.labelChecks, [l]: e.target.checked } })}>
                {l}
              </Checkbox>
            ))}
          </Space>
        </Card>
      )}

      <div style={{ marginBottom: 16 }}>
        <FinishingHourlyGrid sheet={sheet} employees={employees} onChange={setSheet} />
      </div>
      <CheckingDefectsCard defects={sheet.defects} onChange={setSheet} />
    </div>
  );
};

export default CheckingForm;
