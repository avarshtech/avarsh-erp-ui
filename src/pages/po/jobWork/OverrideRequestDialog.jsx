import { memo, useState } from 'react';
import { Alert, Form, Input, Modal, Select } from 'antd';
import { OVERRIDE_REASONS } from '../../../utils/jobWorkConstants';

const n = (v) => Number(v || 0).toLocaleString('en-IN');

const Body = ({ request, onSubmit, onClose }) => {
  const [reasonCode, setReasonCode] = useState(undefined);
  const [justification, setJustification] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const ok = await onSubmit({ lineKey: request.lineKey, excessQty: request.excess, reasonCode, justification: justification.trim() });
      if (ok !== false) onClose();
    } catch { /* shown by the caller */ } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open title="Request over-allocation override" okText="Request override" onOk={submit} onCancel={onClose}
      confirmLoading={busy} okButtonProps={{ disabled: !reasonCode || !justification.trim() }} destroyOnHidden
    >
      <Alert
        type="warning" showIcon style={{ marginBottom: 12 }}
        title={`${request.label}: PO qty ${n(request.poQty)} exceeds the balance ${n(request.balance)} by ${n(request.excess)}.`}
        description={request.note}
      />
      <Form layout="vertical">
        <Form.Item label="Reason" required>
          <Select name="overrideReason" aria-label="Reason" options={OVERRIDE_REASONS} value={reasonCode} onChange={setReasonCode} placeholder="Select a reason" />
        </Form.Item>
        <Form.Item label="Justification" required>
          <Input.TextArea name="justification" aria-label="Justification" rows={3} maxLength={500} showCount value={justification} onChange={(e) => setJustification(e.target.value)} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

/**
 * Requests an excess on one line (CPP §14.4 over-allocation, GPO §11 excess): a reason
 * code and a justification; someone other than the requester authorises it. `request` =
 * { lineKey, label, poQty, balance, excess, note }.
 */
const OverrideRequestDialog = memo(function OverrideRequestDialog({ request, onSubmit, onClose }) {
  return request ? <Body request={request} onSubmit={onSubmit} onClose={onClose} /> : null;
});

export default OverrideRequestDialog;
