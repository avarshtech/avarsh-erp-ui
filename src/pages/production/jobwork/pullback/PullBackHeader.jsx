import { memo } from 'react';
import { Button, Descriptions, Steps } from 'antd';
import { PULLBACK_REASON_LABEL, PULLBACK_STATUS } from '../../../../utils/jobWorkTracker/constants';
import { PullBackStatusTag } from '../components/JwTags';
import { fmtDate } from '../jwFormat';

const STEP = { DRAFT: 0, REFERRED_BACK: 0, PENDING_APPROVAL: 1, REJECTED: 1, APPROVED: 2, SETTLED: 3 };
const STEP_BEFORE_CANCEL = { SUBMITTED: 1, APPROVED: 2 };

/** Request → manager approval → goods back → settle, with where this pull-back stands. */
export const PullBackSteps = memo(function PullBackSteps({ status, history = [] }) {
  let current = STEP[status] ?? 0;
  if (status === PULLBACK_STATUS.CANCELLED) {
    const prior = [...history].reverse().find((h) => h.action !== 'CANCELLED');
    current = STEP_BEFORE_CANCEL[prior?.action] ?? 0;
  }
  let stepStatus = 'process';
  if (status === PULLBACK_STATUS.SETTLED) stepStatus = 'finish';
  if (status === PULLBACK_STATUS.REJECTED || status === PULLBACK_STATUS.CANCELLED) stepStatus = 'error';
  return (
    <Steps
      size="small"
      current={current}
      status={stepStatus}
      style={{ marginBottom: 16 }}
      items={[
        { title: 'Request', content: 'Colour × stage, suggested qty' },
        { title: 'Manager approval', content: 'Moves no goods' },
        { title: 'Goods back', content: 'As trucks arrive' },
        { title: 'Settle', content: 'Back to vendor or write off' },
      ]}
    />
  );
});

/** Who, what and when for a pull-back past the request stage. */
const PullBackHeader = memo(function PullBackHeader({ pb, onOpenJob }) {
  const items = [
    { key: 'job', label: 'Job', children: <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={onOpenJob}>{pb.job.jobNo}</Button> },
    { key: 'vendor', label: 'Vendor', children: `${pb.vendor.name} · ${pb.vendor.contactPerson} ${pb.vendor.phone}` },
    { key: 'order', label: 'Order / style', children: `${pb.order.orderNo} · ${pb.order.styleNo} ${pb.order.styleName}` },
    { key: 'ship', label: 'Ship date', children: fmtDate(pb.order.shipDate) },
    { key: 'due', label: 'Job due / revised', children: `${fmtDate(pb.job.dueDate)} / ${fmtDate(pb.job.revisedDue)}` },
    { key: 'target', label: 'Finish in-house by', children: fmtDate(pb.targetDate) },
    { key: 'newDue', label: 'Vendor\'s new date', children: fmtDate(pb.vendorNewDue) },
    { key: 'reason', label: 'Reason', children: PULLBACK_REASON_LABEL[pb.reason] || '—' },
    { key: 'raised', label: 'Raised', children: `${pb.requestedBy} · ${fmtDate(pb.requestedAt)}` },
    { key: 'branch', label: 'Made in-house at', children: pb.job.branchName || '—' },
    { key: 'status', label: 'Status', children: <PullBackStatusTag status={pb.status} /> },
    ...(pb.remarks ? [{ key: 'remarks', label: 'Remarks', span: 'filled', children: pb.remarks }] : []),
  ];
  return <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }} items={items} style={{ marginBottom: 12 }} />;
});

export default PullBackHeader;
