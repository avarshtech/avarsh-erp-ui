import { Popover, Tag } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';

const STATE = {
  ok: { color: 'success', label: 'Live' },
  demo: { color: 'warning', label: 'Demo data' },
  locked: { color: 'default', label: 'No access' },
  error: { color: 'error', label: 'Not updated' },
};

/** Which ERP sources the factory is reading, and whether each one is live, demo, locked or failing. */
export default function DataStatus({ sources }) {
  const list = Object.entries(sources);
  const problems = list.filter(([, s]) => s.state === 'error').length;
  const content = (
    <ul className="vf-plain-list" style={{ width: 280 }}>
      {list.map(([id, s]) => (
        <li key={id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '3px 0' }}>
          <span>{s.label}</span>
          <Tag color={STATE[s.state]?.color} variant="filled" style={{ marginInlineEnd: 0 }}>{STATE[s.state]?.label || s.state}</Tag>
        </li>
      ))}
    </ul>
  );
  return (
    <Popover content={content} title="Where the factory gets its data" trigger="click">
      <button type="button" className="vf-row-button" style={{ display: 'inline-flex', width: 'auto', padding: '0 4px', color: problems ? 'var(--error-color)' : 'inherit' }}>
        <DatabaseOutlined /> {problems ? `${problems} source${problems > 1 ? 's' : ''} not updated` : `${list.length} sources`}
      </button>
    </Popover>
  );
}
