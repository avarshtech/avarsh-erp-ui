import { Tag } from 'antd';

const SHOWN = 7;

/** The latest business events, newest first; each one points at where it happened. */
export default function EventTicker({ events, onPick, onReplay }) {
  const recent = events.slice(-SHOWN).reverse();
  return (
    <section className="vf-panel vf-ticker" aria-label="What is happening" aria-live="polite" style={{ padding: '10px 12px' }}>
      <h2>What is happening</h2>
      {recent.length === 0 ? (
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 12.5 }}>
          New transactions appear here as the ERP records them.{' '}
          {onReplay && <button type="button" className="vf-row-button" style={{ display: 'inline', width: 'auto', padding: 0, color: 'var(--primary-color)' }} onClick={onReplay}>Replay today</button>}
        </p>
      ) : (
        <ul className="vf-plain-list" style={{ margin: '0 -8px', maxHeight: 156, overflowY: 'auto' }}>
          {recent.map((e) => (
            <li key={e.id}>
              <button type="button" className="vf-row-button" onClick={() => onPick(e)} style={{ padding: '5px 8px' }}>
                <span className="vf-dot" data-tone={e.priority} aria-hidden />
                <span style={{ minWidth: 0 }}>
                  <span className="vf-row-title" style={{ display: 'block' }}>
                    {e.icon} {e.label}
                    {e.replay && <Tag variant="filled" style={{ marginInlineStart: 6, fontSize: 10.5 }}>replay</Tag>}
                    {e.demo && <Tag variant="filled" color="warning" style={{ marginInlineStart: 6, fontSize: 10.5 }}>demo data</Tag>}
                    {e.id.startsWith('sim-') && <Tag variant="filled" color="purple" style={{ marginInlineStart: 6, fontSize: 10.5 }}>simulated</Tag>}
                  </span>
                  <span className="vf-row-detail">{[e.title, e.detail].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
