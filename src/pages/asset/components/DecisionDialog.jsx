import { useState } from 'react';
import { App, Form, Input, Modal } from 'antd';
import { toastUnlessHandled } from '../../../utils/apiError';

/**
 * Deciding on a request: approve, reject, cancel, dispatch or complete.
 *
 * One dialog for all of them, because the shape of the decision really is the
 * same everywhere - a note, the version to check it against, and a handler to
 * call - and because a refusal has to say why while nobody explains a yes.
 *
 * The *words* are not the same, so the caller brings them. A transfer approval
 * generates a challan and sends a machine down the road; a disposal approval
 * retires it for good and cannot be undone. Sharing the mechanism was right;
 * sharing the sentences was how approving a disposal came to ask "Approve this
 * transfer?" and promise a challan that is never printed.
 */

const DecisionDialog = ({ action, record, docNo, copy: copyFor, onClose, onDone, handlers }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const copy = action ? copyFor[action] : null;

  const submit = async (values) => {
    setSaving(true);
    try {
      const saved = await handlers[action](record.id, { ...values, version: record.version });
      // The past tense is written down per decision rather than built from the
      // action, which used to produce "DR/26-27/1002 approveed".
      message.success(`${docNo} ${copy.done}`);
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
        {copy.vehicle && record.interUnit && (
          <Form.Item name="vehicleNo" label="Vehicle no." initialValue={record.vehicleNo ?? undefined}>
            <Input maxLength={30} placeholder="Printed on the challan" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default DecisionDialog;
