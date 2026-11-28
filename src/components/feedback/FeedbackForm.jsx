import { Form, Input, Radio, Select, Spin, Tag, Typography } from 'antd';
import { ENVIRONMENT_COLORS, ENVIRONMENT_OPTIONS, INITIAL_VALUES, ISSUE_TYPES, PLACEHOLDERS, PRIORITIES } from './feedbackOptions';
import { ENVIRONMENT_LABELS } from '../../services/feedback/environment';

const { Text } = Typography;

/** "Priya S (priya) · Merchandiser · priya@example.com", from what the ERP returned. */
const ReportedBy = ({ details }) => {
  if (details.status === 'loading') {
    return <Text type="secondary"><Spin size="small" /> Checking your details…</Text>;
  }
  const who = details.reporter;
  if (!who) {
    return <Text type="secondary">You (your account is checked again when you send)</Text>;
  }
  return (
    <span className="feedback-reporter">
      <Text strong>{who.name || who.username}</Text>
      {who.username && who.name ? <Text type="secondary"> ({who.username})</Text> : null}
      {who.role ? <Text type="secondary"> · {who.role}</Text> : null}
      {who.email ? <Text type="secondary"> · {who.email}</Text> : null}
    </span>
  );
};

/**
 * The fields of a report. The form instance (and so the typed values) lives in FeedbackDialog.
 *
 * `details` is what the ERP said about this report: {status, serverEnvironment, reporter}. When the ERP
 * names the environment it is shown and cannot be changed; otherwise the reporter confirms or picks it.
 * A contact field appears only when the ERP has no e-mail for the reporter.
 */
const FeedbackForm = ({ form, details, buildEnvironment }) => {
  const type = Form.useWatch('type', form) || 'BUG';
  const placeholder = PLACEHOLDERS[type];
  const serverEnvironment = details.serverEnvironment;
  const needsContact = details.status !== 'loading' && !details.reporter?.email;

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ ...INITIAL_VALUES, environment: buildEnvironment || undefined }}
      name="feedback-report"
    >
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
      <div className="feedback-row">
        <Form.Item name="priority" label="Priority">
          <Select options={PRIORITIES} />
        </Form.Item>
        {serverEnvironment ? (
          <Form.Item label="Environment">
            <span className="feedback-environment">
              <Tag color={ENVIRONMENT_COLORS[serverEnvironment]}>
                {ENVIRONMENT_LABELS[serverEnvironment] || serverEnvironment}
              </Tag>
              <Text type="secondary">detected automatically</Text>
            </span>
          </Form.Item>
        ) : (
          <Form.Item
            name="environment"
            label="Environment"
            rules={[{ required: true, message: 'Choose where this happened' }]}
            extra={buildEnvironment ? 'Detected from this app. Change it if it is wrong.' : 'Could not be detected. Please choose.'}
          >
            <Select options={ENVIRONMENT_OPTIONS} placeholder="Development, QA or Production" />
          </Form.Item>
        )}
      </div>
      <Form.Item label="Reported by" className="feedback-reported-by">
        <ReportedBy details={details} />
      </Form.Item>
      {needsContact ? (
        <Form.Item name="reporterContact" label="How can we reach you? (optional)">
          <Input placeholder="E-mail or phone" autoComplete="email" maxLength={200} />
        </Form.Item>
      ) : null}
    </Form>
  );
};

export default FeedbackForm;
