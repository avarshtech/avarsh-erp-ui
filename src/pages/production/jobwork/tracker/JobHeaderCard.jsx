import { memo } from 'react';
import { Alert, Descriptions, Space, Typography } from 'antd';
import { ISSUE_CATEGORY, ISSUE_CATEGORY_LABEL, STAGE_LABEL } from '../../../../utils/jobWorkTracker/constants';
import { FlagTag, RiskTag, StaleTag, VendorApprovalTag } from '../components/JwTags';
import { fmtDate, fmtQty } from '../jwFormat';

const { Text } = Typography;

/** Who, what and when for one job, with the coordinator's latest flag and issue. */
const JobHeaderCard = memo(function JobHeaderCard({ view }) {
  const { row, job, vendor, snapshot } = view;
  const shareTotal = Object.values(view.shareByColour || {}).reduce((a, b) => a + b, 0);
  const pulledBack = Object.values(view.grid.withdrawn || {}).reduce((a, b) => a + b, 0);
  const buyerTotal = Object.values(view.buyerByColour || {}).reduce((a, b) => a + b, 0);
  const latestRemarks = view.timeline.find((t) => t.kind === 'PROGRESS')?.entry?.remarks;
  const items = [
    { key: 'order', label: 'Order / style', children: `${row.orderNo} · ${row.styleNo} — ${row.styleName}` },
    { key: 'buyer', label: 'Buyer', children: row.buyer },
    { key: 'ship', label: 'Ship date', children: fmtDate(row.shipDate) },
    {
      key: 'vendor', label: 'Vendor', children: (
        <Space orientation="vertical" size={0}>
          <Text>{vendor.name}, {vendor.city}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{vendor.contactPerson} · {vendor.phone}</Text>
          <VendorApprovalTag approval={row.vendorApproval} />
        </Space>
      ),
    },
    { key: 'branch', label: 'Branch', children: row.branchName },
    {
      key: 'share', label: 'Share of the order',
      children: (
        <>
          {fmtQty(shareTotal - pulledBack)} of {fmtQty(buyerTotal)} pcs
          <Text type="secondary"> ({pulledBack ? `${fmtQty(shareTotal)} less ${fmtQty(pulledBack)} pulled back; ` : ''}plan {fmtQty(row.planTotal)} incl. allowance)</Text>
        </>
      ),
    },
    { key: 'start', label: 'Started', children: fmtDate(job.startDate) },
    {
      key: 'due', label: 'Due', children: (
        <>
          {row.noDueDate ? 'No due date' : fmtDate(row.dueDate)}
          {row.revisedDue && <Text type="warning"> → revised {fmtDate(row.revisedDue)}</Text>}
        </>
      ),
    },
    {
      key: 'proj', label: 'Projected finish',
      children: snapshot.projectedDate ? `${fmtDate(snapshot.projectedDate)} (pace of ${STAGE_LABEL[snapshot.bindingStage]})` : '—',
    },
    {
      key: 'status', label: 'Status', span: 3, children: (
        <Space size={[6, 6]} wrap>
          <RiskTag risk={row.risk} reasons={row.riskReasons} readyToClose={row.readyToClose} completed={row.completed} />
          <StaleTag stale={row.stale} lastEntryDate={row.lastEntryDate} />
          {snapshot.latestFlag && <Text type="secondary">Coordinator&apos;s flag</Text>}
          <FlagTag flag={snapshot.latestFlag} />
          <Text type="secondary">Last update {fmtDate(row.lastEntryDate)}</Text>
          {job.closedReason && <Text type="secondary">Closed: {job.closedReason}</Text>}
        </Space>
      ),
    },
  ];
  return (
    <>
      {snapshot.latestIssue && snapshot.latestIssue !== ISSUE_CATEGORY.NONE && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title={ISSUE_CATEGORY_LABEL[snapshot.latestIssue]} description={latestRemarks || undefined} />
      )}
      <Descriptions bordered size="small" column={{ xs: 1, md: 3 }} items={items} />
    </>
  );
});

export default JobHeaderCard;
