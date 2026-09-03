import { Alert, Button, Tag, Typography } from 'antd';
import { RAG_TAG_COLOR, deadlineLabel, deadlineRag } from '../../../utils/deadlineUtils';

const { Text } = Typography;

const MAX_CHIPS = 8;

/**
 * The submitted sample requests the store has not issued to yet, most urgent
 * first. Each chip opens the active side of the register's form with that
 * request preselected, so the store never has to find it in a select again.
 *
 * The server sends the in-hand date and the day count; the colour is derived
 * here with the one threshold the SR screens share, so a deadline never reads
 * as two severities in two places.
 */
const AwaitingSrsAlert = ({ awaitingSrs = [], canAdd, onIssue }) => {
  if (!awaitingSrs.length) return null;
  const plural = awaitingSrs.length > 1;

  return (
    <Alert
      type="warning" showIcon style={{ marginBottom: 16 }}
      message={`${awaitingSrs.length} submitted sample request${plural ? 's are' : ' is'} awaiting material issue`}
      description={(
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
          {awaitingSrs.slice(0, MAX_CHIPS).map((s) => (
            <Tag
              key={s.id}
              color={RAG_TAG_COLOR[deadlineRag(s.inHandDays)]}
              style={{ cursor: canAdd ? 'pointer' : 'default', marginInlineEnd: 0, whiteSpace: 'nowrap' }}
              onClick={() => canAdd && onIssue(s.id)}
            >
              {s.srNo} · {s.sampleTypeName} · in-hand {deadlineLabel(s.inHandDays)}
              {s.priority === 'URGENT' ? ' · urgent' : ''}
            </Tag>
          ))}
          {awaitingSrs.length > MAX_CHIPS && (
            <Text type="secondary">{`+${awaitingSrs.length - MAX_CHIPS} more`}</Text>
          )}
        </div>
      )}
      action={canAdd && (
        <Button size="small" type="primary" onClick={() => onIssue(null)}>
          Issue materials →
        </Button>
      )}
    />
  );
};

export default AwaitingSrsAlert;
