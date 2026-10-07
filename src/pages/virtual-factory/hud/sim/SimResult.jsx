import { Collapse, Tag } from 'antd';
import { formatQty } from '../../engine/util';
import { hasWhatIf } from '../../engine/simulation/scenarios';

const STAGE = { cutting: 'Cutting', sewing: 'Sewing', finishing: 'Finishing', packing: 'Packing', qc: 'QC (rework)' };
const fmt = (day) => (day ? new Date(`${day}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) : '—');
const span = (w) => {
  if (w.startDay == null) return 'not reached';
  if (w.endDay == null) return `from day ${w.startDay + 1}`;
  return w.endDay === w.startDay ? `day ${w.startDay + 1}` : `days ${w.startDay + 1} to ${w.endDay + 1}`;
};
/** The timeline as text, for screen readers: each stage's working days, the slowest one marked. */
const describe = (result) => `Stage timeline in working days: ${result.stageWindows
  .map((w) => `${STAGE[w.key]} ${span(w)}${w.key === result.bottleneck ? ' (slowest step)' : ''}`).join('; ')}`;

/** The answer: when the order ships, against its due date and against today's plan, and why. */
export default function SimResult({ scenario, capacities, comparison }) {
  const { result, deltaDays } = comparison;
  const hours = Math.max(1, result.totalHours);
  const slack = result.slackDays;
  return (
    <div>
      <div className="vf-ticket-kind">Predicted shipment</div>
      <div style={{ fontSize: 20, fontWeight: 700 }}>{result.finished ? fmt(result.completionDate) : 'Not within a year'}</div>
      <div style={{ margin: '2px 0 8px' }}>
        {slack != null && <Tag color={slack >= 0 ? 'success' : 'error'} variant="filled">{slack >= 0 ? `${slack} day${slack === 1 ? '' : 's'} before due` : `${-slack} day${slack === -1 ? '' : 's'} late`}</Tag>}
        {scenario.dueDay && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Due {fmt(scenario.dueDay)}</span>}
      </div>
      {hasWhatIf(scenario) && deltaDays != null && (
        <p style={{ margin: '0 0 8px', fontSize: 12.5 }}>
          Against today&apos;s plan: <strong>{deltaDays === 0 ? 'no change' : `${Math.abs(deltaDays)} day${Math.abs(deltaDays) === 1 ? '' : 's'} ${deltaDays < 0 ? 'sooner' : 'later'}`}</strong>
        </p>
      )}
      {result.urgentCompletionDate && <p style={{ margin: '0 0 8px', fontSize: 12.5 }}>The urgent order ships {fmt(result.urgentCompletionDate)}.</p>}

      <div role="img" aria-label={describe(result)} style={{ display: 'grid', gap: 4, margin: '6px 0 8px' }}>
        {result.stageWindows.map((w) => (
          <div key={w.key} style={{ display: 'grid', gridTemplateColumns: '70px 1fr', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <span style={{ color: 'var(--text-secondary)' }}>{STAGE[w.key]}</span>
            <div style={{ position: 'relative', height: 10, background: 'var(--bg-tertiary)', borderRadius: 5 }}>
              {w.startHour != null && (
                <div style={{ position: 'absolute', top: 0, bottom: 0, borderRadius: 5, background: w.key === result.bottleneck ? '#ef4444' : 'var(--primary-color)', left: `${(w.startHour / hours) * 100}%`, width: `${Math.max(2, ((w.endHour - w.startHour + 1) / hours) * 100)}%` }} />
              )}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '0 0 6px', fontSize: 12.5 }}>
        Slowest step: <strong>{STAGE[result.bottleneck] || '—'}</strong>
        {' · '}sewing {formatQty(result.sewingPerDay)} pcs a day · fabric ready {fmt(result.materialReadyDate)}
      </p>
      <Collapse size="small" ghost items={[{ key: 'basis', label: 'What the simulation assumes', children: (
        <ul style={{ margin: 0, paddingInlineStart: 18, fontSize: 12 }}>
          {capacities.basis.map((b) => <li key={b}>{b}</li>)}
          <li>A {capacities.hoursPerDay}-hour day{capacities.sundayOff ? ', Sundays off' : ''}; rejected pieces go back to sewing first.</li>
        </ul>
      ) }]} />
    </div>
  );
}
