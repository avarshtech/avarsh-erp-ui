import { Collapse } from 'antd';
import ActivityTimeline from '../../../components/ActivityTimeline';

/**
 * Collapsible Activity Log (PRD §8.3/§16 audit trail): every status change,
 * field edit (old → new) and upload, with user + timestamp. Import-sourced
 * values are always distinguishable from typed ones.
 */
const ActivityLogPanel = ({ activity = [] }) => {
  const items = activity.map((a) => ({
    ...a,
    type: 'system',
    details: a.field
      ? `${a.field}: ${a.oldValue ?? '—'} → ${a.newValue ?? '—'}${a.importSourced ? ` · set by import from ${a.importSourced}` : ''}`
      : a.details,
  }));
  return (
    <Collapse
      style={{ marginTop: 16 }}
      items={[{
        key: 'activity',
        label: `Activity Log (${items.length})`,
        children: <ActivityTimeline activities={items} maxHeight={280} />,
      }]}
    />
  );
};

export default ActivityLogPanel;
