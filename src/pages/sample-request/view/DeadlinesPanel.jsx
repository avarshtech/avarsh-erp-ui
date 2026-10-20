import { Card, Typography, Tag, Divider, Button } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import {
  SR_STATUS, getEffectiveDispatchDeadline, getEffectiveBuyerApprovalDeadline,
} from '../../../utils/sampleRequestConstants';
import { daysRemaining, deadlineRag, deadlineLabel, RAG_TAG_COLOR } from '../../../utils/deadlineUtils';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;

/**
 * Deadlines panel (PRD §8.3). Each milestone is a roomy stacked block —
 * small-caps label, prominent date, then the live countdown chip — so nothing
 * competes for width inside the narrow side column. Buyer Approval shows
 * "Starts on dispatch" until the sample ships.
 *
 * A re-agreed deadline is shown as the date now being tracked to, with the
 * original struck through beside it: a revision is never mistaken for an edit.
 * The countdown chips count from the revised date. The panel only renders —
 * the owner decides whether a "Revise" action is offered by passing `onRevise`.
 */
const Milestone = ({ label, date, revisedDate, chip, caption, last }) => {
  const effective = revisedDate || date;
  return (
    <>
      <div>
        <Text type="secondary" style={{ fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', display: 'block' }}>
          {label}
        </Text>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <Text strong style={{ fontSize: 16, color: revisedDate ? 'var(--warning-color)' : undefined }}>
              {effective ? formatDate(effective) : '— not set —'}
            </Text>
            {revisedDate && (
              <>
                <Text type="secondary" style={{ textDecoration: 'line-through', opacity: 0.6, fontSize: 12 }}>
                  {formatDate(date)}
                </Text>
                <Tag color="warning" style={{ margin: 0, fontSize: 10 }}>Revised</Tag>
              </>
            )}
          </span>
          {chip}
        </div>
        {caption && <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>{caption}</Text>}
      </div>
      {!last && <Divider style={{ margin: '12px 0' }} />}
    </>
  );
};

const ragChip = (date, muted) => {
  if (!date) return null;
  const days = daysRemaining(date);
  return (
    <Tag color={muted ? 'default' : RAG_TAG_COLOR[deadlineRag(days)]} style={{ marginInlineEnd: 0 }}>
      {deadlineLabel(days)}
    </Tag>
  );
};

const DeadlinesPanel = ({ sr, onRevise }) => {
  const shipped = [SR_STATUS.DISPATCHED, SR_STATUS.FEEDBACK_RECEIVED, SR_STATUS.APPROVED,
    SR_STATUS.REJECTED, SR_STATUS.REVISION_REQUIRED].includes(sr.status);
  const dispatch = getEffectiveDispatchDeadline(sr);
  const approval = getEffectiveBuyerApprovalDeadline(sr);
  return (
    <Card
      size="small"
      title="Deadlines"
      extra={onRevise && (
        <Button
          type="link"
          size="small"
          icon={<CalendarOutlined style={{ fontSize: 12 }} />}
          style={{ padding: 0, height: 'auto', fontSize: 12 }}
          onClick={onRevise}
        >
          {sr.revisedDispatchDeadline ? 'Revise again' : 'Revise'}
        </Button>
      )}
    >
      <Milestone
        label="Sample In-Hand"
        date={sr.inHandDate}
        chip={ragChip(sr.inHandDate, shipped)}
        caption="Date the sample must be ready internally"
      />
      <Milestone
        label="Dispatch Deadline"
        date={sr.dispatchDeadline}
        revisedDate={sr.revisedDispatchDeadline}
        chip={ragChip(dispatch, shipped)}
        caption="Latest date to ship to the buyer"
      />
      <Milestone
        label="Buyer Approval"
        date={sr.buyerApprovalDeadline}
        revisedDate={sr.revisedBuyerApprovalDeadline}
        chip={shipped ? ragChip(approval, false) : <Tag style={{ marginInlineEnd: 0 }}>Starts on dispatch</Tag>}
        caption={shipped ? 'Countdown active — sample is with the buyer' : 'Countdown starts when the sample ships'}
        last
      />
    </Card>
  );
};

export default DeadlinesPanel;
