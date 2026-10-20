import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Segmented, Space, DatePicker, InputNumber, Tag, Spin, Statistic, Row, Col } from 'antd';
import dayjs from 'dayjs';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import { HOURLY_STATIONS } from '../../../utils/finishingConstants';
import useModuleSelection from '../../../hooks/useModuleSelection';
import { getHourlySheet, saveHourlySheet, getEmployees, getOrders, rowTotal } from '../../../services/production/finishingService';
import FinishingHourlyGrid from './FinishingHourlyGrid';

const FieldLabel = ({ children }) => (
  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{children}</div>
);

/** PRD Modules 2/3/6 — the three hourly stations behind one switcher (§19 pattern). */
const FinishingHourlyTab = () => {
  const { message } = App.useApp();
  const { selectOrder, defaultOrderId } = useModuleSelection('finishing');
  const [station, setStation] = useState(HOURLY_STATIONS[0].key);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [sheet, setSheet] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [saving, setSaving] = useState(false);

  const stationCfg = useMemo(() => HOURLY_STATIONS.find((s) => s.key === station), [station]);

  const load = useCallback(async () => {
    setSheet(null);
    try {
      const [sh, emps, ords] = await Promise.all([getHourlySheet({ station, date }), getEmployees(station), getOrders()]);
      // A sheet that has not been saved yet opens on whatever order the module
      // is working; a saved one keeps the order it was booked against.
      setSheet(sh.id ? sh : { ...sh, orderId: defaultOrderId(ords) });
      setEmployees(emps); setOrders(ords);
    } catch { message.error('Failed to load hourly sheet'); }
  }, [station, date, message, defaultOrderId]);

  useEffect(() => { load(); }, [load]);

  const totals = useMemo(() => {
    if (!sheet) return null;
    const output = sheet.rows.reduce((s, r) => s + rowTotal(r), 0);
    const teamTarget = (sheet.target || 0) * sheet.rows.length;
    const cost = stationCfg?.hasCost ? Math.round(output * (sheet.ratePerPiece || 0)) : null;
    return { output, teamTarget, cost, pct: teamTarget ? Math.round((output / teamTarget) * 100) : 0 };
  }, [sheet, stationCfg]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveHourlySheet(sheet);
      setSheet(saved);
      message.success(`${stationCfg.label} sheet saved`);
    } catch { message.error('Failed to save sheet'); } finally { setSaving(false); }
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space size="large" wrap align="end">
          <div>
            <FieldLabel>Station ({stationCfg?.prdRef})</FieldLabel>
            <Segmented options={HOURLY_STATIONS.map((s) => ({ value: s.key, label: s.label }))} value={station} onChange={setStation} />
          </div>
          <div>
            <FieldLabel>Date</FieldLabel>
            <DatePicker format="DD-MMM-YYYY" allowClear={false} value={dayjs(date)} onChange={(d) => setDate(d.format('YYYY-MM-DD'))} />
          </div>
          {sheet && (
            <>
              <div>
                <FieldLabel>Order</FieldLabel>
                <FormSelect value={sheet.orderId} style={{ width: 220 }}
                  options={orders.map((o) => ({ value: o.id, label: `${o.orderNo} · ${o.styleNo}` }))}
                  onChange={(v) => {
                    selectOrder(orders.find((o) => o.id === v));
                    setSheet((prev) => ({ ...prev, orderId: v }));
                  }} />
              </div>
              <div>
                <FieldLabel>Target / employee / day</FieldLabel>
                <InputNumber min={0} value={sheet.target} style={{ width: 110 }}
                  onChange={(v) => setSheet((prev) => ({ ...prev, target: v }))} />
              </div>
              <div>
                <FieldLabel>Rate ₹ / pc (cost per operator)</FieldLabel>
                <InputNumber min={0} step={0.1} value={sheet.ratePerPiece} style={{ width: 90 }}
                  onChange={(v) => setSheet((prev) => ({ ...prev, ratePerPiece: v }))} />
              </div>
              {sheet.ironTemp && (
                <div>
                  <FieldLabel>Iron Setting (from fabric)</FieldLabel>
                  <Tag color="blue">{sheet.ironTemp} · {sheet.ironMethod}</Tag>
                </div>
              )}
              <ActionButton action="save" text="Save Sheet" loading={saving} onClick={handleSave} />
            </>
          )}
        </Space>
      </Card>

      {!sheet ? <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div> : (
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={8} md={4}><Card size="small"><Statistic title="Output today" value={totals.output} /></Card></Col>
            <Col xs={8} md={4}><Card size="small"><Statistic title="Team target" value={totals.teamTarget} /></Card></Col>
            <Col xs={8} md={4}>
              <Card size="small">
                <Statistic title="Achievement" value={totals.pct} suffix="%"
                  styles={{ content: { color: totals.pct >= 100 ? 'var(--success-color)' : totals.pct >= 80 ? 'var(--warning-color)' : 'var(--error-color)' } }} />
              </Card>
            </Col>
            {totals.cost != null && (
              <Col xs={8} md={4}><Card size="small"><Statistic title="Piece-rate cost ₹" value={totals.cost} /></Card></Col>
            )}
          </Row>
          <FinishingHourlyGrid sheet={sheet} employees={employees} hasCost={stationCfg?.hasCost} onChange={setSheet} />
        </>
      )}
    </div>
  );
};

export default FinishingHourlyTab;
