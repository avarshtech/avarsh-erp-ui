import { useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Col, DatePicker, Drawer, Input, InputNumber, Row, Segmented, Select, Space, Switch, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { createJobOrder, listPrincipals } from '../../../../../services/production/jobwork/jobWorkInwardApi';
import { toastUnlessHandled } from '../../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../../utils/uiConstants';
import {
  DEFAULT_GST_PCT, DEFAULT_SAC, PP_SAMPLE, PP_SAMPLE_LABEL, SCOPE, SCOPE_LABEL, toOptions,
} from '../../../../../utils/jobWorkInward/inwardConstants';
import { typicalMaterialLines, validateJobOrder } from '../../../../../utils/jobWorkInward/orderRules';
import { concessionNote } from '../../../../../utils/jobWorkInward/chargeRules';
import QtyMatrixInput from './QtyMatrixInput';
import MaterialLinesEditor from './MaterialLinesEditor';

const { Text } = Typography;
const SIZE_SETS = { adult: ['S', 'M', 'L', 'XL'], kids: ['2Y', '4Y', '6Y', '8Y'] };
const Label = ({ children }) => <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{children}</Text>;
const START = {
  principalId: null, principalRef: '', styleNo: '', styleName: '', scope: SCOPE.CMT, sizeSet: 'adult', colours: [{ key: 'c0', colour: '', qty: {} }],
  rate: null, bySize: false, ratesBySize: {}, sacCode: DEFAULT_SAC, gstRatePct: DEFAULT_GST_PCT, dueDate: null,
  ppSample: { status: PP_SAMPLE.NOT_REQUIRED, ref: '' }, materials: [],
};

/** Preview of the Order form with type "Job work": no costing, a job rate, and who supplies each material. */
const NewJobOrderDrawer = ({ onClose, onSaved }) => {
  const { message } = App.useApp();
  const [f, setF] = useState(START);
  const [principals, setPrincipals] = useState([]);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (p) => setF((x) => ({ ...x, ...p }));
  useEffect(() => { listPrincipals().then(setPrincipals).catch(() => {}); }, []);

  const principal = principals.find((p) => p.id === f.principalId);
  const sizes = SIZE_SETS[f.sizeSet];
  const payload = useMemo(() => ({ ...f, sizes, ratesBySize: f.bySize ? f.ratesBySize : null }), [f, sizes]);
  const errors = validateJobOrder(payload, dayjs().format('YYYY-MM-DD'));
  const note = principal && concessionNote(principal, f.gstRatePct);

  const save = async () => {
    setTried(true);
    if (errors.length) return;
    setBusy(true);
    try {
      const res = await createJobOrder(payload);
      message.success(`${res.orderNo} created — waiting for the principal's material.`);
      onSaved(res.id);
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };

  return (
    <Drawer open size={1000} destroyOnHidden onClose={onClose} title="New job order (an Order of type Job work)"
      extra={<Space><Button onClick={onClose}>Close</Button><Button type="primary" loading={busy} onClick={save}>Create order</Button></Space>}>
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title="No costing sheet: the price is the job rate. The principal's material lines never go to a purchase PO." />
      <Row gutter={[12, 12]}>
        <Col xs={24} md={8}><Label>Principal</Label><Select name="joPrincipal" style={{ width: '100%' }} placeholder="Who is the work for?" value={f.principalId} options={principals.map((p) => ({ value: p.id, label: p.name }))} onChange={(v) => set({ principalId: v, gstRatePct: principals.find((p) => p.id === v)?.gstin ? DEFAULT_GST_PCT : 18 })} /></Col>
        <Col xs={24} md={8}><Label>Their order reference</Label><Input name="joRef" value={f.principalRef} onChange={(e) => set({ principalRef: e.target.value })} placeholder="Their PO / work order no." /></Col>
        <Col xs={24} md={8}><Label>Due back</Label><DatePicker name="joDue" style={{ width: '100%' }} format={DATE_FORMAT} value={f.dueDate ? dayjs(f.dueDate) : null} disabledDate={(d) => d.isBefore(dayjs(), 'day')} onChange={(d) => set({ dueDate: d?.format('YYYY-MM-DD') || null })} /></Col>
        <Col xs={12} md={6}><Label>Style no.</Label><Input name="joStyleNo" value={f.styleNo} onChange={(e) => set({ styleNo: e.target.value })} /></Col>
        <Col xs={12} md={8}><Label>Style name</Label><Input name="joStyleName" value={f.styleName} onChange={(e) => set({ styleName: e.target.value })} /></Col>
        <Col xs={24} md={10}><Label>What they send</Label><Segmented value={f.scope} options={toOptions(SCOPE_LABEL)} onChange={(v) => set({ scope: v })} /></Col>
        <Col span={24}>
          <Space style={{ marginBottom: 6 }}><Label>Sizes</Label><Segmented size="small" value={f.sizeSet} options={[{ value: 'adult', label: 'S – XL' }, { value: 'kids', label: '2Y – 8Y' }]} onChange={(v) => set({ sizeSet: v, ratesBySize: {} })} /></Space>
          <QtyMatrixInput sizes={sizes} colours={f.colours} onChange={(colours) => set({ colours })} />
        </Col>
        <Col xs={12} md={6}><Label>Job rate (₹ / piece)</Label><InputNumber name="joRate" min={0} style={{ width: '100%' }} value={f.rate} onChange={(v) => set({ rate: v })} /></Col>
        <Col xs={12} md={6}><Label>Different rate by size</Label><Switch checked={f.bySize} onChange={(v) => set({ bySize: v })} /></Col>
        <Col xs={12} md={6}><Label>SAC</Label><Input name="joSac" value={f.sacCode} onChange={(e) => set({ sacCode: e.target.value })} /></Col>
        <Col xs={12} md={6}><Label>GST % {principal ? `(${principal.interState ? 'IGST' : 'CGST + SGST'})` : ''}</Label><InputNumber name="joGst" min={0} max={28} style={{ width: '100%' }} value={f.gstRatePct} onChange={(v) => set({ gstRatePct: v })} /></Col>
        {f.bySize && sizes.map((s) => (
          <Col key={s} xs={6} md={3}><Label>{s}</Label><InputNumber name={`joRate-${s}`} min={0} style={{ width: '100%' }} value={f.ratesBySize[s]} onChange={(v) => set({ ratesBySize: { ...f.ratesBySize, [s]: v } })} /></Col>
        ))}
        <Col xs={12} md={6}><Label>PP sample</Label><Select name="joPp" style={{ width: '100%' }} value={f.ppSample.status} options={toOptions(PP_SAMPLE_LABEL)} onChange={(v) => set({ ppSample: { ...f.ppSample, status: v } })} /></Col>
        <Col xs={12} md={18}><Label>Approved by (who, when)</Label><Input name="joPpRef" value={f.ppSample.ref} disabled={f.ppSample.status !== PP_SAMPLE.APPROVED} onChange={(e) => set({ ppSample: { ...f.ppSample, ref: e.target.value } })} /></Col>
        <Col span={24}>
          <Space style={{ marginBottom: 6 }}>
            <Label>Materials</Label>
            <Button size="small" onClick={() => set({ materials: typicalMaterialLines(f.scope, f.colours.map((c) => c.colour)) })}>Fill typical lines</Button>
          </Space>
          <MaterialLinesEditor lines={f.materials} colours={f.colours.map((c) => c.colour)} onChange={(materials) => set({ materials })} />
        </Col>
      </Row>
      {note && <Alert type="warning" showIcon style={{ marginTop: 12 }} title={note} />}
      {tried && errors.length > 0 && <Alert type="error" showIcon style={{ marginTop: 12 }} title={errors[0].message} description={errors.length > 1 ? errors.slice(1).map((e) => e.message).join(' ') : undefined} />}
    </Drawer>
  );
};

export default NewJobOrderDrawer;
