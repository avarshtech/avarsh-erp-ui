import { memo } from 'react';
import { Space, Tag, Tooltip } from 'antd';
import { ClockCircleOutlined, SafetyCertificateOutlined, StopOutlined } from '@ant-design/icons';
import StatusTag from '../../../../components/StatusTag';
import {
  JOB_WORK_FLAG_CONFIG, JOB_WORK_JOB_STATUS_CONFIG, JOB_WORK_PULLBACK_STATUS_CONFIG, JOB_WORK_RECEIPT_STATUS_CONFIG,
  JOB_WORK_RETURN_STATUS_CONFIG, JOB_WORK_RISK_CONFIG,
} from '../../../../utils/statusConfig';
import {
  FLAG_LABEL, JOB_STATUS_LABEL, PULLBACK_STATUS_LABEL, RECEIPT_STATUS_LABEL, RETURN_STATUS_LABEL, RISK_LABEL, RISK_REASON_LABEL,
} from '../../../../utils/jobWorkTracker/constants';
import { fmtDate } from '../jwFormat';

export const JobStatusTag = memo(function JobStatusTag({ status }) {
  return <StatusTag status={status} config={JOB_WORK_JOB_STATUS_CONFIG} getLabel={(s) => JOB_STATUS_LABEL[s]} size="small" />;
});

/** Risk with its reasons in a tooltip; a ready-to-close or completed job shows that instead. */
export const RiskTag = memo(function RiskTag({ risk, reasons = [], readyToClose, completed }) {
  if (completed) return null;
  if (readyToClose) return <Tag color="cyan" icon={<SafetyCertificateOutlined />}>Ready to close</Tag>;
  const tag = <StatusTag status={risk} config={JOB_WORK_RISK_CONFIG} getLabel={(r) => RISK_LABEL[r]} size="small" />;
  if (!reasons.length) return tag;
  return (
    <Tooltip title={<Space orientation="vertical" size={2}>{reasons.map((r) => <span key={r}>• {RISK_REASON_LABEL[r]}</span>)}</Space>}>
      <span>{tag}</span>
    </Tooltip>
  );
});

export const StaleTag = memo(function StaleTag({ stale, lastEntryDate }) {
  if (!stale) return null;
  return (
    <Tooltip title={lastEntryDate ? `Last update ${fmtDate(lastEntryDate)}` : 'No update since the job started'}>
      <Tag color="gold" icon={<ClockCircleOutlined />}>No update</Tag>
    </Tooltip>
  );
});

export const VendorApprovalTag = memo(function VendorApprovalTag({ approval }) {
  if (approval === 'OK' || !approval) return null;
  return (
    <Tooltip title="The vendor's job-work approval date in the Vendor master has passed or is missing.">
      <Tag color="volcano" icon={<StopOutlined />}>{approval === 'EXPIRED' ? 'Approval expired' : 'Not approved'}</Tag>
    </Tooltip>
  );
});

export const FlagTag = memo(function FlagTag({ flag }) {
  if (!flag) return null;
  return <StatusTag status={flag} config={JOB_WORK_FLAG_CONFIG} getLabel={(f) => FLAG_LABEL[f]} size="small" />;
});

export const PullBackStatusTag = memo(function PullBackStatusTag({ status }) {
  return <StatusTag status={status} config={JOB_WORK_PULLBACK_STATUS_CONFIG} getLabel={(s) => PULLBACK_STATUS_LABEL[s]} size="small" />;
});

export const ReceiptStatusTag = memo(function ReceiptStatusTag({ status }) {
  return <StatusTag status={status} config={JOB_WORK_RECEIPT_STATUS_CONFIG} getLabel={(s) => RECEIPT_STATUS_LABEL[s]} size="small" />;
});

export const ReturnStatusTag = memo(function ReturnStatusTag({ status }) {
  return <StatusTag status={status} config={JOB_WORK_RETURN_STATUS_CONFIG} getLabel={(s) => RETURN_STATUS_LABEL[s]} size="small" />;
});
