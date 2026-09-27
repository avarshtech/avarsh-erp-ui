import { memo } from 'react';
import { Typography } from 'antd';
import StickyActionBar from '../../../components/StickyActionBar';
import JobWorkActionButtons from '../jobWork/JobWorkActionButtons';
import StatusTag from '../../../components/StatusTag';
import { JOB_WORK_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel } from '../../../utils/jobWorkPoStatus';
import { balanceBlock } from '../../../utils/cutPanelPoCalc';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const Stat = ({ label, value }) => <span><Text type="secondary">{label}</Text> <strong>{value}</strong></span>;

/**
 * ⑥ Sticky action bar (PRD §18.1/18.2): process, lines, PO qty, balance after this PO,
 * PO value and status, always visible; then the actions `buttons` lists (cppActionButtons).
 */
const CppActionBar = memo(function CppActionBar({ doc, ctx, value, buttons, busy, errors, on, openDialog }) {
  const live = doc.lines.filter((l) => Number(l.poQty) > 0);
  const balanceAfter = balanceBlock(doc, ctx).reduce((s, b) => s + b.balanceAfter, 0);
  return (
    <StickyActionBar
      errors={errors}
      summary={(
        <>
          <Stat label="Process" value={doc.process?.label ?? doc.process?.name ?? '—'} />
          <Stat label="Lines" value={live.length} />
          <Stat label="PO qty" value={`${n(live.reduce((s, l) => s + Number(l.poQty), 0))} pcs`} />
          <Stat label="Balance after" value={n(balanceAfter)} />
          <Stat label="PO value" value={`₹${value.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
          <StatusTag status={doc.status} config={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel} />
        </>
      )}
    >
      <JobWorkActionButtons buttons={buttons} busy={busy} on={on} openDialog={openDialog} />
    </StickyActionBar>
  );
});

export default CppActionBar;
