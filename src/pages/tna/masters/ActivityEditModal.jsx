import { useEffect, useState } from 'react';
import {
  App, Form, InputNumber, Modal, Segmented, Select, Switch,
} from 'antd';
import { saveActivity } from '../../../services/tna/tnaService';
import { ATTRIBUTION, DAY_TYPE } from '../../../utils/tnaConstants';

/** Edits one activity in a DRAFT master version; plans already generated keep their version (FR-12.2). */
const ActivityEditModal = ({ versionId, activity, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (activity) form.setFieldsValue(activity); }, [activity, form]);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await saveActivity(versionId, { code: activity.code, ...values, threshold: values.threshold ?? null });
      message.success(`${activity.code} updated in the draft version`);
      onSaved();
    } catch (e) {
      message.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!activity} title={activity ? `${activity.code} · ${activity.name}` : ''} okText="Save to draft" onOk={submit} onCancel={onClose} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="duration" label="Default duration" rules={[{ required: true }]}>
          <InputNumber min={0} max={120} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="dayType" label="Day type" tooltip="Buyer and supplier waits run on calendar days; factory execution on the working calendar (BR-04)">
          <Segmented options={Object.entries(DAY_TYPE).map(([value, d]) => ({ value, label: d.label }))} />
        </Form.Item>
        <Form.Item name="threshold" label="Completion threshold %" tooltip="Leave empty for single-event completion. Partial postings below it set no date (FR-6.6)">
          <InputNumber min={1} max={100} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item name="isGate" label="Gate" valuePropName="checked" tooltip="No successor may be scheduled to start before a gate completes (FR-3.6)">
          <Switch />
        </Form.Item>
        <Form.Item name="attribution" label="Delay attribution" rules={[{ required: true }]}>
          <Select options={Object.entries(ATTRIBUTION).filter(([k]) => !['REASON_UNAVAILABLE', 'SCOPE_ADDENDUM'].includes(k)).map(([value, a]) => ({ value, label: a.label }))} />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ActivityEditModal;
