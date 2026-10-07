import { useState } from 'react';
import { Alert, App, Button, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import ApprovalReasonDialog from '../../../../components/ApprovalReasonDialog';
import { decidePullBack } from '../../../../services/production/jobwork/jobWorkPullBackApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { hasPermission } from '../../../../utils/permissions';
import { fmtMoney } from '../jwFormat';

const ACTIONS = [
  {
    key: 'APPROVE', label: 'Approve', color: 'var(--success-color, #52c41a)', icon: <CheckCircleOutlined />, title: 'Approve pull-back',
    subtitle: 'Moves no goods: it holds the vendor POs\' plan back and sets the vendor\'s new date', btnText: 'Approve', requiresReason: false,
  },
  {
    key: 'REJECT', label: 'Reject', color: 'var(--error-color, #ff4d4f)', icon: <CloseCircleOutlined />, title: 'Reject pull-back',
    subtitle: 'The vendor keeps the work; the coordinator sees why', btnText: 'Reject', danger: true, requiresReason: true, minChars: 10,
  },
  {
    key: 'REFER_BACK', label: 'Refer Back', color: 'var(--warning-color, #fa8c16)', icon: <RollbackOutlined />, title: 'Refer back',
    subtitle: 'Send it back to the coordinator to change the request', btnText: 'Refer Back', requiresReason: true, minChars: 10,
  },
];

/**
 * Stands in for the approval engine's action bar (web or owner app). At integration the pull-back
 * goes through `components/approval/ApprovalActionBar` as type JOB_WORK_PULLBACK.
 */
const MockApprovalBar = ({ pb, onDone }) => {
  const { message } = App.useApp();
  const [action, setAction] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirm = async (comment) => {
    setBusy(true);
    try {
      const res = await decidePullBack(pb.id, { action: action.key, comment });
      if (res.clampedBy > 0) message.warning(`${pb.pbNo} approved with ${res.clampedBy} fewer pieces: the vendor finished them since the request.`);
      else message.success(`${action.label} recorded for ${pb.pbNo}.`);
      setAction(null);
      onDone();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };

  const buttons = hasPermission('production-job-work', 'approve') ? (
    <Space wrap>
      {ACTIONS.map((a) => (
        <Button key={a.key} type={a.key === 'APPROVE' ? 'primary' : 'default'} danger={a.danger} icon={a.icon}
          onClick={() => { setReason(''); setAction(a); }}>{a.label}</Button>
      ))}
    </Space>
  ) : null;

  return (
    <>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        title="Waiting for manager approval (simulated)"
        description={`In the live system this goes to the approval engine on the web and the owner app, routed on the ${fmtMoney(pb.earnings.total)} the vendor would earn. Here you decide on the spot.`}
        action={buttons}
      />
      <ApprovalReasonDialog
        open={!!action}
        onCancel={() => setAction(null)}
        onConfirm={confirm}
        loading={busy}
        action={action}
        docLabel="Job Work Pull-back"
        docNumber={pb.pbNo}
        reason={reason}
        onReasonChange={setReason}
      />
    </>
  );
};

export default MockApprovalBar;
