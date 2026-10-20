import { Drawer, Tag } from 'antd';
import { formatQty, round } from '../engine/util';

/** Achievements earned from today's ERP figures, and the lines ranked by efficiency. */
export default function AchievementsDrawer({ open, onClose, achievements, leaderboard }) {
  return (
    <Drawer title="Achievements" open={open} onClose={onClose} size={420}>
      <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
        Earned only by results recorded in the ERP, judged by the Factory Health rules. Using this screen earns nothing.
      </p>
      <ul className="vf-plain-list" style={{ display: 'grid', gap: 10 }}>
        {achievements.map((a) => (
          <li key={a.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--bg-elevated)', border: `1px solid ${a.earned ? 'var(--primary-color)' : 'var(--border-color)'}` }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 26, filter: a.earned ? 'none' : 'grayscale(1)' }} aria-hidden>{a.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <strong>{a.title}</strong>
                  <Tag color={a.earned ? 'success' : 'default'} variant="filled" style={{ marginInlineEnd: 0 }}>
                    {!a.available ? 'No data today' : a.earned ? 'Earned' : 'Not yet'}
                  </Tag>
                </div>
                {a.available && <div style={{ fontSize: 12.5 }}>{a.holder} · {a.value}</div>}
                <div className="vf-row-detail">{a.detail}</div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <h3 style={{ margin: '18px 0 8px', fontSize: 14 }}>Line leaderboard</h3>
      {leaderboard.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No line is running a plan today.</p>
      ) : (
        <ol style={{ margin: 0, paddingInlineStart: 20 }}>
          {leaderboard.map((l) => (
            <li key={l.id} style={{ padding: '4px 0' }}>
              <strong>{l.line}</strong> {l.style ? `(${l.style})` : ''} · efficiency {l.efficiencyPct == null ? '—' : `${round(l.efficiencyPct, 1)}%`}
              {' · '}{formatQty(l.output)} of {formatQty(l.target)} pcs{l.dhuPct != null ? ` · DHU ${round(l.dhuPct, 1)}%` : ''}
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}
