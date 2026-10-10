import { memo, useMemo, useState } from 'react';
import {
  Alert, Select, Space, Switch, Tag,
} from 'antd';
import { LANES, fmtDate, signedDays } from '../../../utils/tnaConstants';

const edgeColour = (a) => {
  if (a.actualDate) return a.status === 'COMPLETED_ON_TIME' ? 'var(--success-color)' : 'var(--error-color)';
  if (a.status === 'OVERDUE') return 'var(--error-color)';
  if (a.status === 'DUE_SOON') return 'var(--warning-color)';
  return 'var(--border-color)';
};

const LaneCard = ({ a, dim, showLines, onOpen }) => (
  <div
    role="button"
    tabIndex={0}
    aria-label={`${a.code} ${a.name}`}
    onClick={() => onOpen(a.code)}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(a.code); } }}
    style={{
      cursor: 'pointer', minWidth: 170, maxWidth: 230, padding: '6px 10px', borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border-color)', borderLeft: `4px solid ${edgeColour(a)}`, background: 'var(--bg-secondary)', opacity: dim ? 0.35 : 1,
    }}
  >
    <div style={{ fontSize: 12, fontWeight: 600 }}>
      {a.code} {a.name}{a.isGate && <Tag color="blue" style={{ marginLeft: 4, marginInlineEnd: 0 }}>gate</Tag>}
    </div>
    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{a.actualDate ? `Actual ${fmtDate(a.actualDate)}` : `Target ${fmtDate(a.revisedTarget)}`}</div>
    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
      {a.actualDate && (a.baselineVariance ? `${signedDays(a.baselineVariance, 'WD')} vs baseline` : 'on baseline')}
      {!a.actualDate && (a.overdueDays > 0 ? `overdue ${a.overdueDays} WD` : a.awaitingSource ? 'awaiting source' : 'open')}
    </div>
    {showLines && a.scope?.lines.map((l) => (
      <div key={l.lineKey} style={{ fontSize: 11, color: 'var(--text-secondary)', borderTop: '1px dashed var(--border-color)', marginTop: 4, paddingTop: 2 }}>
        {l.lineKey} · {l.panel ? `${l.panel} · ` : ''}{l.colours.join(', ')} · {l.qty.toLocaleString('en-IN')}
      </div>
    ))}
  </div>
);

/**
 * WF-04 — grouped by owning source module: where in the business the plan is stuck.
 * Ownership follows the source module; T&A keeps no assignment list (FR-6.5).
 */
const PlanSwimlane = memo(function PlanSwimlane({ activities, driving, onOpen }) {
  const [colours, setColours] = useState([]);
  const [showLines, setShowLines] = useState(false);
  const colourOptions = useMemo(
    () => [...new Set(activities.flatMap((a) => a.scope?.colours || []))].map((c) => ({ value: c, label: c })),
    [activities],
  );
  const dim = (a) => colours.length > 0 && !!a.scope && !a.scope.colours.some((c) => colours.includes(c));
  const lanes = LANES.map((l) => ({ ...l, acts: activities.filter((a) => a.lane === l.key) })).filter((l) => l.acts.length);

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          mode="multiple"
          allowClear
          name="colourway"
          placeholder="Colourway: all"
          style={{ minWidth: 220 }}
          options={colourOptions}
          value={colours}
          onChange={setColours}
        />
        <Space size={6}>
          <Switch size="small" checked={showLines} onChange={setShowLines} aria-label="Expand requirement lines" />
          <span style={{ fontSize: 12 }}>Expand requirement lines (FR-2.5)</span>
        </Space>
      </Space>
      {lanes.map((lane) => (
        <div key={lane.key} style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', background: 'var(--bg-tertiary, var(--bg-secondary))', borderBottom: '1px solid var(--border-color)' }}>
            <strong style={{ fontSize: 13 }}>{lane.label}</strong>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{lane.acts.filter((a) => a.actualDate).length}/{lane.acts.length} complete</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 10 }}>
            {lane.acts.map((a) => <LaneCard key={a.code} a={a} dim={dim(a)} showLines={showLines} onOpen={onOpen} />)}
          </div>
        </div>
      ))}
      {driving && (
        <Alert
          type={driving.overdueDays > 0 ? 'error' : 'info'}
          showIcon
          title={`Driving activity: ${driving.code} ${driving.name} (${driving.sourceModule}). Nothing downstream on the longest path can finish before it. Owner is derived from the source module, not assigned in T&A.`}
        />
      )}
    </div>
  );
});

export default PlanSwimlane;
