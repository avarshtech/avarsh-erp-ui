import { useState } from 'react';
import {
  Alert, App, Input, Modal, Typography,
} from 'antd';
import { closeJob } from '../../../../services/production/jobwork/jobWorkTrackerApi';
import { toastUnlessHandled } from '../../../../utils/apiError';
import { fmtQty } from '../jwFormat';

const { Text } = Typography;

/** Short-close: the balance stays with no one; a reason is required. */
const JobCloseModal = ({ open, row, onClose, onDone }) => {
  const { message } = App.useApp();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const received = row.finalGood + row.finalRejected;
  const ok = async () => {
    setBusy(true);
    try {
      await closeJob(row.id, { version: row.version, reason });
      message.success(`${row.jobNo} short-closed.`);
      onDone();
    } catch (e) { toastUnlessHandled(message, e, 'Could not close the job.'); } finally { setBusy(false); }
  };
  return (
    <Modal
      open={open}
      title={`Short-close ${row.jobNo}`}
      okText="Short-close"
      okButtonProps={{ danger: true, disabled: !reason.trim(), loading: busy }}
      onOk={ok}
      onCancel={onClose}
      destroyOnHidden
    >
      <Alert
        type={row.readyToClose ? 'success' : 'warning'}
        showIcon
        style={{ marginBottom: 12 }}
        title={row.readyToClose
          ? `${fmtQty(received)} received covers the job's share; the leftover allowance closes.`
          : `${fmtQty(received)} of ${fmtQty(row.planTotal)} received. The balance will not come back on this job.`}
      />
      {row.finalAlter > 0 && <Text type="warning">{fmtQty(row.finalAlter)} pieces were handed back for alteration and may still be out.</Text>}
      <Input.TextArea
        name="closeReason"
        rows={3}
        style={{ marginTop: 8 }}
        placeholder="Why is this job being closed short?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Modal>
  );
};

export default JobCloseModal;
