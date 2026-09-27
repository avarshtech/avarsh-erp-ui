import { memo, useState } from 'react';
import { Form, Input, Modal, Select, Typography } from 'antd';

const { Text } = Typography;

/**
 * Asks for the reason an action needs — cancel and short close take a reason code AND a
 * remark (CPP VR-18); send back, reject and amend take a remark. Reasons are permanent
 * (BR-20). `dialog` = { open, title, okText, danger, codes?, intro? }; onSubmit gets
 * { reasonCode, remark }; resolving false (or rejecting) keeps the dialog open.
 */
const DialogBody = ({ dialog, onSubmit, onClose }) => {
  const [reasonCode, setReasonCode] = useState(undefined);
  const [remark, setRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = String(remark).trim() && (!dialog.codes || reasonCode);
  const submit = async () => {
    setBusy(true);
    try {
      if (await onSubmit({ reasonCode, remark: remark.trim() }) !== false) onClose();
    } catch { /* the caller has shown the error; the dialog stays open */ } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open title={dialog.title} okText={dialog.okText} onOk={submit} onCancel={onClose} confirmLoading={busy}
      okButtonProps={{ disabled: !ready, danger: dialog.danger }} destroyOnHidden
    >
      {dialog.intro && <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{dialog.intro}</Text>}
      <Form layout="vertical">
        {dialog.codes && (
          <Form.Item label="Reason" required>
            <Select name="reasonCode" aria-label="Reason" options={dialog.codes} value={reasonCode} onChange={setReasonCode} placeholder="Select a reason" />
          </Form.Item>
        )}
        <Form.Item label="Remark" required>
          <Input.TextArea name="remark" aria-label="Remark" rows={3} maxLength={500} showCount value={remark} onChange={(e) => setRemark(e.target.value)} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

/** Mounts a fresh body per opening, so a previous reason never lingers. */
const JobWorkReasonDialog = memo(function JobWorkReasonDialog({ dialog, onSubmit, onClose }) {
  return dialog?.open ? <DialogBody dialog={dialog} onSubmit={onSubmit} onClose={onClose} /> : null;
});

export default JobWorkReasonDialog;
