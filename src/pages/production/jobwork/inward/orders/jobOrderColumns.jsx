import { Space, Tag, Tooltip, Typography } from 'antd';
import StageChips from '../../components/StageChips';
import { RiskTag } from '../../components/JwTags';
import {
  AgeTag, JobOrderStatusTag, ReadyToCloseTag, ScopeTag, TallyTag, WaitingTag,
} from '../components/InwardTags';
import { fmtDate, fmtMoney, fmtQty } from '../../jwFormat';
import { isAfterDay } from '../../../../../utils/jobWorkTracker/workingDays';

const { Text } = Typography;
const mono = { fontFamily: 'var(--font-mono, monospace)', fontSize: 12 };

/** Columns of the inward Job Orders list. */
const jobOrderColumns = () => [
  {
    title: 'Job order', key: 'order', width: 200, fixed: 'left',
    render: (_, r) => (
      <Space orientation="vertical" size={0}>
        <Text strong style={mono}>{r.orderNo}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>Their ref {r.principalRef}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>{r.styleNo} · {r.styleName}</Text>
      </Space>
    ),
  },
  {
    title: 'Principal', key: 'principal', width: 190,
    render: (_, r) => (
      <Space orientation="vertical" size={2}>
        <Text>{r.principalName}</Text>
        <Space size={4} wrap><ScopeTag scope={r.scope} />{r.interState && <Tooltip title="Their GSTIN is in another state: IGST on job charges."><Tag>Inter-state</Tag></Tooltip>}</Space>
      </Space>
    ),
  },
  { title: 'Progress (so far / order)', key: 'stages', width: 430, render: (_, r) => <StageChips stages={r.stages} /> },
  { title: 'Ready to return', dataIndex: 'readyToReturn', width: 110, align: 'right', render: (v) => <Text strong={v > 0} style={mono}>{fmtQty(v)}</Text> },
  {
    title: 'Due', key: 'due', width: 150,
    render: (_, r) => {
      const late = r.projectedDate && isAfterDay(r.projectedDate, r.dueDate);
      return (
        <Space orientation="vertical" size={0}>
          <Text>{fmtDate(r.dueDate)}</Text>
          {r.projectedDate && <Text type={late ? 'danger' : 'secondary'} style={{ fontSize: 12 }}>Projected {fmtDate(r.projectedDate)}</Text>}
        </Space>
      );
    },
  },
  {
    title: 'Material', key: 'material', width: 180,
    render: (_, r) => (r.waiting ? <WaitingTag waiting shortLines={r.shortLines} /> : (
      <Text type="secondary" style={{ fontSize: 12 }}>{r.shortLines.length ? `Spares short: ${r.shortLines.map((m) => m.itemName).join(', ')}` : 'Covered'}</Text>
    )),
  },
  {
    title: 'Job charges', key: 'charges', width: 160,
    render: (_, r) => (
      <Space orientation="vertical" size={2}>
        <Text style={mono}>{fmtMoney(r.chargesTotal)}</Text>
        {r.unbilled > 0 && <TallyTag tally={null} overdue={r.billingOverdue} />}
      </Space>
    ),
  },
  {
    title: 'Status', key: 'status', width: 200,
    render: (_, r) => (
      <Space size={[4, 4]} wrap>
        <JobOrderStatusTag status={r.status} />
        <RiskTag risk={r.risk} completed={!r.open || r.status === 'RETURNED'} />
        <ReadyToCloseTag ready={r.readyToClose} />
        <AgeTag level={r.ageLevel} />
      </Space>
    ),
  },
];

export default jobOrderColumns;
