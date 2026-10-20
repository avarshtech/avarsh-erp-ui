import { Space, Tag, Tooltip, Typography } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import StageChips from '../components/StageChips';
import {
  JobStatusTag, RiskTag, StaleTag, VendorApprovalTag,
} from '../components/JwTags';
import { fmtByUom, fmtDate, fmtQty } from '../jwFormat';
import { isAfterDay } from '../../../../utils/jobWorkTracker/workingDays';

const { Text } = Typography;
const mono = { fontFamily: 'var(--font-mono, monospace)', fontSize: 12 };

/** Columns of the job tracker. `onOpenPullBack` opens a job's open pull-back from its tag. */
export const jobTrackerColumns = ({ onOpenPullBack }) => [
  {
    title: 'Job', key: 'job', width: 190, fixed: 'left',
    render: (_, r) => (
      <Space orientation="vertical" size={0}>
        <Text strong style={mono}>{r.jobNo}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{r.orderNo} · {r.styleNo}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{r.styleName}</Text>
        {r.principal && (
          <Tooltip title="Work we do for this principal; the panels at the vendor are their goods (Inward side).">
            <Tag color="purple" style={{ marginTop: 2 }}>Principal&apos;s goods · {r.principal}</Tag>
          </Tooltip>
        )}
      </Space>
    ),
  },
  {
    title: 'Vendor', key: 'vendor', width: 190,
    render: (_, r) => (
      <Space orientation="vertical" size={2}>
        <Text>{r.vendorName}</Text>
        <VendorApprovalTag approval={r.vendorApproval} />
      </Space>
    ),
  },
  { title: 'Progress (so far / plan)', key: 'stages', width: 420, render: (_, r) => <StageChips stages={r.stages} /> },
  {
    title: 'Received', key: 'received', width: 120, align: 'right',
    render: (_, r) => (
      <Tooltip title={`${fmtQty(r.finalGood)} good · ${fmtQty(r.finalRejected)} rejected · ${fmtQty(r.finalAlter)} handed back for alteration`}>
        <Space orientation="vertical" size={0} style={{ alignItems: 'flex-end' }}>
          <Text style={mono}>{fmtQty(r.finalGood + r.finalRejected)} / {fmtQty(r.planTotal)}</Text>
          {r.alterationPct > 0 && <Text type="secondary" style={{ fontSize: 11 }}>alter {r.alterationPct}%</Text>}
        </Space>
      </Tooltip>
    ),
  },
  {
    title: 'Due', key: 'due', width: 150,
    render: (_, r) => {
      if (r.noDueDate) return <Tag>No due date</Tag>;
      const late = r.projectedDate && isAfterDay(r.projectedDate, r.revisedDue || r.dueDate);
      return (
        <Space orientation="vertical" size={0}>
          <Text delete={Boolean(r.revisedDue)} type={r.revisedDue ? 'secondary' : undefined}>{fmtDate(r.dueDate)}</Text>
          {r.revisedDue && <Text>Revised {fmtDate(r.revisedDue)}</Text>}
          {r.projectedDate && (
            <Text type={late ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>Projected {fmtDate(r.projectedDate)}</Text>
          )}
        </Space>
      );
    },
  },
  {
    title: 'Status', key: 'status', width: 170,
    render: (_, r) => (
      <Space size={[4, 4]} wrap>
        {r.status === 'IN_PROGRESS' || r.status === 'OPEN'
          ? <RiskTag risk={r.risk} reasons={r.riskReasons} readyToClose={r.readyToClose} completed={r.completed} />
          : <JobStatusTag status={r.status} />}
        <StaleTag stale={r.stale} lastEntryDate={r.lastEntryDate} />
        {r.openPullBack && (
          <Tag color="blue" icon={<SwapOutlined />} style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onOpenPullBack(r.openPullBack.id); }}>
            {r.openPullBack.pbNo}
          </Tag>
        )}
      </Space>
    ),
  },
  {
    title: 'Last update', key: 'last', width: 120,
    render: (_, r) => <Text type={r.stale ? 'warning' : 'secondary'}>{fmtDate(r.lastEntryDate)}</Text>,
  },
  {
    title: 'Materials sent', key: 'materials', width: 200,
    render: (_, r) => <Text type="secondary" style={{ fontSize: 12 }}>{fmtByUom(r.materials?.byUom)}</Text>,
  },
];

export default jobTrackerColumns;
