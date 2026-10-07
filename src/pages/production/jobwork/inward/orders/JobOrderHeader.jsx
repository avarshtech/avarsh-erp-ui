import { memo } from 'react';
import {
  Alert, Descriptions, Space, Tag, Typography,
} from 'antd';
import { PP_SAMPLE_LABEL, WASTE_RULE_LABEL } from '../../../../../utils/jobWorkInward/inwardConstants';
import { concessionNote } from '../../../../../utils/jobWorkInward/chargeRules';
import { RiskTag } from '../../components/JwTags';
import {
  AgeTag, JobOrderStatusTag, ReadyToCloseTag, ScopeTag, WaitingTag,
} from '../components/InwardTags';
import { fmtDate, fmtMoney, fmtQty } from '../../jwFormat';

const { Text } = Typography;

/** Who the work is for, on what terms, and where it stands. */
const JobOrderHeader = memo(function JobOrderHeader({ view }) {
  const { jo, principal, row, interState, closeCheck } = view;
  const sizeRates = jo.ratesBySize ? Object.entries(jo.ratesBySize).map(([s, r]) => `${s} ${fmtMoney(r)}`).join(' · ') : null;
  const note = concessionNote(principal, jo.gstRatePct);
  const items = [
    {
      key: 'p', label: 'Principal', children: (
        <Space orientation="vertical" size={0}>
          <Text>{principal.name}, {principal.city}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>GSTIN {principal.gstin || '— (unregistered)'} · {principal.state}</Text>
        </Space>
      ),
    },
    { key: 'ref', label: 'Their order', children: jo.principalRef },
    { key: 'style', label: 'Style', children: `${jo.styleNo} — ${jo.styleName}` },
    { key: 'scope', label: 'Work', children: <ScopeTag scope={jo.scope} /> },
    { key: 'qty', label: 'Order qty', children: `${fmtQty(row.qty)} pcs` },
    { key: 'rate', label: 'Job rate', children: sizeRates || `${fmtMoney(jo.rate)} / pc` },
    { key: 'tax', label: 'SAC / GST', children: `${jo.sacCode} · ${jo.gstRatePct}% ${interState ? 'IGST' : 'CGST + SGST'}` },
    { key: 'waste', label: 'Cutting waste', children: WASTE_RULE_LABEL[principal.wasteRule] },
    { key: 'pp', label: 'PP sample', children: `${PP_SAMPLE_LABEL[jo.ppSample.status]}${jo.ppSample.ref ? ` — ${jo.ppSample.ref}` : ''}` },
    { key: 'due', label: 'Due', children: <>{fmtDate(jo.dueDate)}{row.projectedDate && <Text type="secondary"> · projected {fmtDate(row.projectedDate)}</Text>}</> },
    { key: 'received', label: 'Order received', children: fmtDate(jo.orderDate) },
    {
      key: 'status', label: 'Status', children: (
        <Space size={[6, 6]} wrap>
          <JobOrderStatusTag status={row.status} />
          <RiskTag risk={row.risk} completed={!row.open || row.status === 'RETURNED'} />
          <WaitingTag waiting={row.waiting} shortLines={row.shortLines} />
          <ReadyToCloseTag ready={row.readyToClose} />
          <AgeTag level={row.ageLevel} />
          {jo.closedReason && <Tag>{jo.closedReason}</Tag>}
        </Space>
      ),
    },
  ];
  return (
    <>
      {row.waiting && (
        <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Waiting for the principal — we do not buy their material"
          description={row.shortLines.map((m) => `${m.itemName}: ${fmtQty(m.short)} ${m.uom} short`).join(' · ')} />
      )}
      {note && <Alert type="info" showIcon style={{ marginBottom: 12 }} title={note} />}
      {row.status === 'RETURNED' && row.open && closeCheck.blockers.length > 0 && (
        <Alert type="info" showIcon style={{ marginBottom: 12 }} title="All pieces are back; before closing" description={closeCheck.blockers.join(' ')} />
      )}
      <Descriptions bordered size="small" column={{ xs: 1, md: 3 }} items={items} />
    </>
  );
});

export default JobOrderHeader;
