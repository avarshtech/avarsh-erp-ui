import { useEffect, useState } from 'react';
import { App, Alert, Button, DatePicker, Drawer, Form, Input, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { proposeReplan } from '../../../services/tna/tnaService';
import { REPLAN_REASONS } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';

/** Re-plan proposal (§13) — a workflow, not an editable cell. Baseline is never touched. */
const ReplanDrawer = ({ open, plan, line, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const proposedDate = Form.useWatch('proposedDate', form);

  useEffect(() => {
    if (open && line) { form.resetFields(); form.setFieldsValue({ proposedDate: dayjs(line.plannedDate).add(1, 'day') }); }
  }, [open, line, form]);

  const shift = line && proposedDate ? proposedDate.startOf('day').diff(dayjs(line.plannedDate), 'day') : null;
  const pushesEtd = shift != null && line && (shift > line.floatDays);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await proposeReplan({
        planId: plan.id,
        code: line.code,
        proposedDate: values.proposedDate.format('YYYY-MM-DD'),
        reasonCode: values.reasonCode,
        justification: values.justification,
      });
      message.success('Re-plan submitted for approval — downstream dates move only after sign-off');
      onSaved();
    } catch (e) {
      if (e?.errorFields) return;
      message.error(e.message || 'Failed to submit re-plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={`Propose Re-plan — ${line?.code} ${line?.name || ''}`}
      open={open}
      onClose={onClose}
      size={440}
      destroyOnHidden
      extra={<Button type="primary" loading={saving} onClick={handleSubmit}>Submit for approval</Button>}
    >
      {line && (
        <Form form={form} layout="vertical">
          <div style={{ marginBottom: 14, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            Current planned: <strong>{dayjs(line.plannedDate).format(DATE_FORMAT)}</strong> · Float {line.floatDays}d · Latest allowable {dayjs(line.latestAllowableDate).format(DATE_FORMAT)}
          </div>
          <Form.Item name="proposedDate" label="Proposed revised date" rules={[{ required: true, message: 'Pick the proposed date' }]}>
            <DatePicker style={{ width: '100%' }} format={DATE_FORMAT} />
          </Form.Item>
          {shift != null && shift !== 0 && (
            <Tag color={pushesEtd ? 'red' : 'gold'} style={{ marginBottom: 14 }}>
              {shift > 0 ? `+${shift}` : shift} day{Math.abs(shift) !== 1 ? 's' : ''} — {pushesEtd ? 'exceeds this activity’s float: dispatch will move past ETD, so approval routes one level higher' : 'inside available float'}
            </Tag>
          )}
          <Form.Item name="reasonCode" label="Reason" rules={[{ required: true, message: 'Select a reason and enter a justification for this re-plan.' }]}>
            <Select options={REPLAN_REASONS.map((r) => ({ value: r, label: r }))} placeholder="Why is this date moving?" />
          </Form.Item>
          <Form.Item name="justification" label="Justification" rules={[{ required: true, message: 'Select a reason and enter a justification for this re-plan.' }]}>
            <Input.TextArea rows={3} placeholder="Specifics the approver needs — what happened, what was agreed, with whom" />
          </Form.Item>
          <Alert
            type="info"
            showIcon
            title="On approval the change cascades to all downstream activities and creates a new plan version. Activities already completed are never rewritten, and the baseline stays frozen — deviation keeps reporting against the original commitment."
            style={{ fontSize: 12 }}
          />
        </Form>
      )}
    </Drawer>
  );
};

export default ReplanDrawer;
