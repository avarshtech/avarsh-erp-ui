import { useState } from 'react';
import { App, Input, Modal } from 'antd';
import { toastUnlessHandled } from '../../../../utils/apiError';

/**
 * Asks for a reason and runs `onSubmit(reason)`. A refusal toasts and keeps the modal open.
 * Mount it only while needed so each use starts empty.
 */
const ReasonModal = ({
  title, okText = 'Confirm', placeholder = 'Reason', danger = true, required = true, children, onSubmit, onClose,
}) => {
  const { message } = App.useApp();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = async () => {
    setBusy(true);
    try {
      await onSubmit(reason.trim());
      onClose();
    } catch (e) { toastUnlessHandled(message, e); } finally { setBusy(false); }
  };
  return (
    <Modal open title={title} okText={okText} onOk={ok} onCancel={onClose} destroyOnHidden
      okButtonProps={{ danger, loading: busy, disabled: required && !reason.trim() }}>
      {children}
      <Input.TextArea name="reason" rows={3} style={{ marginTop: children ? 8 : 0 }} placeholder={placeholder}
        value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
};

export default ReasonModal;
