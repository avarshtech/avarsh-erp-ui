import { useState } from 'react';
import {
  App, Form, InputNumber, Modal, Segmented, Switch,
} from 'antd';
import { saveTemplateActivity } from '../../../services/tna/tnaService';
import { DAY_TYPE } from '../../../utils/tnaConstants';

const MANDATORY = ['A01', 'A24'];

/** Edits one milestone in a DRAFT template; plans already generated keep their version (FR-12.2). */
const TemplateActivityModal = ({ templateId, activity, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      const saved = await saveTemplateActivity(templateId, { code: activity.code, ...values, threshold: values.threshold ?? null });
      message.success(`${activity.code} updated in the draft template`);
      onSaved(saved);
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to save the activity');
    } finally {
      setSaving(false);
    }
  };

  const mandatory = activity && MANDATORY.includes(activity.code);
  return (
    <Modal open={!!activity} title={activity ? `${activity.code} · ${activity.name}` : ''} okText="Save to draft" onOk={submit} onCancel={onClose} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false} initialValues={activity || undefined}>
        <Form.Item name="included" label="Planned for this template's orders" valuePropName="checked" tooltip={mandatory ? 'Order confirmed and Dispatch are always planned' : undefined}>
          <Switch disabled={mandatory} />
        </Form.Item>
        <Form.Item name="applicability" label="Applies to">
          <Segmented options={[{ value: 'ALWAYS', label: 'Every order' }, { value: 'WHEN_SOURCE_EXISTS', label: 'When the source record exists' }]} />
        </Form.Item>
        <Form.Item name="duration" label="Planned duration" rules={[{ required: true }]}>
          <InputNumber min={0} max={365} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="dayType" label="Day type" tooltip="Buyer and supplier waits run on calendar days; factory execution on the working calendar (BR-04)">
          <Segmented options={Object.entries(DAY_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        </Form.Item>
        {activity?.threshold != null && (
          <Form.Item name="threshold" label="Completion threshold %" tooltip="Partial postings below it set no date (FR-6.6)">
            <InputNumber min={1} max={100} style={{ width: 160 }} />
          </Form.Item>
        )}
        <Form.Item name="gate" label="Gate" valuePropName="checked" tooltip="No successor may be scheduled to start before a gate completes (FR-3.6)">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default TemplateActivityModal;
