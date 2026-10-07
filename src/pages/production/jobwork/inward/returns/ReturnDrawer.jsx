import { useEffect, useState } from 'react';
import {
  Alert, App, Button, Col, DatePicker, Descriptions, Drawer, Input, InputNumber, Row, Segmented, Select, Skeleton, Space, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { listInwardFilterOptions } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import { getReturnForm, getReturnPrint, postReturn } from '../../../../../services/production/jobwork/jobWorkPrincipalReturnApi';
import { buildReturnChallanHtml } from '../../../../../utils/jobWorkInward/inwardPrint';
import { returnCharges } from '../../../../../utils/jobWorkInward/chargeRules';
import { validateReturn } from '../../../../../utils/jobWorkInward/returnRules';
import { WASTE_RULE } from '../../../../../utils/jobWorkInward/inwardConstants';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../../utils/uiConstants';
import ReturnGarmentsGrid from './ReturnGarmentsGrid';
import ReturnLotsGrid from './ReturnLotsGrid';
import { fmtMoney, fmtQty } from '../../jwFormat';

const { Text } = Typography;
const Label = ({ children }) => <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{children}</Text>;
const toLines = (cells) => Object.entries(cells).filter(([, q]) => q > 0).map(([k, qty]) => { const [colour, size] = k.split('|'); return { colour, size, qty }; });

/** Garments, rejects, leftovers and (by their rule) waste back to the principal on our challan. */
const ReturnDrawer = ({ jobOrderId: givenId, onClose, onSaved, openPrint }) => {
  const { message } = App.useApp();
  const [jobOrderId, setJobOrderId] = useState(givenId);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(null);
  const [head, setHead] = useState({ date: dayjs().format('YYYY-MM-DD'), ourChallanNo: '', vehicleNo: '', ewayBillNo: '' });
  const [shipTo, setShipTo] = useState(null);
  const [good, setGood] = useState({});
  const [rejects, setRejects] = useState({});
  const [lotQty, setLotQty] = useState({});
  const [wasteKg, setWasteKg] = useState(0);
  const [busy, setBusy] = useState(false);
  const set = (p) => setHead((h) => ({ ...h, ...p }));

  useEffect(() => { if (!givenId) listInwardFilterOptions().then((o) => setOrders(o.jobOrders)).catch(() => {}); }, [givenId]);
  useEffect(() => { if (jobOrderId) getReturnForm(jobOrderId).then(setForm).catch((e) => toastUnlessHandled(message, e)); }, [jobOrderId, message]);

  const garments = toLines(good);
  const payload = { ...head, jobOrderId, shipTo, garments, rejects: toLines(rejects), lotLines: Object.entries(lotQty).filter(([, q]) => q > 0).map(([lotId, qty]) => ({ lotId: Number(lotId), qty })), wasteKg };
  const errors = form ? validateReturn({ ...payload, ready: form.ready, rejectsAvailable: form.rejectsAvailable, inStoreByLot: Object.fromEntries(form.lots.map((l) => [l.id, l.inStore])), wasteHeld: form.wasteOnHand, wasteRule: form.principal.wasteRule }) : [];
  const charge = form && returnCharges({ jo: form.jobOrder, principal: form.principal, branch: form.branch, garments });

  const submit = async () => {
    setBusy(true);
    try {
      const res = await postReturn(payload);
      message.success(`${res.returnNo} dispatched — job charges ${fmtMoney(res.total)}.`);
      onSaved();
      const d = await getReturnPrint(res.id);
      openPrint({ title: `Return challan — ${d.ret.ourChallanNo}`, html: buildReturnChallanHtml(d) });
      onClose();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };

  return (
    <Drawer open size={1060} destroyOnHidden onClose={onClose} title={form ? `Return to ${form.principal.name} — ${form.jobOrder.orderNo}` : 'Return to a principal'}
      extra={<Space><Button onClick={onClose}>Close</Button><Button type="primary" loading={busy} disabled={!form || errors.length > 0} onClick={submit}>Dispatch &amp; print challan</Button></Space>}>
      {!givenId && <Select name="retOrder" showSearch optionFilterProp="label" style={{ width: '100%', marginBottom: 12 }} placeholder="Which job order?" value={jobOrderId} onChange={(v) => { setJobOrderId(v); setForm(null); setGood({}); setRejects({}); setLotQty({}); }} options={orders} />}
      {jobOrderId && !form && <Skeleton active />}
      {form && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col xs={12} md={6}><Label>Date</Label><DatePicker name="retDate" style={{ width: '100%' }} format={DATE_FORMAT} allowClear={false} value={dayjs(head.date)} disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(d) => set({ date: d.format('YYYY-MM-DD') })} /></Col>
            <Col xs={12} md={6}><Label>Our challan no. (from the book)</Label><Input name="retChallan" value={head.ourChallanNo} onChange={(e) => set({ ourChallanNo: e.target.value })} /></Col>
            <Col xs={12} md={6}><Label>Vehicle</Label><Input name="retVehicle" value={head.vehicleNo} onChange={(e) => set({ vehicleNo: e.target.value })} /></Col>
            <Col xs={12} md={6}><Label>E-way bill (typed for now)</Label><Input name="retEway" value={head.ewayBillNo} onChange={(e) => set({ ewayBillNo: e.target.value })} /></Col>
            <Col span={24}><Segmented value={shipTo ? 'customer' : 'principal'} options={[{ value: 'principal', label: 'Ship to the principal' }, { value: 'customer', label: 'Ship to their customer' }]} onChange={(v) => setShipTo(v === 'customer' ? { name: '', address: '', principalInvoiceNo: '' } : null)} /></Col>
            {shipTo && ['name', 'address', 'principalInvoiceNo'].map((k) => (
              <Col key={k} xs={24} md={k === 'address' ? 10 : 7}><Label>{{ name: 'Ship to', address: 'Address', principalInvoiceNo: 'Their invoice the goods travel on' }[k]}</Label><Input name={`ship-${k}`} value={shipTo[k]} onChange={(e) => setShipTo({ ...shipTo, [k]: e.target.value })} /></Col>
            ))}
          </Row>
          <Text strong>Finished garments (charged)</Text>
          <ReturnGarmentsGrid name="good" sizes={form.jobOrder.sizes} colours={form.jobOrder.colours} available={form.ready} value={good} onChange={setGood} />
          <Text strong style={{ display: 'block', marginTop: 12 }}>Rejected garments (no charge)</Text>
          <ReturnGarmentsGrid name="rej" sizes={form.jobOrder.sizes} colours={form.jobOrder.colours} available={form.rejectsAvailable} value={rejects} onChange={setRejects} />
          <Text strong style={{ display: 'block', marginTop: 12 }}>Their material back</Text>
          <ReturnLotsGrid lots={form.lots} value={lotQty} onChange={setLotQty} />
          <div style={{ marginTop: 12 }}>
            {form.principal.wasteRule === WASTE_RULE.RETURN
              ? <Space><Text strong>Cutting waste back</Text><InputNumber name="retWaste" min={0} max={form.wasteOnHand} suffix="kg" value={wasteKg} onChange={(v) => setWasteKg(v || 0)} /><Text type="secondary">{fmtQty(form.wasteOnHand)} kg held</Text></Space>
              : <Text type="secondary">This principal&apos;s waste is sold with their consent (Party Stock), so it never goes on the challan.</Text>}
          </div>
          <Descriptions bordered size="small" column={{ xs: 1, md: 4 }} style={{ marginTop: 12 }} items={[
            { key: 'p', label: 'Charged pieces', children: fmtQty(charge.pieces) },
            { key: 't', label: 'Taxable', children: fmtMoney(charge.taxable) },
            { key: 'g', label: form.interState ? `IGST ${charge.gstPct}%` : `CGST + SGST ${charge.gstPct}%`, children: form.interState ? fmtMoney(charge.igst) : `${fmtMoney(charge.cgst)} + ${fmtMoney(charge.sgst)}` },
            { key: 'x', label: 'Job charges', children: <Text strong>{fmtMoney(charge.total)}</Text> },
          ]} />
          {errors.length > 0 && (garments.length || payload.lotLines.length || wasteKg > 0) ? <Alert type="error" showIcon style={{ marginTop: 12 }} title={errors[0].message} /> : null}
        </>
      )}
    </Drawer>
  );
};

export default ReturnDrawer;
