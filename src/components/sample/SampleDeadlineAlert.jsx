import { Alert, Tag } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DISMISS_KEY = 'avarsh.sr.deadlineAlertDismissed';

const readDismissed = () => {
  try { return sessionStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
};

/**
 * 48-hour / overdue dispatch-deadline alert strip (PRD v3 §8.1 + §12.2 — one
 * component, two placements). Chip colour matches the Days Remaining
 * thresholds so a deadline never reads as two severities. Dismissal lasts the
 * browser session.
 */
const SampleDeadlineAlert = ({ alerts = [], style }) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed || !alerts.length) return null;
  const anyOverdue = alerts.some((a) => a.overdue);

  return (
    <Alert
      type={anyOverdue ? 'error' : 'warning'}
      showIcon
      closable
      onClose={() => {
        setDismissed(true);
        try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* noop */ }
      }}
      style={{ marginBottom: 16, ...style }}
      message={
        <span>
          <strong>{alerts.length} sample{alerts.length > 1 ? 's are' : ' is'} overdue or due within 48 hours.</strong>
          <span style={{ marginInlineStart: 12 }}>
            {alerts.map((a) => (
              <Tag
                key={a.id}
                color={a.overdue ? 'red' : 'orange'}
                style={{ cursor: 'pointer', marginBottom: 4 }}
                onClick={() => navigate(`/sample-requests/list?viewId=${a.id}`)}
              >
                {a.srNo} · {a.sampleTypeName} · {a.styleNo} · {a.overdue ? `Overdue ${-a.days}d` : a.days === 0 ? 'Due today' : `Due in ${a.days}d`}
              </Tag>
            ))}
          </span>
        </span>
      }
    />
  );
};

export default SampleDeadlineAlert;
