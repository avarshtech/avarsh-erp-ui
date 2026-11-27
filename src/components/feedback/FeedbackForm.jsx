import { Form, Input, Radio, Select } from 'antd';
import { INITIAL_VALUES, ISSUE_TYPES, PLACEHOLDERS, PRIORITIES } from './feedbackOptions';

/** The fields of a report. The form instance (and so the typed values) lives in FeedbackWidget. */
const FeedbackForm = ({ form }) => {
  const type = Form.useWatch('type', form) || 'BUG';
  const placeholder = PLACEHOLDERS[type];

  return (
    <Form form={form} layout="vertical" initialValues={INITIAL_VALUES} name="feedback-report">
      <Form.Item name="type" label="What would you like to report?">
        <Radio.Group options={ISSUE_TYPES} optionType="button" buttonStyle="solid" />
      </Form.Item>
      <Form.Item
        name="title"
        label="Title"
        rules={[{ required: true, whitespace: true, message: 'Give the report a short title' }]}
      >
        <Input maxLength={200} showCount placeholder={placeholder.title} autoComplete="off" />
      </Form.Item>
      <Form.Item
        name="description"
        label="Description"
        rules={[{ required: true, whitespace: true, message: 'Describe the problem or idea' }]}
      >
        <Input.TextArea rows={4} maxLength={10000} placeholder={placeholder.description} />
      </Form.Item>
      <Form.Item name="priority" label="Priority">
        <Select options={PRIORITIES} />
      </Form.Item>
    </Form>
  );
};

export default FeedbackForm;
