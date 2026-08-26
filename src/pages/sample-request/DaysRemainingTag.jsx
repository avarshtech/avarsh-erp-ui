import { Tag, Typography } from 'antd';
import { daysRemaining, deadlineRag, deadlineLabel, RAG_TAG_COLOR } from '../../utils/deadlineUtils';
import { formatDate } from '../../utils/formatters';

const { Text } = Typography;

/**
 * Deadline chip — PRD thresholds (green >7d, amber 3–7d, red <3d/overdue).
 * `showDate` renders the formatted date beside the chip (form/detail usage);
 * without it the chip stands alone (list "Days Remaining" column).
 */
const DaysRemainingTag = ({ date, showDate = false, muted = false }) => {
  if (!date) return <Text type="secondary">— not set —</Text>;
  const days = daysRemaining(date);
  const rag = deadlineRag(days);
  const chip = (
    <Tag color={muted ? 'default' : RAG_TAG_COLOR[rag]} style={{ marginInlineEnd: 0 }}>
      {deadlineLabel(days)}
    </Tag>
  );
  if (!showDate) return chip;
  return (
    <span style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Text>{formatDate(date)}</Text>
      {chip}
    </span>
  );
};

export default DaysRemainingTag;
