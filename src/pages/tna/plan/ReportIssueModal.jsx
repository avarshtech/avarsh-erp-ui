import { useState } from 'react';
import {
  Alert, App, Form, Input, Modal, Select,
} from 'antd';
import { reportDataIssue } from '../../../services/tna/tnaService';
import { currentUserName } from '../../../utils/tnaConstants';

/**
 * FR-6.4 — the only write a planner has: a correction task against the source record.
 * It never writes a value into the plan; the source module corrects its own record.
 */
const ReportIssueModal = ({ open, planId, activities, activityCode, onClose }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      const issue = await reportDataIssue({ planId, activityCode: values.activityCode, text: values.text, by: currentUserName() });
      message.success(`Correction task raised for ${issue.ownerRole} against ${issue.sourceRecord}. Nothing was written into the plan.`);
      form.resetFields();
      onClose();
    } catch (e) {
      message.error(e.message || 'Could not raise the data issue');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Report data issue"
      okText="Raise correction task"
      onOk={submit}
      onCancel={onClose}
      confirmLoading={saving}
      destroyOnHidden
    >
      <Alert type="info" showIcon style={{ marginBottom: 12 }} title="This raises a task against the source record for its owning module. No date, duration or status in Time & Action changes." />
      <Form form={form} layout="vertical" initialValues={{ activityCode }} preserve={false}>
        <Form.Item name="activityCode" label="Activity" rules={[{ required: true, message: 'Choose the activity whose source record looks wrong' }]}>
          <Select showSearch optionFilterProp="label" options={activities.map((a) => ({ value: a.code, label: `${a.code} ${a.name}` }))} />
        </Form.Item>
        <Form.Item name="text" label="What looks wrong in the source record?" rules={[{ required: true, message: 'Describe the issue' }, { max: 500 }]}>
          <Input.TextArea rows={4} maxLength={500} showCount placeholder="e.g. GRN posted against the wrong order line" />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default ReportIssueModal;
