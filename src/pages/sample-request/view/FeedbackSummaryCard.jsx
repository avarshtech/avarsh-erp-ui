import { Card, Tag, Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { formatDate } from '../../../utils/formatters';
import { FEEDBACK_DECISIONS, FEEDBACK_DECISION_LABELS } from '../../../utils/sampleRequestConstants';

const { Text } = Typography;

const DEFAULT_LABELS = {
  fit: 'Fit', fabricShade: 'Fabric / Shade', measurement: 'Measurement', workmanship: 'Workmanship',
};

const DECISION_COLOR = {
  [FEEDBACK_DECISIONS.APPROVED]: 'green',
  [FEEDBACK_DECISIONS.APPROVED_WITH_COMMENTS]: 'green',
  [FEEDBACK_DECISIONS.REJECTED]: 'red',
  [FEEDBACK_DECISIONS.REVISION_REQUIRED]: 'orange',
};

/**
 * Read-only customer feedback summary on the SR detail (R2). Capture and
 * editing happen on the dedicated Customer Comments page — linked below.
 */
const FeedbackSummaryCard = ({ sr, labels }) => {
  const navigate = useNavigate();
  const f = sr?.feedback;
  if (!f) return null;

  const categoryLabels = { ...DEFAULT_LABELS, ...(labels || {}) };

  return (
    <Card
      size="small"
      style={{ marginTop: 16 }}
      title="Customer Feedback"
      extra={f.decision
        ? <Tag color={DECISION_COLOR[f.decision] || 'default'} style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>{FEEDBACK_DECISION_LABELS[f.decision] || f.decision}</Tag>
        : <Tag color="gold" style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>Draft — decision pending</Tag>}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
        {formatDate(f.date)}{f.from ? ` · ${f.from}` : ''}
      </Text>
      {(f.rejectionReasonCodes || []).length > 0 && (
        <div style={{ marginBottom: 8 }}>
          {f.rejectionReasonCodes.map((c) => <Tag key={c}>{c.replace(/_/g, ' ')}</Tag>)}
        </div>
      )}
      {['fit', 'fabricShade', 'measurement', 'workmanship']
        .filter((k) => f.comments?.[k])
        .map((k) => (
          <div key={k} style={{ marginTop: 4 }}>
            <Text strong>{categoryLabels[k]}: </Text><Text>{f.comments[k]}</Text>
          </div>
        ))}
      {f.comments?.additional && (
        <div style={{ marginTop: 4 }}>
          <Text strong>Additional: </Text><Text>{f.comments.additional}</Text>
        </div>
      )}
      {(f.attachments || []).length > 0 && (
        <div style={{ marginTop: 8 }}>
          {f.attachments.map((a) => (
            <Tag key={a.name}>{a.name}{a.sourceOfImport ? ' · source of import' : ''}</Tag>
          ))}
        </div>
      )}
      <Button
        type="link"
        size="small"
        style={{ paddingInline: 0, marginTop: 8 }}
        onClick={() => navigate(`/sample-requests/comments?srId=${sr.id}`)}
      >
        Open Customer Comments
      </Button>
    </Card>
  );
};

export default FeedbackSummaryCard;
