import { Button, Progress, Tooltip } from 'antd';
import { BAND_COLOUR } from './tokens';
const BAND_TEXT = { good: 'Healthy', watch: 'Needs watching', alert: 'Needs action', none: 'Waiting for data' };

/** The factory's health score, its five pillars, and how each one is worked out (on hover). */
export default function HealthCard({ health, onRules }) {
  const scored = health.pillars.filter((p) => p.score != null).length;
  return (
    <section className="vf-panel" aria-label="Factory health">
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <Progress
          type="circle"
          percent={health.score ?? 0}
          size={76}
          strokeColor={BAND_COLOUR[health.band]}
          format={() => (health.score == null ? '—' : health.score)}
        />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0 }}>Factory health</h2>
          <div style={{ color: BAND_COLOUR[health.band], fontWeight: 600, fontSize: 12.5 }}>{BAND_TEXT[health.band]}</div>
          {scored > 0 && scored < health.pillars.length && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Based on {scored} of {health.pillars.length} areas with data today</div>
          )}
          <Button type="link" size="small" onClick={onRules} style={{ padding: 0, height: 'auto' }}>How it is scored</Button>
        </div>
      </div>
      <ul className="vf-plain-list" style={{ marginTop: 8 }}>
        {health.pillars.map((p) => (
          <li key={p.key}>
            <Tooltip title={p.summary} placement="right">
              <div tabIndex={0} role="group" aria-label={`${p.label}: ${p.score ?? 'no data'}. ${p.summary}`}
                style={{ display: 'grid', gridTemplateColumns: '84px 1fr 34px', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 12.5 }}>
                <span style={{ color: 'var(--text-secondary)' }}>{p.label}</span>
                <Progress percent={p.score ?? 0} size="small" showInfo={false} strokeColor={BAND_COLOUR[p.band]} />
                <span style={{ textAlign: 'right', fontWeight: 600 }}>{p.score ?? '—'}</span>
              </div>
            </Tooltip>
          </li>
        ))}
      </ul>
    </section>
  );
}
