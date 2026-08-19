import { memo, useMemo } from 'react';
import { Space, Switch, Tooltip } from 'antd';
import dayjs from 'dayjs';
import { ACTIVITY_GROUPS, GROUP_COLORS } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import GanttRow from './GanttRow';

const Marker = ({ leftPct, color, label, dashed }) => (
  <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(190px + (100% - 190px) * ${leftPct / 100})`, width: 0, borderLeft: `2px ${dashed ? 'dashed' : 'solid'} ${color}`, zIndex: 2 }}>
    <span style={{ position: 'absolute', top: -20, left: -14, fontSize: 10, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{label}</span>
  </div>
);

/**
 * Baseline / planned / actual timeline. Float renders as a light band after each
 * bar — the backward pass made visible. Critical chain carries a red spine.
 */
const TnaGantt = memo(function TnaGantt({ plan, showBaseline, onToggleBaseline }) {
  const { rangeStart, span, months } = useMemo(() => {
    const start = dayjs(plan.orderReceived).subtract(2, 'day');
    const last = plan.lines.reduce((m, l) => {
      const cands = [l.latestAllowableDate, l.plannedDate, l.actualDate].filter(Boolean);
      return cands.reduce((mm, d) => (dayjs(d).isAfter(mm) ? dayjs(d) : mm), m);
    }, dayjs(plan.etd));
    const end = last.add(4, 'day');
    const ms = [];
    for (let m = start.startOf('month'); !m.isAfter(end); m = m.add(1, 'month')) ms.push(m);
    return { rangeStart: start, span: end.diff(start, 'day'), months: ms };
  }, [plan]);

  const pos = useMemo(() => (d) => Math.min(100, Math.max(0, (dayjs(d).diff(rangeStart, 'day') / span) * 100)), [rangeStart, span]);
  const grouped = useMemo(() => ACTIVITY_GROUPS
    .map((g) => ({ group: g, rows: plan.lines.filter((l) => l.group === g) }))
    .filter((g) => g.rows.length), [plan.lines]);
  const todayPct = pos(dayjs());

  return (
    <div>
      <Space style={{ marginBottom: 20, width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Space size={16} style={{ fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span><span style={{ display: 'inline-block', width: 18, height: 8, borderRadius: 4, background: 'var(--primary-color)', marginRight: 5, verticalAlign: 'middle' }} />Planned</span>
          <span><span style={{ display: 'inline-block', width: 18, height: 8, borderRadius: 4, background: 'color-mix(in srgb, var(--primary-color) 14%, transparent)', marginRight: 5, verticalAlign: 'middle' }} />Float</span>
          <span><span style={{ display: 'inline-block', width: 2, height: 12, background: 'var(--text-secondary)', marginRight: 5, verticalAlign: 'middle' }} />Baseline</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--success-color)', marginRight: 5, verticalAlign: 'middle' }} />Actual</span>
          <span style={{ color: 'var(--error-color)', fontWeight: 600 }}>▍Critical chain</span>
        </Space>
        <Space size={6}>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Baseline</span>
          <Switch size="small" checked={showBaseline} onChange={onToggleBaseline} />
        </Space>
      </Space>

      <div style={{ position: 'relative', paddingTop: 22 }}>
        <div style={{ position: 'relative', marginLeft: 190, height: 18 }}>
          {months.map((m) => (
            <span key={m.format('YYYY-MM')} style={{ position: 'absolute', left: `${pos(m)}%`, fontSize: 10, color: 'var(--text-muted)', borderLeft: '1px solid var(--border-color)', paddingLeft: 4 }}>
              {m.format('MMM YYYY')}
            </span>
          ))}
        </div>
        {todayPct > 0 && todayPct < 100 && <Marker leftPct={todayPct} color="var(--info-color)" label="Today" />}
        <Tooltip title={`ETD ${dayjs(plan.etd).format(DATE_FORMAT)} — goods must leave the factory`}>
          <div><Marker leftPct={pos(plan.etd)} color="var(--error-color)" label="ETD" dashed /></div>
        </Tooltip>

        {grouped.map(({ group, rows }) => (
          <div key={group}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 2px', paddingLeft: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: GROUP_COLORS[group] }} />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{group}</span>
            </div>
            {rows.map((l) => <GanttRow key={l.code} line={l} pos={pos} showBaseline={showBaseline} />)}
          </div>
        ))}
      </div>
    </div>
  );
});

export default TnaGantt;
