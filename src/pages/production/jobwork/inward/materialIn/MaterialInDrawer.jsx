import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Col, DatePicker, Drawer, Input, Row, Select, Skeleton, Space, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { listInwardFilterOptions } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import { getInwardForm, getInwardReport, postInward } from '../../../../../services/production/jobwork/jobWorkPartyStockApi';
import { buildShortageReportHtml } from '../../../../../utils/jobWorkInward/inwardPrint';
import { MATERIAL_KIND } from '../../../../../utils/jobWorkInward/inwardConstants';
import { validateInward } from '../../../../../utils/jobWorkInward/materialRules';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../../utils/uiConstants';
import FabricRollsEditor from './FabricRollsEditor';
import CountLinesEditor from './CountLinesEditor';
import { fmtQty } from '../../jwFormat';

const { Text } = Typography;
const today = () => dayjs().format('YYYY-MM-DD');
const Label = ({ children }) => <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{children}</Text>;
const dateInput = (name, value, onChange) => (
  <DatePicker name={name} style={{ width: '100%' }} format={DATE_FORMAT} allowClear={false} value={dayjs(value)} disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(d) => onChange(d.format('YYYY-MM-DD'))} />
);

/** The principal's material arriving on their challan — a GRN with no PO and no value: it stays theirs. */
const MaterialInDrawer = ({ jobOrderId: givenId, onClose, onSaved, openPrint }) => {
  const { message } = App.useApp();
  const [jobOrderId, setJobOrderId] = useState(givenId);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(null);
  const [head, setHead] = useState({ date: today(), theirDcNo: '', theirDcDate: today(), dispatchedFrom: '', vehicleNo: '', ewayBillNo: '', defects: [] });
  const [fabric, setFabric] = useState({});
  const [counts, setCounts] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (p) => setHead((h) => ({ ...h, ...p }));

  useEffect(() => { if (!givenId) listInwardFilterOptions().then((o) => setOrders(o.jobOrders)).catch(() => {}); }, [givenId]);
  useEffect(() => {
    if (!jobOrderId) return;
    getInwardForm(jobOrderId).then((f) => { setForm(f); setHead((h) => ({ ...h, dispatchedFrom: `${f.principal.name}, ${f.principal.city}` })); })
      .catch((e) => toastUnlessHandled(message, e));
  }, [jobOrderId, message]);

  const mats = (kind) => (form?.materials || []).filter((m) => m.kind === kind);
  const hint = (m) => `needs ${fmtQty(m.required)} ${m.uom} · ${fmtQty(m.received)} in so far`;
  const trimRows = mats(MATERIAL_KIND.TRIM).map((m) => ({ key: `t${m.id}`, materialId: m.id, label: m.itemName, uom: m.uom, hint: hint(m) }));
  const panelRows = mats(MATERIAL_KIND.PANELS).flatMap((m) => (form.jobOrder.sizes || []).map((size) => ({ key: `p${m.id}|${size}`, materialId: m.id, size, label: `${m.itemName} — ${size}`, uom: 'sets', hint: size === form.jobOrder.sizes[0] ? hint(m) : '' })));
  const lines = [
    ...Object.entries(fabric).map(([id, v]) => ({ materialId: Number(id), kind: MATERIAL_KIND.FABRIC, challanQty: v.challanQty, declaredRate: v.declaredRate, rolls: (v.rolls || []).filter((r) => r.qty), receivedQty: (v.rolls || []).reduce((a, r) => a + (Number(r.qty) || 0), 0) })),
    ...[...trimRows, ...panelRows].filter((r) => counts[r.key]).map((r) => ({ materialId: r.materialId, size: r.size, ...counts[r.key] })),
  ];
  const errors = form ? validateInward({ ...head, jobOrderId, today: today(), lines, interState: form.interState }) : [];

  const submit = async () => {
    setBusy(true);
    try {
      const res = await postInward({ ...head, jobOrderId, defects: head.defects.map((text) => ({ text })), lines });
      message.success(`${res.inwardNo} posted${res.shortLines ? ` — ${res.shortLines} line(s) short on their challan` : ''}.`);
      onSaved();
      if (res.shortLines || head.defects.length) {
        const d = await getInwardReport(res.id);
        openPrint({ title: `Shortage & defect report — ${d.doc.inwardNo}`, html: buildShortageReportHtml(d) });
      }
      onClose();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };

  return (
    <Drawer open size={1040} destroyOnHidden onClose={onClose} title={form ? `Material in — ${form.jobOrder.orderNo} · ${form.principal.name}` : 'Material in from a principal'}
      extra={<Space><Button onClick={onClose}>Close</Button><Button type="primary" loading={busy} disabled={!form || errors.length > 0} onClick={submit}>Post</Button></Space>}>
      {!givenId && (
        <Select name="miOrder" showSearch optionFilterProp="label" style={{ width: '100%', marginBottom: 12 }} placeholder="Which job order is this material for?"
          value={jobOrderId} onChange={(v) => { setJobOrderId(v); setForm(null); setFabric({}); setCounts({}); }} options={orders} />
      )}
      {jobOrderId && !form && <Skeleton active />}
      {form && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={12} md={6}><Label>Their challan no.</Label><Input name="miDc" value={head.theirDcNo} onChange={(e) => set({ theirDcNo: e.target.value })} /></Col>
            <Col xs={12} md={6}><Label>Their challan date</Label>{dateInput('miDcDate', head.theirDcDate, (v) => set({ theirDcDate: v }))}</Col>
            <Col xs={12} md={6}><Label>Received on</Label>{dateInput('miDate', head.date, (v) => set({ date: v }))}</Col>
            <Col xs={12} md={6}><Label>Vehicle</Label><Input name="miVehicle" value={head.vehicleNo} onChange={(e) => set({ vehicleNo: e.target.value })} /></Col>
            <Col xs={24} md={12}><Label>Dispatched from (their unit, or their dyer / supplier)</Label><Input name="miFrom" value={head.dispatchedFrom} onChange={(e) => set({ dispatchedFrom: e.target.value })} /></Col>
            <Col xs={24} md={12}><Label>E-way bill{form.interState ? ' (needed: inter-state)' : ''}</Label><Input name="miEway" value={head.ewayBillNo} status={form.interState && !head.ewayBillNo.trim() ? 'warning' : undefined} onChange={(e) => set({ ewayBillNo: e.target.value })} /></Col>
          </Row>
          {mats(MATERIAL_KIND.FABRIC).map((m) => (
            <FabricRollsEditor key={m.id} material={m} tolerancePct={form.principal.weightTolerancePct} value={fabric[m.id] || { challanQty: null, declaredRate: null, rolls: [] }} onChange={(v) => setFabric((x) => ({ ...x, [m.id]: v }))} />
          ))}
          {panelRows.length > 0 && <><Text strong>Cut panels (sets)</Text><CountLinesEditor rows={panelRows} value={counts} onChange={setCounts} /></>}
          {trimRows.length > 0 && <div style={{ marginTop: 12 }}><Text strong>Trims</Text><CountLinesEditor rows={trimRows} value={counts} onChange={setCounts} /></div>}
          <div style={{ marginTop: 12 }}><Label>Defects noted (type and press Enter)</Label><Select name="miDefects" mode="tags" style={{ width: '100%' }} value={head.defects} onChange={(v) => set({ defects: v })} open={false} /></div>
          {errors.length > 0 && lines.length > 0 && <Alert type="error" showIcon style={{ marginTop: 12 }} title={errors[0].message} />}
        </>
      )}
    </Drawer>
  );
};

export default MaterialInDrawer;
