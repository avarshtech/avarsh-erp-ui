import { memo } from 'react';
import { Popover, Typography } from 'antd';
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import StickyActionBar from '../../../components/StickyActionBar';
import StatusTag from '../../../components/StatusTag';
import JobWorkActionButtons from '../jobWork/JobWorkActionButtons';
import { JOB_WORK_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel } from '../../../utils/jobWorkPoStatus';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const Stat = ({ label, value }) => <span><Text type="secondary">{label}</Text> <strong>{value}</strong></span>;
const List = ({ items }) => <ul style={{ margin: 0, paddingLeft: 18, maxWidth: 520 }}>{items.map((m) => <li key={m}>{m}</li>)}</ul>;

/**
 * Sticky action bar (PRD §19): on a draft, the live validation summary — the issue count
 * with the list, or "ready to submit" — then lines, PO qty, grand total and status, and
 * the actions (gpoActionButtons). Submit stays disabled while issues remain.
 */
const GpoActionBar = memo(function GpoActionBar({ doc, value, checks, buttons, busy, errors, on, openDialog }) {
  const blocking = checks?.blocking || [];
  const warnings = checks?.warnings || [];
  const draft = doc.status === 'DRAFT';
  const status = blocking.length ? (
    <Popover title="Fix before submitting" content={<List items={blocking} />}>
      <Text type="danger" style={{ cursor: 'help' }}><WarningOutlined /> {blocking.length} issue{blocking.length > 1 ? 's' : ''}: {blocking[0]}{blocking.length > 1 ? ' …' : ''}</Text>
    </Popover>
  ) : <Text type="success"><CheckCircleOutlined /> All lines within balance · ready to submit</Text>;
  return (
    <StickyActionBar
      errors={errors}
      summary={(
        <>
          {draft && doc.lines.length > 0 && status}
          {warnings.length > 0 && <Popover title="Warnings" content={<List items={warnings} />}><Text type="warning" style={{ cursor: 'help' }}>{warnings.length} warning{warnings.length > 1 ? 's' : ''}</Text></Popover>}
          <Stat label="Lines" value={doc.lines.length} />
          <Stat label="PO qty" value={`${n(doc.lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0))} pcs`} />
          <Stat label="Grand total" value={`₹${value.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
          <StatusTag status={doc.status} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />
        </>
      )}
    >
      <JobWorkActionButtons buttons={buttons} busy={busy} on={on} openDialog={openDialog} />
    </StickyActionBar>
  );
});

export default GpoActionBar;
