import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Space, Spin, InputNumber, Alert, DatePicker, Row, Col, Statistic, Segmented, Checkbox, Tag, Table, Button } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { CHECK_STAGES, DHU_ALERT_PCT } from '../../../utils/finishingConstants';
import useModuleSelection from '../../../hooks/useModuleSelection';
import {
  getChecking, saveChecking, getOrders, aqlSample, dhuPct, specPoints, fullMeasurementChart,
  getBomLabelItems,
} from '../../../services/production/finishingService';
import CheckingDefectsCard from './CheckingDefectsCard';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

const pointStatus = (p) => {
  if (p.actual == null) return null;
  const dev = Math.round((p.actual - p.spec) * 10) / 10;
  if (Math.abs(dev) > p.tol) return { label: 'FAIL', color: 'red', dev };
  return { label: 'PASS', color: 'green', dev };
};

/** A BOM label line keyed the same way whether it is ticked now or read back later. */
const labelKey = (item) => item.itemCode || item.name;

const newSheet = (orders, orderId) => {
  const order = orders.find((o) => o.id === orderId) || orders[0];
  return {
    stage: 'PRE_FINAL', orderId: order?.id, color: order?.color, date: dayjs().format('YYYY-MM-DD'),
    target: 190, lotSize: null, passQty: null, alterQty: null, rejectQty: null, defects: [],
    labelChecks: {},
    chartSize: order?.sizes?.[0], points: specPoints(order?.styleNo, order?.sizes?.[0]),
  };
};

/** Module 5 (rev) — checking sheet: Pass/Alter/Reject + defect log + measurement chart. */
const CheckingForm = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { selectOrder, defaultOrderId } = useModuleSelection('finishing');
  const [sheet, setSheet] = useState(null);
  const [orders, setOrders] = useState([]);
  const [labelItems, setLabelItems] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [record, ords] = await Promise.all([isEdit ? getChecking(id) : Promise.resolve(null), getOrders()]);
        setOrders(ords);
        if (record) {
          const o = ords.find((x) => x.id === record.orderId);
          setSheet({ chartSize: o?.sizes?.[0], points: record.points || specPoints(o?.styleNo, o?.sizes?.[0]), ...record });
        } else setSheet(newSheet(ords, defaultOrderId(ords)));
      } catch { message.error('Failed to load checking sheet'); }
    })();
    // The remembered order only seeds a new sheet; it must not reload the form
    // when another screen in the module changes the selection mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit, message]);

  // Labels come off the order BOM, so a style carrying a flag label or a second
  // care label is verified without anyone editing a list in code.
  useEffect(() => {
    if (!sheet?.orderId) return;
    getBomLabelItems(sheet.orderId)
      .then(setLabelItems)
      .catch(() => message.error('Failed to load the label items from the BOM'));
  }, [sheet?.orderId, message]);

  const patch = useCallback((p) => setSheet((prev) => ({ ...prev, ...p })), []);
  const order = useMemo(() => orders.find((o) => o.id === sheet?.orderId), [orders, sheet?.orderId]);

  const totals = useMemo(() => {
    if (!sheet) return null;
    const checked = (sheet.passQty || 0) + (sheet.alterQty || 0) + (sheet.rejectQty || 0);
    const defects = sheet.defects.reduce((s, d) => s + (d.count || 0), 0);
    const dhu = dhuPct(defects, checked);
    const aql = sheet.stage === 'FINAL' && sheet.lotSize ? aqlSample(sheet.lotSize) : null;
    const verdict = aql ? (defects <= aql.accept ? 'ACCEPTED' : 'REJECTED') : null;
    return { checked, defects, dhu, aql, verdict };
  }, [sheet]);

  /** Labels on the BOM that pre-final has not signed off yet. */
  const pendingLabels = useMemo(() => {
    if (!sheet || sheet.stage !== 'PRE_FINAL') return [];
    return labelItems.filter((item) => !sheet.labelChecks?.[labelKey(item)]);
  }, [sheet, labelItems]);

  const chartColumns = useMemo(() => [
    { title: 'Measurement Point', dataIndex: 'point', width: 190 },
    { title: 'Spec (cm)', dataIndex: 'spec', width: 90, align: 'right' },
    { title: 'Tol ±', dataIndex: 'tol', width: 70, align: 'center' },
    {
      title: 'Actual', dataIndex: 'actual', width: 110, align: 'center',
      render: (v, _, idx) => (
        <InputNumber size="small" step={0.1} value={v} style={{ width: 85 }}
          onChange={(val) => setSheet((prev) => ({ ...prev, points: prev.points.map((p, i) => (i === idx ? { ...p, actual: val } : p)) }))} />
      ),
    },
    {
      title: 'Deviation', key: 'dev', width: 90, align: 'center',
      render: (_, r) => { const s = pointStatus(r); return s ? <span style={{ color: s.color === 'red' ? 'var(--error-color)' : undefined }}>{s.dev > 0 ? '+' : ''}{s.dev}</span> : '—'; },
    },
    {
      title: 'Result', key: 'res', width: 90, align: 'center',
      render: (_, r) => { const s = pointStatus(r); return s ? <Tag color={s.color}>{s.label}</Tag> : '—'; },
    },
  ], []);

  const handleSave = async () => {
    if (!totals.checked) return message.warning('Enter Pass / Alter / Reject quantities');
    // Pre-final is where labels get caught. A wrong main or care label is a
    // critical defect, and no later stage re-opens a carton to find it.
    if (pendingLabels.length) {
      return message.warning(`Verify every label first \u2014 ${pendingLabels.map((l) => l.name).join(', ')} still unticked`);
    }
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
              onChange={(v) => {
                const o = orders.find((x) => x.id === v);
                selectOrder(o);
                patch({
                  orderId: v, color: o?.color, chartSize: o?.sizes?.[0], labelChecks: {},
                  points: specPoints(o?.styleNo, o?.sizes?.[0]),
                });
              }} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(sheet.date)} onChange={(d) => patch({ date: d.format('YYYY-MM-DD') })} />
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
        <Col xs={8} md={3}><Card size="small"><Statistic title="Total Checked" value={totals.checked} /></Card></Col>
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

      {totals.dhu > DHU_ALERT_PCT && (
        <Alert type="error" showIcon style={{ marginBottom: 16 }}
          title={`DHU ${totals.dhu}% exceeds the ${DHU_ALERT_PCT}% threshold — QA alert`} />
      )}

      {sheet.stage === 'PRE_FINAL' && (
        <Card size="small" style={{ marginBottom: 16 }}
          title="Label Verification (mandatory at pre-final)"
          extra={labelItems.length ? (
            <Tag color={pendingLabels.length ? 'red' : 'green'}>
              {labelItems.length - pendingLabels.length} of {labelItems.length} verified
            </Tag>
          ) : null}>
          {labelItems.length === 0 ? (
            <Alert type="warning" showIcon
              title="No label items on the BOM for this order"
              description="Nothing can be verified here until the BOM lists the brand, size and care labels for this style." />
          ) : (
            <Space size="large" wrap>
              {labelItems.map((item) => (
                <Checkbox key={labelKey(item)} checked={Boolean(sheet.labelChecks?.[labelKey(item)])}
                  onChange={(e) => patch({ labelChecks: { ...sheet.labelChecks, [labelKey(item)]: e.target.checked } })}>
                  {item.name}
                  {item.specification && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.specification}</div>
                  )}
                </Checkbox>
              ))}
            </Space>
          )}
        </Card>
      )}

      <div style={{ marginBottom: 16 }}>
        <CheckingDefectsCard defects={sheet.defects} onChange={setSheet} />
      </div>

      <Card
        title={`Measurement Chart — ${order?.styleNo || ''} (buyer spec)`}
        extra={(
          <Space>
            <FormSelect size="small" value={sheet.chartSize} style={{ width: 80 }}
              options={(order?.sizes || []).map((s) => ({ value: s, label: s }))}
              onChange={(v) => patch({ chartSize: v, points: specPoints(order?.styleNo, v) })} />
            <Button size="small" icon={<FileExcelOutlined />}
              onClick={() => {
                patch({ points: fullMeasurementChart(order?.styleNo, sheet.chartSize) });
                message.success('Measurement chart imported — all buyer spec points loaded');
              }}>
              Import Measurement Chart (Excel)
            </Button>
          </Space>
        )}
      >
        <Table rowKey="point" size="small" columns={chartColumns} dataSource={sheet.points} pagination={false} scroll={{ x: 650 }} />
      </Card>
    </div>
  );
};

export default CheckingForm;
