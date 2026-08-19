import { useEffect, useState } from 'react';
import { App, Alert, Button, DatePicker, Drawer, Form, Input, Space, Upload, Tag } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { recordActual } from '../../../services/tna/tnaService';
import { DEVIATION_REMARK_THRESHOLD } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';

/** Manual actual-date entry (§10.2 / VR-09..12) — three taps: open, date, save (NFR-08). */
const ActualDrawer = ({ open, planId, line, onClose, onSaved }) => {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const actualDate = Form.useWatch('actualDate', form);

  useEffect(() => {
    if (open) { form.resetFields(); form.setFieldsValue({ actualDate: dayjs() }); }
  }, [open, form]);

  const deviation = line && actualDate ? actualDate.startOf('day').diff(dayjs(line.baselineDate), 'day') : null;
  const remarkRequired = deviation != null && deviation > DEVIATION_REMARK_THRESHOLD;

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await recordActual(planId, line.code, {
        actualDate: values.actualDate.format('YYYY-MM-DD'),
        remarks: values.remarks,
        attachmentName: values.attachment?.[0]?.name,
      });
      message.success(`Actual recorded for ${line.name}`);
      onSaved();
    } catch (e) {
      if (e?.errorFields) return; // form validation
      message.error(e.message || 'Failed to record actual date');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={`Record Actual — ${line?.code} ${line?.name || ''}`}
      open={open}
      onClose={onClose}
      size={420}
      destroyOnHidden
      extra={<Button type="primary" loading={saving} onClick={handleSave}>Save</Button>}
    >
      {line && (
        <>
          <Space orientation="vertical" size={4} style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 12.5, color: 'var(--text-secondary)' }}>
              Planned {dayjs(line.plannedDate).format(DATE_FORMAT)} · Baseline {dayjs(line.baselineDate).format(DATE_FORMAT)} · Float {line.floatDays}d
            </span>
            {line.sourceModule !== 'Manual' && (
              <Alert type="info" showIcon title={`This activity is normally auto-captured from the ${line.sourceModule} module. A later system event will supersede this manual entry — with a warning, never silently.`} style={{ fontSize: 12 }} />
            )}
          </Space>
          <Form form={form} layout="vertical" requiredMark="optional">
            <Form.Item name="actualDate" label="Actual completion date" rules={[{ required: true, message: 'Select the completion date' }]}>
              <DatePicker style={{ width: '100%' }} format={DATE_FORMAT} disabledDate={(d) => d.isAfter(dayjs(), 'day')} />
            </Form.Item>
            {deviation != null && (
              <Tag color={deviation > 0 ? 'red' : 'green'} style={{ marginBottom: 16 }}>
                {deviation > 0 ? `${deviation} day${deviation > 1 ? 's' : ''} late vs baseline` : 'On or ahead of baseline'}
              </Tag>
            )}
            <Form.Item
              name="remarks"
              label={remarkRequired ? `Remark (required — ${deviation}d over the ${DEVIATION_REMARK_THRESHOLD}-day threshold)` : 'Remark'}
              rules={remarkRequired ? [{ required: true, message: `This activity is ${deviation} days late. A remark is required.` }] : []}
            >
              <Input.TextArea rows={3} placeholder="What caused the deviation, and what was agreed" />
            </Form.Item>
            <Form.Item
              name="attachment"
              label={line.requiresAttachment ? 'Supporting document (required)' : 'Supporting document'}
              valuePropName="fileList"
              getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
              rules={line.requiresAttachment ? [{ required: true, message: `${line.name} requires a supporting document before the actual date can be saved.` }] : []}
            >
              <Upload beforeUpload={() => false} maxCount={1}>
                <Button icon={<UploadOutlined />}>Attach approval mail / report / minutes</Button>
              </Upload>
            </Form.Item>
          </Form>
        </>
      )}
    </Drawer>
  );
};

export default ActualDrawer;
