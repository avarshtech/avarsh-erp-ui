import { useState } from 'react';
import { App, Modal, Input, Typography, Alert } from 'antd';
import { cancelGRN } from '../../../services/inventory/inventoryService';

const { TextArea } = Input;
const { Text } = Typography;

const MIN_CHARS = 20;

/**
 * Direct pre-QC GRN cancellation — Draft / QC_Pending only, blocked by the
 * server once any QC inspection exists. Terminal (unlike reversal); the GRN
 * stays on record but its receipts drop out of the PO balance.
 */
const CancelGRNModal = ({ open, record, onClose, onCancelled }) => {
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
      await cancelGRN(record.id, reason.trim(), record.version);
      message.success(`${record.grnNumber} cancelled`);
      setReason('');
      onCancelled?.();
      onClose();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to cancel GRN');
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => { setReason(''); onClose(); };

  return (
    <Modal
      title={`Cancel ${record?.grnNumber || 'GRN'}`}
      open={open}
      onOk={handleOk}
      onCancel={handleClose}
      okText="Cancel GRN"
      okButtonProps={{ danger: true, loading: busy, disabled: reason.trim().length < MIN_CHARS }}
      cancelText="Keep GRN"
      destroyOnHidden
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="This is permanent — the GRN stays on record but its received quantities are removed from the PO balance."
        description="Not possible once a QC inspection exists against this GRN."
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
        placeholder="Why is this GRN being cancelled — duplicate entry, wrong PO, goods rejected at gate..."
      />
    </Modal>
  );
};

export default CancelGRNModal;
