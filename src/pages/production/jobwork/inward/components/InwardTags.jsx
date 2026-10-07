import { memo } from 'react';
import { Space, Tag, Tooltip } from 'antd';
import { ClockCircleOutlined, HourglassOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import StatusTag from '../../../../../components/StatusTag';
import {
  JOB_WORK_IN_DOC_STATUS_CONFIG, JOB_WORK_IN_ORDER_STATUS_CONFIG, JOB_WORK_IN_TALLY_STATUS_CONFIG,
} from '../../../../../utils/statusConfig';
import {
  INWARD_STATUS_LABEL, JO_STATUS_LABEL, RETURN_STATUS_LABEL, SCOPE_LABEL, TALLY_STATUS, TALLY_STATUS_LABEL,
} from '../../../../../utils/jobWorkInward/inwardConstants';
import { fmtDate, fmtQty } from '../../jwFormat';

export const JobOrderStatusTag = memo(function JobOrderStatusTag({ status }) {
  return <StatusTag status={status} config={JOB_WORK_IN_ORDER_STATUS_CONFIG} getLabel={(s) => JO_STATUS_LABEL[s]} size="small" />;
});

/** Material In and Return documents share one set of colours. */
export const DocStatusTag = memo(function DocStatusTag({ status }) {
  return <StatusTag status={status} config={JOB_WORK_IN_DOC_STATUS_CONFIG} getLabel={(s) => INWARD_STATUS_LABEL[s] || RETURN_STATUS_LABEL[s]} size="small" />;
});

export const TallyTag = memo(function TallyTag({ tally, overdue }) {
  const tag = (s) => <StatusTag status={s} config={JOB_WORK_IN_TALLY_STATUS_CONFIG} getLabel={(x) => TALLY_STATUS_LABEL[x]} size="small" />;
  if (tally) return <Tooltip title={`Invoice ${tally.invoiceNo} of ${fmtDate(tally.invoiceDate)}`}><span>{tag(TALLY_STATUS.RECORDED)}</span></Tooltip>;
  return (
    <Space size={4} wrap>
      {tag(TALLY_STATUS.PENDING)}
      {overdue && <Tooltip title="Returned more than 30 days ago and not invoiced yet."><Tag color="red">Over 30 days</Tag></Tooltip>}
    </Space>
  );
});

export const ScopeTag = memo(function ScopeTag({ scope }) {
  return <Tag color={scope === 'CMT' ? 'geekblue' : 'purple'}>{SCOPE_LABEL[scope]}</Tag>;
});

/** The order cannot go on until the principal sends the balance (decision 20). */
export const WaitingTag = memo(function WaitingTag({ waiting, shortLines = [] }) {
  if (!waiting) return null;
  return (
    <Tooltip title={shortLines.map((m) => `${m.itemName}: ${fmtQty(m.short)} ${m.uom} short`).join(' · ')}>
      <Tag color="volcano" icon={<HourglassOutlined />}>Waiting for principal</Tag>
    </Tooltip>
  );
});

/** Days since the principal's challan, when material is still not accounted for. */
export const AgeTag = memo(function AgeTag({ level, days }) {
  if (!level) return null;
  let color = 'gold';
  if (level >= 365) color = 'red';
  else if (level >= 330) color = 'volcano';
  return (
    <Tooltip title="Their material has been with us this long without being accounted for; the principal must have it back within a year.">
      <Tag color={color} icon={<ClockCircleOutlined />}>{days ? `${days} days` : `${level}+ days`}</Tag>
    </Tooltip>
  );
});

export const ReadyToCloseTag = memo(function ReadyToCloseTag({ ready }) {
  return ready ? <Tag color="cyan" icon={<SafetyCertificateOutlined />}>Ready to close</Tag> : null;
});
