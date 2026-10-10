import { memo, useMemo, useState } from 'react';
import {
  Checkbox, Col, Row, Space, Switch,
} from 'antd';
import dayjs from 'dayjs';
import { toDay, fromDay } from '../../../services/tna/tnaCalendar';
import { fmtDate, GANTT_LABEL_W as LABEL_W } from '../../../utils/tnaConstants';
import GanttRow from './GanttRow';

const SHOW_OPTIONS = [{ value: 'baseline', label: 'Baseline' }, { value: 'forecast', label: 'Forecast' }, { value: 'actual', label: 'Actual' }];
const latest = (dates) => dates.filter(Boolean).reduce((m, d) => (d > m ? d : m), '0000-00-00');

const Marker = ({ pct, color, label, dashed, row }) => (
  <div style={{ position: 'absolute', top: 0, bottom: 0, left: `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${pct / 100})`, borderLeft: `2px ${dashed ? 'dashed' : 'solid'} ${color}`, zIndex: 2 }}>
    <span style={{ position: 'absolute', top: -16 - row * 13, ...(pct > 80 ? { right: 4 } : { left: 4 }), fontSize: 10, fontWeight: 700, color, whiteSpace: 'nowrap' }}>{label}</span>
  </div>
);

const Fact = ({ label, children }) => (
  <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '8px 12px', height: '100%' }}>
    <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-muted)' }}>{label}</div>
    <div style={{ fontWeight: 600, marginTop: 2 }}>{children}</div>
  </div>
);

/**
 * WF-03 — baseline, forecast and actual as distinct bars; both dispatch commitments are fixed
 * markers that execution never redraws (FR-8.4, FR-4.1). Criticality is float against the latest
 * commitment (FR-3.7); the chain into dispatch is the network's longest path (FR-7.7).
 */
const TnaGantt = memo(function TnaGantt({ header, activities, onOpen }) {
  const [show, setShow] = useState(['baseline', 'forecast', 'actual']);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const byCode = useMemo(() => Object.fromEntries(activities.map((a) => [a.code, a])), [activities]);
  const asOf = header.asOf;

  const bars = useMemo(() => Object.fromEntries(activities.map((a) => {
    const preds = a.predecessors.map((p) => byCode[p]);
    const baseStart = preds.length ? latest(preds.map((p) => p.baselineDate)) : header.orderDate;
    const doneStart = preds.length ? latest(preds.map((p) => p.actualDate || p.forecastDate)) : header.orderDate;
    const openStart = latest([doneStart, asOf]);
    return [a.code, {
      baseline: a.baselineDate ? { from: baseStart > a.baselineDate ? a.baselineDate : baseStart, to: a.baselineDate } : null,
      forecast: !a.actualDate ? { from: openStart > a.forecastDate ? a.forecastDate : openStart, to: a.forecastDate } : null,
      actual: a.actualDate ? { from: doneStart > a.actualDate ? a.actualDate : doneStart, to: a.actualDate } : null,
    }];
  })), [activities, byCode, header.orderDate, asOf]);

  const range = useMemo(() => {
    const start = toDay(header.orderDate) - 2;
    const end = toDay(latest([header.latestCommitment, header.originalCommitment, header.forecastDispatch, ...activities.map((a) => a.forecastDate)])) + 5;
    return { start, span: end - start };
  }, [header, activities]);
  const pos = useMemo(() => (d) => Math.min(100, Math.max(0, ((toDay(d) - range.start) / range.span) * 100)), [range]);
  const months = useMemo(() => {
    const out = [];
    for (let m = dayjs(fromDay(range.start)).startOf('month').add(1, 'month'); toDay(m.format('YYYY-MM-DD')) < range.start + range.span; m = m.add(1, 'month')) out.push(m);
    return out;
  }, [range]);

  const chain = header.longestPath || [];
  const rows = criticalOnly ? activities.filter((a) => chain.includes(a.code)) : activities;

  return (
    <div>
      <Space wrap style={{ marginBottom: 28, width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <span style={{ fontSize: 12 }}>Show</span>
          <Checkbox.Group options={SHOW_OPTIONS} value={show} onChange={setShow} />
          <Switch size="small" checked={criticalOnly} onChange={setCriticalOnly} aria-label="Longest path only" />
          <span style={{ fontSize: 12 }}>Longest path only</span>
        </Space>
        <Space size={14} wrap style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          <span><span style={{ display: 'inline-block', width: 16, height: 6, borderRadius: 3, background: 'var(--text-muted)', marginRight: 4 }} />Baseline (frozen)</span>
          <span><span style={{ display: 'inline-block', width: 16, height: 8, borderRadius: 4, background: 'var(--info-color, #3b82f6)', marginRight: 4 }} />Forecast</span>
          <span><span style={{ display: 'inline-block', width: 16, height: 8, borderRadius: 4, background: 'var(--error-color)', marginRight: 4 }} />Forecast, zero or negative float</span>
          <span><span style={{ display: 'inline-block', width: 16, height: 8, borderRadius: 4, background: 'var(--success-color)', marginRight: 4 }} />Actual from source</span>
        </Space>
      </Space>
      <div style={{ position: 'relative', paddingTop: 30 }}>
        <div style={{ position: 'relative', marginLeft: LABEL_W, height: 16 }}>
          {months.map((m) => (
            <span key={m.format('YYYY-MM')} style={{ position: 'absolute', left: `${pos(m.format('YYYY-MM-DD'))}%`, fontSize: 10, color: 'var(--text-muted)', borderLeft: '1px solid var(--border-color)', paddingLeft: 3 }}>{m.format('MMM YYYY')}</span>
          ))}
        </div>
        <Marker pct={pos(asOf)} color="var(--warning-color)" label="Today" row={0} />
        <Marker pct={pos(header.originalCommitment)} color="var(--text-primary)" label={`Original ${fmtDate(header.originalCommitment)}`} row={1} />
        {header.latestCommitment !== header.originalCommitment && <Marker pct={pos(header.latestCommitment)} color="var(--primary-color)" label={`Latest ${fmtDate(header.latestCommitment)}`} row={0} dashed />}
        {rows.map((a) => <GanttRow key={a.code} a={a} bars={bars[a.code]} pos={pos} show={show} onOpen={onOpen} />)}
      </div>
      <Row gutter={[10, 10]} style={{ marginTop: 14 }}>
        <Col xs={24} md={6}><Fact label="Original commitment">{fmtDate(header.originalCommitment)}</Fact></Col>
        <Col xs={24} md={6}><Fact label="Latest commitment">{fmtDate(header.latestCommitment)}</Fact></Col>
        <Col xs={24} md={12}>
          <Fact label="Longest path driving dispatch">
            <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>{chain.join(' → ')}</span>
          </Fact>
        </Col>
      </Row>
    </div>
  );
});

export default TnaGantt;
