import { memo } from 'react';
import { Descriptions, Tag } from 'antd';
import {
  ATTRIBUTION, DURATION_SOURCE, SOURCE_STATUS, fmtDate, fmtDateTime, fmtText, signedDays,
} from '../../../utils/tnaConstants';
import DeltaTag from '../components/DeltaTag';
import SourceLink from '../components/SourceLink';

const section = (title, items) => (
  <Descriptions
    key={title}
    title={<span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)' }}>{title}</span>}
    size="small"
    column={1}
    bordered
    style={{ marginBottom: 14 }}
    styles={{ label: { width: 190 } }}
    items={items.filter(Boolean).map(([label, children], i) => ({ key: `${title}-${i}`, label, children }))}
  />
);

const qty = (n, uom) => (n == null ? '—' : `${n.toLocaleString('en-IN')} ${uom || ''}`.trim());

/** WF-05 body: dates, completion evidence, attribution, downstream impact — every value derived. */
const ActivityFacts = memo(function ActivityFacts({ detail }) {
  const { activity: a, attribution, impact } = detail;
  const ev = a.evidence;
  const dates = section('Dates', [
    [a.postBaseline ? 'Baseline (addendum)' : 'Baseline (B0, frozen)', a.baselineDate ? fmtDate(a.baselineDate) : 'None — provisional, outside the baseline'],
    ['Revised target', fmtDate(a.revisedTarget)],
    ['Latest allowable', `${fmtDate(a.latestAllowable)} (latest) · ${fmtDate(a.latestAllowableOriginal)} (original)`],
    !a.actualDate && ['Forecast', fmtDate(a.forecastDate)],
    ['Actual', a.actualDate ? <strong>{fmtDate(a.actualDate)}</strong> : '—'],
    ['Variance vs baseline', <DeltaTag key="v" value={a.baselineVariance} unit="WD" />],
    a.revisedVariance != null && ['Variance vs target at completion', <DeltaTag key="r" value={a.revisedVariance} unit="WD" />],
    ['Float', <span key="f"><span style={{ color: a.floatDays <= 0 ? 'var(--error-color)' : undefined, fontWeight: 600 }}>{signedDays(a.floatDays, 'WD')}</span> vs latest · <span style={{ color: a.floatDaysOriginal <= 0 ? 'var(--error-color)' : undefined }}>{signedDays(a.floatDaysOriginal, 'WD')}</span> vs original</span>],
    ['Duration', `${a.duration} ${a.dayType === 'CD' ? 'calendar' : 'working'} days · ${DURATION_SOURCE[a.durationSource]}`],
  ]);
  const evidence = section('Completion evidence', [
    ['Source screen', <span key="s">{a.sourceScreen} <Tag color={SOURCE_STATUS[a.sourceStatus].color} style={{ marginLeft: 6 }}>{SOURCE_STATUS[a.sourceStatus].label}</Tag></span>],
    ['Completion event', <span key="e"><code>{a.completionEvent}</code>{a.threshold ? ` ≥ ${a.threshold}%` : ''}{a.eventNote ? ` — ${a.eventNote}` : ''}</span>],
    a.proposal && ['Proposed enhancement', a.proposal],
    a.awaitingSource && ['Awaiting source enhancement', a.missingNote],
    ['Source record', <SourceLink key="r" module={ev?.sourceModule || a.sourceModule} record={ev?.sourceRecord || a.sourceRecord} />],
    ev && ['Posted by', ev.postedBy],
    a.requiredQty != null && ['Accepted / required', `${qty(a.achievedQty || 0, a.uom)} of ${qty(a.requiredQty, a.uom)} (${a.progressPct || (a.actualDate ? 100 : 0)}%)`],
    a.partials?.length > 1 && ['Earlier partial postings', a.partials.slice(0, -1).map((p) => `${p.ref} · ${qty(p.qty, a.uom)} · ${fmtDate(p.at)} — threshold not met`).join('; ')],
    a.outcome === 'REJECTED' && ['Outcome', <Tag key="o" color="red">Rejected — a new cycle was opened</Tag>],
    ev && ['Synchronised', `${fmtDateTime(ev.at)} · event ${ev.event}${ev.amendedFrom ? ` · source amended from ${fmtDateTime(ev.amendedFrom)}` : ''}`],
  ]);
  const cat = attribution && ATTRIBUTION[attribution.category];
  const attr = section('Delay attribution', attribution ? [
    ['Attributed to', <Tag key="a" color={cat.color}>{cat.label}</Tag>],
    ['Derived from', fmtText(attribution.derivedFrom) || '—'],
    ['Evidence record', attribution.evidenceRecord ? <code>{attribution.evidenceRecord}</code> : '—'],
    ['Reason', fmtText(attribution.reasonText)],
  ] : [['Attributed to', 'Not late — nothing to attribute']]);
  const imp = section('Downstream impact', impact ? [
    ['Plan version', `v${impact.versionNo} · ${fmtDateTime(impact.createdAt)}`],
    ['Activities moved', `${impact.activitiesMoved} of ${impact.total}`],
    ['Projected dispatch before', fmtDate(impact.projectedBefore)],
    ['Projected dispatch after', fmtDate(impact.projectedAfter)],
    ['Net order impact', <span key="n"><DeltaTag value={impact.netImpact} /> via the longest path — never a sum of activity variances</span>],
  ] : [['Net order impact', 'No completion recorded yet']]);
  return <>{dates}{evidence}{attr}{imp}</>;
});

export default ActivityFacts;
