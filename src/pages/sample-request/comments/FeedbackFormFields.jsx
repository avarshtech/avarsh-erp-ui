import { Form, DatePicker, Input, Select, Tag, Row, Col } from 'antd';
import { FEEDBACK_DECISIONS, FEEDBACK_DECISION_OPTIONS } from '../../../utils/sampleRequestConstants';
import FeedbackAttachments from './FeedbackAttachments';

const { TextArea } = Input;

/**
 * The comment record's own fields. Both routes into the screen — typing them
 * out, or applying an imported sheet — end up writing here, so there is one set
 * of inputs and one set of validation rules rather than two that can drift.
 */
const FeedbackFormFields = ({
  labels, decision, rejectionReasonOptions, importSource, attachments, pendingFiles, setPendingFiles,
}) => (
  <>
    <Row gutter={16}>
      <Col xs={24} sm={8}>
        <Form.Item
          name="date"
          label={<>{'Feedback Received Date'}{importSource && <Tag style={{ marginInlineStart: 6 }} color="blue">imported</Tag>}</>}
          rules={[{ required: true, message: 'Enter received date' }]}
        >
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Col>
      <Col xs={24} sm={8}>
        <Form.Item name="from" label="Feedback From" rules={[{ required: true, message: 'Buyer contact name' }]}>
          <Input placeholder="Buyer contact name" />
        </Form.Item>
      </Col>
      <Col xs={24} sm={8}>
        <Form.Item name="decision" label="Overall Decision" rules={[{ required: true, message: 'Select decision' }]}>
          <Select options={FEEDBACK_DECISION_OPTIONS} placeholder="Select decision" />
        </Form.Item>
      </Col>
    </Row>
    {[FEEDBACK_DECISIONS.REJECTED, FEEDBACK_DECISIONS.REVISION_REQUIRED].includes(decision) && (
      <Form.Item name="rejectionReasonCodes" label="Rejection Reason Codes">
        <Select mode="multiple" placeholder="Multi-select from Master Data" options={rejectionReasonOptions} />
      </Form.Item>
    )}
    <Row gutter={16}>
      <Col xs={24} sm={12}><Form.Item name="fit" label={`${labels.fit} Comments`}><TextArea rows={2} /></Form.Item></Col>
      <Col xs={24} sm={12}><Form.Item name="fabricShade" label={`${labels.fabricShade} Comments`}><TextArea rows={2} /></Form.Item></Col>
      <Col xs={24} sm={12}><Form.Item name="measurement" label={`${labels.measurement} Comments`}><TextArea rows={2} /></Form.Item></Col>
      <Col xs={24} sm={12}><Form.Item name="workmanship" label={`${labels.workmanship} Comments`}><TextArea rows={2} /></Form.Item></Col>
    </Row>
    <Form.Item name="additional" label="Additional Comments">
      <TextArea rows={1} placeholder="Anything not covered above…" />
    </Form.Item>
    <Form.Item
      label="Attachments"
      extra="The buyer's comment sheet, marked-up photos or anything else worth keeping · .xlsx · .xls · .pdf · .png · .jpg · max 5 MB per file · uploaded when you save"
    >
      <FeedbackAttachments stored={attachments} pending={pendingFiles} setPending={setPendingFiles} />
    </Form.Item>
  </>
);

export default FeedbackFormFields;
