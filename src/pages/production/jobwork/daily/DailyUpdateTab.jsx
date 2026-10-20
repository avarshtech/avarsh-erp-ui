import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App, Card, Col, Collapse, DatePicker, Empty, Result, Row, Select, Skeleton, Space, Switch, Tag, Typography,
} from 'antd';
import dayjs from 'dayjs';
import { getJobVendors } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { errorText, toastUnlessHandled } from '../../../../utils/apiError';
import { DATE_FORMAT } from '../../../../utils/uiConstants';
import { SOURCE, SOURCE_LABEL, toOptions } from '../../../../utils/jobWorkTracker/constants';
import { validateJobCells } from '../../../../utils/jobWorkTracker/sheetRules';
import { RiskTag, StaleTag } from '../components/JwTags';
import { fmtDate } from '../jwFormat';
import useVendorSheet from './useVendorSheet';
import useSheetEdits from './useSheetEdits';
import VendorJobCard from './VendorJobCard';
import SheetSaveBar from './SheetSaveBar';

const { Text } = Typography;

/** One sheet per vendor per day: every open job of the vendor, so a single call covers them all. */
const DailyUpdateTab = ({ refresh, actions, preset }) => {
  const { message } = App.useApp();
  const [vendors, setVendors] = useState([]);
  const [vendorId, setVendorId] = useState(null);
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [source, setSource] = useState(SOURCE.CALL);
  const [changedOnly, setChangedOnly] = useState(false);
  const [serverProblems, setServerProblems] = useState([]);
  const [saving, setSaving] = useState(false);
  const { sheet, loading, error, reload, save } = useVendorSheet({ vendorId, date, refresh });
  const { setCell, setField, discard, view, dirtyIds } = useSheetEdits(sheet);

  useEffect(() => { getJobVendors().then(setVendors).catch(() => {}); }, [refresh]);
  useEffect(() => { if (preset?.vendorId) setVendorId(preset.vendorId); }, [preset]);

  const jobs = useMemo(() => (sheet?.jobs || []).map(view), [sheet, view]);
  const clientProblems = useMemo(() => jobs.filter((j) => j.dirty && !j.readOnly).flatMap((j) => validateJobCells({
    stages: j.stages, colours: j.colours, cells: j.cells, prevCells: j.prevCells, planByColour: j.planByColour, floor: j.floor,
  }).map((e) => ({ jobId: j.jobId, ...e }))), [jobs]);
  const problems = clientProblems.length ? clientProblems : serverProblems;
  const jobNos = useMemo(() => Object.fromEntries(jobs.map((j) => [j.jobId, j.jobNo])), [jobs]);

  const onCell = useCallback((...a) => { setServerProblems([]); setCell(...a); }, [setCell]);

  const doSave = async () => {
    setSaving(true);
    const changed = jobs.filter((j) => j.dirty && !j.readOnly);
    try {
      await save({
        vendorId, date, source,
        jobs: changed.map((j) => ({
          jobId: j.jobId, progressSeq: j.progressSeq, flag: j.flag, revisedDue: j.revisedDue, issueCategory: j.issueCategory,
          remarks: j.remarks, source: j.source || source, noMovement: j.noMovement, cells: j.cells,
        })),
      });
      discard();
      setServerProblems([]);
      message.success(`Saved ${changed.length} job(s) for ${fmtDate(date)}.`);
      actions.changed();
    } catch (e) {
      const details = e.details || [];
      if (details.some((d) => d.code === 'SHEET_STALE')) {
        await reload(); // fresh base figures; the typed edits stay and are re-applied on top
        message.warning('Someone updated a job since you opened the sheet. The figures were refreshed — check and save again.');
      } else toastUnlessHandled(message, e, 'Could not save the sheet.');
      setServerProblems(details.map((d) => ({ ...d, message: d.message })));
    } finally { setSaving(false); }
  };

  const items = jobs.filter((j) => !changedOnly || j.dirty).map((j) => ({
    key: j.jobId,
    label: (
      <Space size={[8, 4]} wrap>
        <Text strong>{j.jobNo}</Text>
        <Text type="secondary">{j.orderNo} · {j.styleNo} {j.styleName}</Text>
        <Text type="secondary">Due {fmtDate(j.revisedDue || j.dueDate)}</Text>
        <RiskTag risk={j.risk} reasons={j.riskReasons} />
        <StaleTag stale={j.stale} lastEntryDate={j.lastEntryDate} />
        {j.dirty && <Tag color="processing">Changed</Tag>}
        {j.readOnly && <Tag>Read-only</Tag>}
      </Space>
    ),
    extra: <Text type="secondary" style={{ fontSize: 12 }}>Last {fmtDate(j.lastEntryDate)}</Text>,
    children: <VendorJobCard job={j} errors={problems.filter((p) => p.jobId === j.jobId)} onCell={onCell} onField={setField} />,
  }));

  return (
    <Card size="small">
      <Row gutter={[12, 12]} align="middle" style={{ marginBottom: 12 }}>
        <Col xs={24} md={9}>
          <Select name="sheetVendor" showSearch optionFilterProp="label" style={{ width: '100%' }} placeholder="Pick the vendor you called or visited" value={vendorId}
            onChange={(v) => { if (dirtyIds.length) message.info('Unsaved changes on the previous vendor were discarded.'); setVendorId(v); }}
            options={vendors.map((v) => ({ value: v.id, label: `${v.name} — ${v.city} (${v.openJobs} open)` }))} />
        </Col>
        <Col xs={12} md={5}>
          <DatePicker name="sheetDate" style={{ width: '100%' }} format={DATE_FORMAT} allowClear={false} value={dayjs(date)}
            disabledDate={(d) => d.isAfter(dayjs(), 'day')} onChange={(d) => setDate(d.format('YYYY-MM-DD'))} />
        </Col>
        <Col xs={12} md={5}>
          <Select name="sheetSource" style={{ width: '100%' }} value={source} onChange={setSource} options={toOptions(SOURCE_LABEL)} />
        </Col>
        <Col xs={24} md={5} style={{ textAlign: 'right' }}>
          <Space><Text type="secondary">Changed only</Text><Switch size="small" checked={changedOnly} onChange={setChangedOnly} /></Space>
        </Col>
      </Row>
      {!vendorId && <Empty description="Pick a vendor to open its daily sheet. Only vendors with open jobs are listed." />}
      {vendorId && error && <Result status="warning" title={errorText({ message: error })} />}
      {vendorId && loading && !sheet && <Skeleton active paragraph={{ rows: 8 }} />}
      {vendorId && sheet && (
        <>
          <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
            {sheet.vendor.contactPerson} · {sheet.vendor.phone}. Enter today&apos;s cumulative figures (so far, not today&apos;s output); untouched jobs are not saved.
          </Text>
          {items.length ? <Collapse items={items} defaultActiveKey={items.slice(0, 2).map((i) => i.key)} /> : <Empty description="No open jobs for this vendor." />}
          <SheetSaveBar dirtyCount={dirtyIds.length} problems={problems} jobNos={jobNos} saving={saving} onSave={doSave} onDiscard={() => { discard(); setServerProblems([]); }} />
        </>
      )}
    </Card>
  );
};

export default DailyUpdateTab;
