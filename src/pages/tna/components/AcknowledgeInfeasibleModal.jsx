import { useState } from 'react';
import {
  Alert, App, Form, Input, Modal,
} from 'antd';
import { acknowledgeInfeasible } from '../../../services/tna/tnaService';
import { currentUserName } from '../../../utils/tnaConstants';

/**
 * D-06 — the Merchandising Manager acknowledges an infeasible commitment with a reason.
 * The plan activates and stays reported as Infeasible; no duration is shortened (FR-3.10).
 */
const AcknowledgeInfeasibleModal = ({ open, planId, orderNo, onClose, onDone }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const { reason } = await form.validateFields();
    setSaving(true);
    try {
      await acknowledgeInfeasible(planId, { by: currentUserName(), reason });
      message.success(`${orderNo}: infeasible commitment acknowledged; the plan is active and still reported as infeasible`);
      onDone();
    } catch (e) {
      message.error(e.message || 'Could not acknowledge');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={`Acknowledge infeasible commitment — ${orderNo}`} okText="Acknowledge" okButtonProps={{ danger: true }} onOk={submit} onCancel={onClose} confirmLoading={saving} destroyOnHidden>
      <Alert type="warning" showIcon style={{ marginBottom: 12 }} title="Acknowledging records the override against the order with your name and reason. It does not make the commitment achievable." />
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'A reason is required' }, { max: 300 }]}>
          <Input.TextArea rows={3} maxLength={300} showCount placeholder="e.g. Buyer agreed to air-freight 30% of the quantity" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default AcknowledgeInfeasibleModal;
