import { memo } from 'react';
import { Tooltip } from 'antd';
import { fmtDate, GANTT_LABEL_W as LABEL_W } from '../../../utils/tnaConstants';

const Bar = ({ from, to, pos, top, height, color, title }) => {
  const left = pos(from);
  const width = Math.max(pos(to) - left, 0);
  if (width < 0.15) {
    return <div title={title} style={{ position: 'absolute', top: top - 1, left: `calc(${pos(to)}% - 5px)`, width: height + 2, height: height + 2, transform: 'rotate(45deg)', background: color, borderRadius: 2 }} />;
  }
  return <div title={title} style={{ position: 'absolute', top, left: `${left}%`, width: `${width}%`, height, borderRadius: height / 2, background: color }} />;
};

/** One activity lane: frozen baseline (grey), forecast (blue, red at zero/negative float), actual (green). */
const GanttRow = memo(function GanttRow({ a, bars, pos, show, onOpen }) {
  const critical = !a.actualDate && a.floatDays <= 0;
  const tip = (
    <div style={{ fontSize: 12 }}>
      <strong>{a.code} · {a.name}</strong>
      <div>Baseline {fmtDate(a.baselineDate)} · Target {fmtDate(a.revisedTarget)}</div>
      <div>{a.actualDate ? `Actual ${fmtDate(a.actualDate)}` : `Forecast ${fmtDate(a.forecastDate)}`} · Float {a.floatDays} WD</div>
    </div>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 30, borderBottom: '1px solid var(--border-light, transparent)' }}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${a.code} ${a.name}`}
        onClick={() => onOpen(a.code)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(a.code); } }}
        style={{ width: LABEL_W, flexShrink: 0, paddingLeft: 8, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: critical ? 600 : 400 }}
      >
        <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted)', marginRight: 6 }}>{a.code}</span>{a.name}
      </div>
      <Tooltip title={tip}>
        <div style={{ position: 'relative', flex: 1, height: '100%', minWidth: 0 }}>
          {show.includes('baseline') && bars.baseline && <Bar {...bars.baseline} pos={pos} top={5} height={6} color="var(--text-muted)" title="Baseline (frozen)" />}
          {show.includes('forecast') && bars.forecast && <Bar {...bars.forecast} pos={pos} top={13} height={10} color={critical ? 'var(--error-color)' : 'var(--info-color, #3b82f6)'} title="Forecast" />}
          {show.includes('actual') && bars.actual && <Bar {...bars.actual} pos={pos} top={13} height={10} color="var(--success-color)" title="Actual from source" />}
        </div>
      </Tooltip>
    </div>
  );
});

export default GanttRow;
