import { Tag, Row, Col, Typography } from 'antd';
import { FEEDBACK_DECISIONS, FEEDBACK_DECISION_LABELS } from '../../../utils/sampleRequestConstants';
import FeedbackAttachments from './FeedbackAttachments';

const { Text } = Typography;

const DECISION_TAG_COLOR = {
  [FEEDBACK_DECISIONS.APPROVED]: 'green',
  [FEEDBACK_DECISIONS.APPROVED_WITH_COMMENTS]: 'green',
  [FEEDBACK_DECISIONS.REJECTED]: 'red',
  [FEEDBACK_DECISIONS.REVISION_REQUIRED]: 'orange',
};

/**
 * A comment record that can no longer be edited — a terminal decision, or a
 * reader without update rights. Shows what was said and lets the buyer's files
 * be opened; nothing here writes.
 */
const FeedbackRecorded = ({ feedback, labels }) => {
  if (!feedback) {
    return <Text type="secondary">No customer comments were recorded for this sample request.</Text>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>Recorded Feedback</Text>
        <Tag color={DECISION_TAG_COLOR[feedback.decision] || 'default'} style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>
          {FEEDBACK_DECISION_LABELS[feedback.decision] || 'Draft — decision pending'}
        </Tag>
      </div>
      <Row gutter={[16, 8]}>
        <Col xs={12} sm={6}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Received</Text>
          <Text strong>{feedback.date}</Text>
        </Col>
        <Col xs={12} sm={6}>
          <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>From</Text>
          <Text strong>{feedback.from}</Text>
        </Col>
        {(feedback.rejectionReasonCodes || []).length > 0 && (
          <Col xs={24} sm={12}>
            <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Reason Codes</Text>
            {feedback.rejectionReasonCodes.map((c) => <Tag key={c}>{c.replace(/_/g, ' ')}</Tag>)}
          </Col>
        )}
      </Row>
      {Object.entries(feedback.comments || {}).filter(([, v]) => v).map(([k, v]) => (
        <div key={k} style={{ marginTop: 8 }}>
          <Text strong>{labels[k] || (k === 'additional' ? 'Additional' : k)}: </Text><Text>{v}</Text>
        </div>
      ))}
      <FeedbackAttachments stored={feedback.attachments || []} readOnly />
    </div>
  );
};

export default FeedbackRecorded;
