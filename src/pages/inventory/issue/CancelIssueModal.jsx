import { useState } from 'react';
import { App, Modal, Input, Typography, Alert } from 'antd';
import { cancelIssue } from '../../../services/inventory/materialIssueService';

const { TextArea } = Input;
const { Text } = Typography;

const MIN_CHARS = 20;

/**
 * Cancel a COMPLETED material issue. The server restores every issued
 * quantity to its exact source stock lot, so this is the correction path
 * (there is no edit) — cancel, then raise a fresh issue.
 */
const CancelIssueModal = ({ open, record, onClose, onCancelled }) => {
  const { message } = App.useApp();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const handleOk = async () => {
    if (reason.trim().length < MIN_CHARS) {
      message.warning(`Reason must be at least ${MIN_CHARS} characters`);
      return;
    }
    setBusy(true);
    try {
      await cancelIssue(record.id, reason.trim());
      message.success(`${record.issueNumber} cancelled — stock restored`);
      setReason('');
      onCancelled?.();
      onClose();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to cancel issue');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => { setReason(''); onClose(); };

  return (
    <Modal
      title={`Cancel ${record?.issueNumber || 'Issue'}`}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      okText="Cancel Issue"
      okButtonProps={{ danger: true, loading: busy, disabled: reason.trim().length < MIN_CHARS }}
      cancelText="Keep Issue"
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="Issued quantities will be returned to their source stock rolls / lots."
        description="Cancelling is the correction path — raise a fresh issue afterwards if material is still needed."
      />
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        Reason (minimum {MIN_CHARS} characters)
      </Text>
      <TextArea
        rows={3}
        value={reason}
        maxLength={500}
        showCount
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this issue being cancelled — wrong PO, wrong rolls, quantity error, production change..."
      />
    </Modal>
  );
};

export default CancelIssueModal;
