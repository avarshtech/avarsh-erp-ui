import { memo, useMemo } from 'react';
import { Tooltip } from 'antd';
import { StarFilled } from '@ant-design/icons';
import dayjs from 'dayjs';
import TnaStatusTag from '../components/TnaStatusTag';
import { ACTIVITY_GROUPS, GROUP_COLORS } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';

/** Swim-lane view — one lane per activity group (§7.1), progress reading left to right. */
const PlanSwimlane = memo(function PlanSwimlane({ plan, onOpenLine }) {
  const lanes = useMemo(() => ACTIVITY_GROUPS
    .map((g) => ({ group: g, rows: plan.lines.filter((l) => l.group === g) }))
    .filter((g) => g.rows.length), [plan.lines]);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 12, minWidth: lanes.length * 250 }}>
        {lanes.map(({ group, rows }) => (
          <div key={group} style={{ flex: '1 0 238px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '2px 4px' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: GROUP_COLORS[group] }} />
              <span style={{ fontWeight: 700, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>{group}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                {rows.filter((l) => l.actualDate).length}/{rows.length}
              </span>
            </div>
            {rows.map((l) => (
              <Tooltip key={l.code} title={l.predecessors.length ? `After ${l.predecessors.join(', ')} · ${l.responsible}` : l.responsible}>
                <div
                  onClick={() => onOpenLine?.(l)}
                  style={{
                    background: 'var(--card-bg)', borderRadius: 'var(--radius-md)', padding: '8px 10px', marginBottom: 8,
                    borderLeft: `3px solid ${l.isCritical ? 'var(--error-color)' : GROUP_COLORS[group]}`,
                    boxShadow: 'var(--shadow-sm)', cursor: onOpenLine ? 'pointer' : 'default',
                    opacity: l.actualDate ? 0.75 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontFamily: 'monospace', fontSize: 10.5, color: 'var(--text-muted)' }}>{l.code}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</span>
                    {l.milestone && <StarFilled style={{ color: 'var(--accent-color)', fontSize: 10 }} />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 5 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                      {dayjs(l.actualDate || l.plannedDate).format(DATE_FORMAT)}
                    </span>
                    <TnaStatusTag status={l.status} size="small" />
                  </div>
                </div>
              </Tooltip>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
});

export default PlanSwimlane;
