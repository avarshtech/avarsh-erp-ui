import { memo } from 'react';
import { Alert, Space, Tag } from 'antd';
import StatusSteps from '../../../components/StatusSteps';
import { JOB_WORK_PO_STATUS_CONFIG, JOB_WORK_PO_STATUS_FLOW } from '../../../utils/statusConfig';
import { jobWorkPoStatusLabel, JW_PO_STATUS as S } from '../../../utils/jobWorkPoStatus';
import { CLOSE_REASONS, optionLabel } from '../../../utils/jobWorkConstants';

/**
 * Where a job-work PO stands: the status steps, derived flags (overdue, approved not
 * sent, order cancelled, requirement changed — CPP §17.3), and the notes a user left on the
 * way: send-back note, rejection, cancellation or short close, an open amendment.
 */
const JobWorkStatusBanner = memo(function JobWorkStatusBanner({ doc, flags = [], flow = JOB_WORK_PO_STATUS_FLOW }) {
  const closed = [S.CANCELLED, S.CLOSED, S.REJECTED].includes(doc.status) && (doc.closeRemark || doc.closeReasonCode);
  const rev = doc.pendingRevision;
  return (
    <div style={{ marginBottom: 16 }}>
      {doc.id && (
        <StatusSteps
          size="small" currentStatus={doc.status} statusConfig={JOB_WORK_PO_STATUS_CONFIG} getLabel={jobWorkPoStatusLabel}
          statusFlow={flow.includes(doc.status) ? flow : [...flow.slice(0, 2), doc.status]}
        />
      )}
      {flags.length > 0 && <Space size={4} wrap style={{ margin: '8px 0' }}>{flags.map((f) => <Tag key={f.key} color={f.color}>{f.label}</Tag>)}</Space>}
      {doc.status === S.DRAFT && doc.sendBackNote && <Alert type="warning" showIcon title="Sent back for correction" description={doc.sendBackNote} style={{ marginTop: 8 }} />}
      {closed && (
        <Alert type="info" showIcon style={{ marginTop: 8 }} title={`${jobWorkPoStatusLabel(doc.status)} by ${doc.closedBy || '—'}`}
          description={[optionLabel(CLOSE_REASONS, doc.closeReasonCode), doc.closeRemark].filter((v) => v && v !== '—').join(' — ')} />
      )}
      {rev && (
        <Alert type="info" showIcon style={{ marginTop: 8 }}
          title={`Amendment R${rev.revisionNo} ${rev.status === S.DRAFT ? 'being drafted' : 'awaiting approval'} — ${rev.reason}`}
          description={`The live PO (R${doc.revisionNo || 0}) and its allocation stay in force until the amendment is approved.${rev.sendBackNote ? ` Sent back: ${rev.sendBackNote}` : ''}`} />
      )}
    </div>
  );
});

export default JobWorkStatusBanner;
