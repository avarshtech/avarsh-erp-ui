import { useState } from 'react';
import { App, Form, Input, Modal } from 'antd';
import { toastUnlessHandled } from '../../../utils/apiError';

/**
 * Approve, reject, cancel, dispatch or complete.
 *
 * One dialog for all five because they take the same shape - a note, sometimes
 * a vehicle - and differ only in which of them insist on the note. A refusal
 * has to say why; nobody explains a yes.
 */
const COPY = {
  approve: {
    title: 'Approve this transfer?',
    body: 'A challan is generated for a move between units. The assets can then be dispatched.',
    ok: 'Approve',
    reasonLabel: 'Note (optional)',
    vehicle: true,
  },
  reject: {
    title: 'Reject this transfer?',
    body: 'Nothing moves. The request is kept with your reason on it.',
    ok: 'Reject',
    reasonLabel: 'Reason',
    reasonRequired: true,
    danger: true,
  },
  cancel: {
    title: 'Cancel this transfer?',
    body: 'Nothing moves and the assets are released for other transfers. The record is kept.',
    ok: 'Cancel transfer',
    reasonLabel: 'Reason (optional)',
    danger: true,
  },
  dispatch: {
    title: 'Mark as dispatched?',
    body: 'The assets go In Transit. They stay recorded at the sending unit until the receiving unit confirms them.',
    ok: 'Mark dispatched',
    reasonLabel: 'Note (optional)',
    vehicle: true,
  },
  complete: {
    title: 'Complete this move?',
    body: 'The assets move to the new location now and the movement history is written. This move stays inside one unit, so there is no journey to confirm.',
    ok: 'Complete move',
    reasonLabel: 'Note (optional)',
  },
};

const TransferDecisionDialog = ({ action, transfer, onClose, onDone, handlers }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const copy = action ? COPY[action] : null;

  const submit = async (values) => {
    setSaving(true);
    try {
      const saved = await handlers[action](transfer.id, { ...values, version: transfer.version });
      message.success(`${transfer.transferNo} ${action === 'complete' ? 'completed' : `${action}ed`}`);
      onDone(saved);
      form.resetFields();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not do that');
    } finally {
      setSaving(false);
    }
  };

  if (!copy) return null;

  return (
    <Modal
      title={copy.title}
      open={!!action}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={copy.ok}
      okButtonProps={{ danger: copy.danger }}
      confirmLoading={saving}
      destroyOnHidden
    >
      <p style={{ marginTop: 0 }}>{copy.body}</p>
      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="reason"
          label={copy.reasonLabel}
          rules={copy.reasonRequired ? [{ required: true, message: 'Say why' }] : undefined}
        >
          <Input.TextArea rows={2} maxLength={500} showCount />
        </Form.Item>
        {copy.vehicle && transfer.interUnit && (
          <Form.Item name="vehicleNo" label="Vehicle no." initialValue={transfer.vehicleNo ?? undefined}>
            <Input maxLength={30} placeholder="Printed on the challan" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default TransferDecisionDialog;
