import { memo } from 'react';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import { GROUP_COLORS } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';

const fmt = (d) => dayjs(d).format(DATE_FORMAT);

/** One Gantt lane: float band, planned bar, baseline tick, actual marker. */
const GanttRow = memo(function GanttRow({ line: l, pos, showBaseline }) {
  const color = GROUP_COLORS[l.group] || 'var(--primary-color)';
  const start = pos(dayjs(l.plannedDate).subtract(l.effectiveDays, 'day'));
  const end = pos(l.plannedDate);
  const late = l.deviationDays > 0;
  const tip = (
    <div style={{ fontSize: 12 }}>
      <strong>{l.code} · {l.name}</strong>
      <div>Duration: {l.effectiveDays}d{l.compressedBy ? ` (compressed −${l.compressedBy}d)` : ''}</div>
      <div>Planned: {fmt(l.plannedDate)} · Latest: {fmt(l.latestAllowableDate)} · Float: {l.floatDays}d</div>
      {l.actualDate && <div>Actual: {fmt(l.actualDate)} ({l.actualSource})</div>}
      {l.predecessors.length > 0 && <div>After: {l.predecessors.join(', ')}</div>}
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 30 }}>
      <div style={{
        width: 190, flexShrink: 0, paddingRight: 10, display: 'flex', alignItems: 'center', gap: 6,
        borderLeft: l.isCritical ? '3px solid var(--error-color)' : '3px solid transparent', paddingLeft: 8,
      }}
      >
        <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{l.code}</span>
        <span style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: l.isCritical ? 600 : 400 }}>
          {l.shortName || l.name}
        </span>
      </div>
      <Tooltip title={tip}>
        <div style={{ position: 'relative', flex: 1, height: '100%', minWidth: 0 }}>
          {l.floatDays > 0 && (
            <div style={{ position: 'absolute', top: 11, left: `${end}%`, width: `${pos(l.latestAllowableDate) - end}%`, height: 8, borderRadius: 4, background: `color-mix(in srgb, ${color} 14%, transparent)` }} />
          )}
          {l.effectiveDays > 0 ? (
            <div style={{ position: 'absolute', top: 9, left: `${start}%`, width: `${Math.max(end - start, 0.4)}%`, height: 12, borderRadius: 6, background: color, opacity: l.actualDate ? 0.45 : 0.9 }} />
          ) : (
            <div style={{ position: 'absolute', top: 10, left: `calc(${end}% - 5px)`, width: 10, height: 10, transform: 'rotate(45deg)', background: color, opacity: l.actualDate ? 0.45 : 0.9, borderRadius: 2 }} />
          )}
          {showBaseline && l.baselineDate !== l.plannedDate && (
            <div style={{ position: 'absolute', top: 5, left: `${pos(l.baselineDate)}%`, width: 2, height: 20, background: 'var(--text-secondary)', borderRadius: 1 }} />
          )}
          {l.actualDate && (
            <>
              {late && (
                <div style={{ position: 'absolute', top: 14, left: `${pos(l.baselineDate)}%`, width: `${Math.max(pos(l.actualDate) - pos(l.baselineDate), 0)}%`, height: 2, background: 'var(--error-color)' }} />
              )}
              <div style={{
                position: 'absolute', top: 9, left: `calc(${pos(l.actualDate)}% - 6px)`, width: 12, height: 12, borderRadius: '50%',
                background: late ? 'var(--error-color)' : 'var(--success-color)', border: '2px solid var(--bg-secondary)', boxShadow: 'var(--shadow-sm)',
              }}
              />
            </>
          )}
        </div>
      </Tooltip>
    </div>
  );
});

export default GanttRow;
