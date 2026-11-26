import { useState } from 'react';
import {
  Alert, App, DatePicker, Form, Input, Modal,
} from 'antd';
import dayjs from 'dayjs';
import { recordMilestone } from '../../../services/tna/tnaService';
import { DATE_FORMAT } from '../../../utils/uiConstants';

/**
 * Records one of the three milestones the ERP holds no source record for — PP meeting, pattern release,
 * First Bulk Piece. Dated no later than today, with what shows it happened; a correction keeps the
 * earlier entry in the audit trail.
 */
const RecordMilestoneModal = ({ planId, activity, orderDate, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const correction = Boolean(activity?.actualDate);

  const submit = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    setSaving(true);
    try {
      await recordMilestone(planId, activity.code, { date: values.date.format('YYYY-MM-DD'), remarks: values.remarks.trim() });
      message.success(`${activity.name} recorded — the plan has been re-scheduled from it`);
      onSaved();
    } catch (e) {
      message.error(e?.response?.data?.message || 'Could not record the milestone');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={!!activity} title={activity ? `${correction ? 'Correct' : 'Record'} ${activity.code} · ${activity.name}` : ''}
      okText={correction ? 'Save correction' : 'Record completion'} onOk={submit} onCancel={onClose} confirmLoading={saving} destroyOnHidden>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        title="No source record exists for this milestone in the ERP, so it is recorded here. Every other activity completes from its own module." />
      <Form form={form} layout="vertical" preserve={false}
        initialValues={activity ? { date: activity.actualDate ? dayjs(activity.actualDate) : dayjs(), remarks: '' } : undefined}>
        <Form.Item name="date" label="Completed on" rules={[{ required: true, message: 'Pick the date' }]}>
          <DatePicker format={DATE_FORMAT} allowClear={false}
            disabledDate={(d) => d.isAfter(dayjs(), 'day') || (orderDate && d.isBefore(dayjs(orderDate), 'day'))} />
        </Form.Item>
        <Form.Item name="remarks" label={correction ? 'Reason for the correction' : 'Remarks — minutes, attendees or the reference that shows it'}
          rules={[{ required: true, whitespace: true, message: 'Remarks are required' }]}>
          <Input.TextArea rows={3} maxLength={300} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RecordMilestoneModal;
