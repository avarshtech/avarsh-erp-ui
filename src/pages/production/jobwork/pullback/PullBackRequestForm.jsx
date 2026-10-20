import { useMemo, useState } from 'react';
import {
  Alert, App, Button, Col, DatePicker, Input, Popconfirm, Row, Select, Space, Typography,
} from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  cancelPullBack, createPullBack, submitPullBack, updatePullBack,
} from '../../../../services/production/jobwork/jobWorkPullBackApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../utils/uiConstants';
import { PULLBACK_REASON_LABEL, PULLBACK_STATUS, toOptions } from '../../../../utils/jobWorkTracker/constants';
import { validatePullBackLines } from '../../../../utils/jobWorkTracker/pullBackRules';
import { fmtDate, fmtQty, lineKey } from '../jwFormat';
import PullBackLines from './PullBackLines';

const { Text } = Typography;
const toMap = (lines, field) => Object.fromEntries((lines || []).map((l) => [lineKey(l.colour, l.stage), Number(l[field]) || 0]));
const Label = ({ children }) => <Text type="secondary" style={{ fontSize: 12, display: 'block' }}>{children}</Text>;

/** A new, draft or referred-back request: reason, dates and lines; save it or send it for approval. */
const PullBackRequestForm = ({ form, pb, onSaved }) => {
  const { message } = App.useApp();
  const suggested = useMemo(() => toMap(form.suggestion, 'suggested'), [form]);
  const [values, setValues] = useState(() => (pb ? toMap(pb.lines, 'requested') : suggested));
  const [head, setHead] = useState({
    reason: pb?.reason, targetDate: pb?.targetDate || form.targetDate, vendorNewDue: pb?.vendorNewDue || null, remarks: pb?.remarks || '',
  });
  const [busy, setBusy] = useState(null);
  const set = (p) => setHead((h) => ({ ...h, ...p }));

  const lines = Object.entries(values).filter(([, q]) => q > 0).map(([k, q]) => {
    const [colour, stage] = k.split('|');
    return { colour, stage, requested: q, suggested: suggested[k] || 0 };
  });
  const { errors, warnings } = validatePullBackLines({ lines, stages: form.stages, available: form.available, pieces: form.pieces });
  const pace = Math.min(...Object.values(form.rates || {}).filter((r) => r > 0));
  const suggestedTotal = Object.values(suggested).reduce((a, b) => a + b, 0);
  const referred = pb?.status === PULLBACK_STATUS.REFERRED_BACK && [...pb.history].reverse().find((h) => h.action === 'REFERRED_BACK');

  const save = async (submit) => {
    setBusy(submit ? 'submit' : 'save');
    let id = pb?.id;
    try {
      if (pb) await updatePullBack(pb.id, { ...head, lines });
      else id = (await createPullBack(form.jobId, { ...head, lines })).id;
      if (submit) await submitPullBack(id);
      message.success(submit ? 'Sent for manager approval.' : 'Draft saved.');
    } catch (e) { toastUnlessHandled(message, e); } finally {
      setBusy(null);
      if (id) onSaved(id);
    }
  };
  const cancel = async () => {
    try { await cancelPullBack(pb.id, { reason: '' }); message.success(`${pb.pbNo} cancelled.`); onSaved(pb.id); } catch (e) { toastUnlessHandled(message, e); }
  };

  return (
    <>
      {referred && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={`Referred back by ${referred.by}`} description={referred.comment} />}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24} md={6}><Label>Reason</Label><Select name="pbReason" style={{ width: '100%' }} placeholder="Why pull back?" value={head.reason} options={toOptions(PULLBACK_REASON_LABEL)} onChange={(v) => set({ reason: v })} /></Col>
        <Col xs={12} md={6}><Label>Finish in-house by</Label><DatePicker name="pbTarget" style={{ width: '100%' }} format={DATE_FORMAT} value={head.targetDate ? dayjs(head.targetDate) : null} onChange={(d) => set({ targetDate: d?.format('YYYY-MM-DD') || null })} /></Col>
        <Col xs={12} md={6}><Label>Vendor&apos;s new date for what stays</Label><DatePicker name="pbVendorDue" style={{ width: '100%' }} format={DATE_FORMAT} value={head.vendorNewDue ? dayjs(head.vendorNewDue) : null} onChange={(d) => set({ vendorNewDue: d?.format('YYYY-MM-DD') || null })} /></Col>
        <Col xs={24} md={6}><Label>Remarks</Label><Input name="pbRemarks" value={head.remarks} onChange={(e) => set({ remarks: e.target.value })} placeholder="Who finishes it, which line" /></Col>
      </Row>
      <Alert
        type={suggestedTotal ? 'info' : 'success'}
        showIcon
        icon={<BulbOutlined />}
        style={{ marginBottom: 12 }}
        title={suggestedTotal ? `Suggested: pull back ${fmtQty(suggestedTotal)} pieces, least-advanced first` : 'At its current pace the vendor finishes in time — nothing is suggested'}
        description={`Slowest stage ${Number.isFinite(pace) ? `${fmtQty(Math.round(pace))} pcs/day` : 'not moving'}; target ${fmtDate(form.targetDate)} (due or ship date less 3 working days). Can still pull back: ${Object.entries(form.available).map(([c, q]) => `${c} ${fmtQty(q)}`).join(' · ')}.`}
        action={suggestedTotal ? <Button size="small" onClick={() => setValues(suggested)}>Use suggestion</Button> : null}
      />
      <PullBackLines form={form} values={values} suggested={suggested} onChange={(k, q) => setValues((v) => ({ ...v, [k]: q }))}
        badColours={errors.filter((e) => e.colour).map((e) => e.colour)} />
      {errors.length > 0 && lines.length > 0 && <Alert type="error" showIcon style={{ marginTop: 12 }} title={errors.map((e) => e.message).join(' ')} />}
      {warnings.length > 0 && <Alert type="warning" showIcon style={{ marginTop: 12 }} title="Above what the last update shows — the vendor may have moved on" description={warnings.map((w) => w.message).join(' ')} />}
      <Space style={{ marginTop: 16, width: '100%', justifyContent: 'flex-end' }} wrap>
        {!head.reason && <Text type="secondary">Pick a reason to send it for approval.</Text>}
        {pb && <Popconfirm title={`Cancel ${pb.pbNo}?`} onConfirm={cancel}><Button danger>Cancel request</Button></Popconfirm>}
        <Button loading={busy === 'save'} disabled={!!busy} onClick={() => save(false)}>Save draft</Button>
        <Button type="primary" loading={busy === 'submit'} disabled={!!busy || errors.length > 0 || !head.reason} onClick={() => save(true)}>Send for approval</Button>
      </Space>
    </>
  );
};

export default PullBackRequestForm;
