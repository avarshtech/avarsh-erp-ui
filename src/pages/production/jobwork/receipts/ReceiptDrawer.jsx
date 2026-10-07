import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, App, Button, Col, DatePicker, Drawer, Input, Row, Select, Skeleton, Space, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { getReceiptForm, postReceipt } from '../../../../services/production/jobwork/jobWorkReceiptApi';
import { searchJobs } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../utils/uiConstants';
import { STAGE_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { validateReceipt } from '../../../../utils/jobWorkTracker/sheetRules';
import ReceiptGrid from './ReceiptGrid';

const { Text } = Typography;
const today = () => dayjs().format('YYYY-MM-DD');

/** Receive goods from a vendor against a job (the job can be picked here when opened from the list). */
const ReceiptDrawer = ({ jobId: givenJobId, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [jobId, setJobId] = useState(givenJobId);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState(null);
  const [stage, setStage] = useState(null);
  const [date, setDate] = useState(today());
  const [dc, setDc] = useState('');
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!givenJobId) searchJobs({ status: 'OPEN', size: 100 }).then((p) => setJobs(p.content)); }, [givenJobId]);
  useEffect(() => {
    if (!jobId) return;
    getReceiptForm(jobId).then((f) => { setForm(f); setStage(f.finalStage); }).catch((e) => toastUnlessHandled(message, e));
  }, [jobId, message]);
  useEffect(() => {
    if (!form || !stage) return;
    setRows(form.colours.flatMap((colour) => form.sizes.map((size) => ({
      colour, size, plan: form.planBySize?.[stage]?.[colour]?.[size] || 0, already: form.receivedBySize[`${stage}|${colour}|${size}`] || 0,
      good: 0, alter: 0, rejected: 0, rejectSource: null,
    }))).filter((r) => r.plan > 0 || r.already > 0));
  }, [form, stage]);

  const onRow = useCallback((i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r))), []);
  const errors = useMemo(() => (form ? validateReceipt({
    stage, stages: form.stages, lines: rows, planByColour: form.planByColour, received: form.received,
    receiptDate: date, today: today(), jobStart: form.startDate, vendorDcNo: dc,
  }) : []), [form, stage, rows, date, dc]);
  const blocking = errors.filter((e) => !/at least one/.test(e.message) || rows.some((r) => r.good || r.alter || r.rejected));

  const submit = async () => {
    setSaving(true);
    try {
      const res = await postReceipt(jobId, { stage, receiptDate: date, vendorDcNo: dc, vendorDcDate: date, lines: rows });
      message.success(`${res.receiptNo} posted${res.jobStatus === 'COMPLETED' ? ' — the job is complete' : ''}.`);
      onSaved();
      onClose();
    } catch (e) { toastUnlessHandled(message, e, 'Could not post the receipt.'); } finally { setSaving(false); }
  };

  const temporary = form && stage && stage !== form.finalStage;
  return (
    <Drawer open size={980} destroyOnHidden onClose={onClose} title={form ? `Receive from ${form.vendorName} — ${form.jobNo}` : 'Receive from vendor'}
      extra={<Space><Button onClick={onClose}>Close</Button><Button type="primary" loading={saving} disabled={!form || errors.length > 0} onClick={submit}>Post receipt</Button></Space>}>
      {!givenJobId && (
        <Select name="receiptJob" showSearch optionFilterProp="label" style={{ width: '100%', marginBottom: 12 }} placeholder="Which job are these goods for?"
          value={jobId} onChange={setJobId} options={jobs.map((j) => ({ value: j.id, label: `${j.jobNo} — ${j.vendorName} — ${j.orderNo} ${j.styleNo}` }))} />
      )}
      {jobId && !form && <Skeleton active />}
      {form && (
        <>
          <Row gutter={12} style={{ marginBottom: 12 }}>
            <Col xs={24} md={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>Stage the goods are at</Text>
              <Select name="receiptStage" style={{ width: '100%' }} value={stage} onChange={setStage}
                options={form.stages.map((s) => ({ value: s, label: `${STAGE_LABEL[s]}${s === form.finalStage ? ' (finished)' : ' — temporary transfer'}` }))} />
            </Col>
            <Col xs={12} md={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>Received on</Text>
              <DatePicker name="receiptDate" style={{ width: '100%' }} format={DATE_FORMAT} allowClear={false} value={dayjs(date)}
                disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(d) => setDate(d.format('YYYY-MM-DD'))} />
            </Col>
            <Col xs={12} md={8}>
              <Text type="secondary" style={{ fontSize: 12 }}>Vendor DC no.</Text>
              <Input name="receiptDc" value={dc} onChange={(e) => setDc(e.target.value)} placeholder="As printed on the vendor's challan" />
            </Col>
          </Row>
          {temporary && <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Temporary transfer" description="Goods at an earlier stage come in for an in-house step and go back to the vendor. They never complete, close or pay the job. To keep pieces in-house for good, raise a pull-back." />}
          <ReceiptGrid rows={rows} onChange={onRow} overColours={errors.filter((e) => e.colour).map((e) => e.colour)} />
          {blocking.length > 0 && <Alert type="error" showIcon style={{ marginTop: 12 }} title={blocking[0].message} description={blocking.length > 1 ? `${blocking.length - 1} more problem(s)` : undefined} />}
        </>
      )}
    </Drawer>
  );
};

export default ReceiptDrawer;
