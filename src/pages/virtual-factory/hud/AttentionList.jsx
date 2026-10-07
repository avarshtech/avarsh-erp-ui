import { Badge } from 'antd';
import { attentionCount } from '../engine/attention';

/** What needs a manager's attention now: bottlenecks, shortages, delays, rejections, late suppliers. */
export default function AttentionList({ items, onPick }) {
  const count = attentionCount(items);
  return (
    <section className="vf-panel" aria-label="Needs attention" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <h2>
        Needs attention
        <Badge count={count} color={count ? '#ef4444' : '#94a3b8'} showZero size="small" />
      </h2>
      {items.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12.5 }}>Nothing needs attention right now.</p>
      ) : (
        <ul className="vf-plain-list" style={{ overflowY: 'auto', margin: '0 -8px' }}>
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className="vf-row-button" onClick={() => onPick(item)}>
                <span className="vf-dot" data-tone={item.severity} aria-hidden />
                <span style={{ minWidth: 0 }}>
                  <span className="vf-row-title" style={{ display: 'block' }}>{item.title}</span>
                  <span className="vf-row-detail">{item.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
