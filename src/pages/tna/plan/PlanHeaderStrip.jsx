import { memo } from 'react';
import { Alert, Card, Col, Progress, Row, Tag, Tooltip } from 'antd';
import dayjs from 'dayjs';
import StatusTag from '../../../components/StatusTag';
import RagBadge from '../components/RagBadge';
import { PLAN_STATUS, FEASIBILITY } from '../../../utils/tnaConstants';
import { DATE_FORMAT } from '../../../utils/uiConstants';

const Field = ({ label, value, mono, tip }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    <Tooltip title={tip}>
      <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: mono ? 'monospace' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </Tooltip>
  </div>
);

const Big = ({ label, value, color, tip }) => (
  <Tooltip title={tip}>
    <div style={{ textAlign: 'center', padding: '0 18px', borderLeft: '1px solid var(--border-color)' }}>
      <div style={{ fontSize: 24, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  </Tooltip>
);

/** §10.1 header block — the plan's flight strip, every figure derived, every figure explained. */
const PlanHeaderStrip = memo(function PlanHeaderStrip({ plan }) {
  const fmt = (d) => dayjs(d).format(DATE_FORMAT);
  const delay = plan.projectedDelay;
  return (
    <Card size="small" style={{ marginBottom: 12 }} styles={{ body: { padding: '14px 18px' } }}>
      <Row gutter={[16, 12]} align="middle">
        <Col xs={24} lg={13}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 700 }}>{plan.orderNo}</span>
            <RagBadge rag={plan.rag} />
            <StatusTag status={plan.planStatus} config={PLAN_STATUS} getLabel={(s) => PLAN_STATUS[s].label} />
            <Tag>v{plan.planVersion}{plan.replanCount ? ` · ${plan.replanCount} re-plan${plan.replanCount > 1 ? 's' : ''}` : ' · baseline'}</Tag>
          </div>
          <Row gutter={[14, 10]}>
            <Col xs={12} md={6}><Field label="Buyer" value={plan.buyer} /></Col>
            <Col xs={12} md={6}><Field label="Style" value={plan.styleNo} mono /></Col>
            <Col xs={12} md={6}><Field label="Product" value={plan.productType} /></Col>
            <Col xs={12} md={6}><Field label="Qty" value={`${plan.qty.toLocaleString()} ${plan.uom}`} mono /></Col>
            <Col xs={12} md={6}><Field label="Received" value={fmt(plan.orderReceived)} tip="Forward-pass anchor — buyer PO confirmation date" /></Col>
            <Col xs={12} md={6}><Field label="ETD" value={fmt(plan.etd)} tip="Backward-pass anchor — goods must leave the factory" /></Col>
            <Col xs={12} md={6}><Field label="Template" value={`${plan.templateCode} v${plan.templateVersion}`} mono tip="Resolved by buyer + product type precedence (§7.4)" /></Col>
            <Col xs={12} md={6}><Field label="Merchandiser" value={plan.merchandiser} /></Col>
          </Row>
        </Col>
        <Col xs={24} lg={11}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap', rowGap: 10 }}>
            <Big label="Leadtime" value={`${plan.leadtime}d`} color="var(--primary-color)" tip="ETD − order received, calendar days. The driver of the whole plan — never keyed in." />
            <Big label="Projected Dispatch" value={fmt(plan.projectedDispatch)} color={delay > 0 ? 'var(--error-color)' : 'var(--text-primary)'} tip="Recomputed live: actuals recorded so far + remaining planned durations. A projection, not a re-plan." />
            <Big label="Projected Delay" value={delay > 0 ? `+${delay}d` : delay === 0 ? '0d' : `${delay}d`} color={delay > 0 ? 'var(--error-color)' : 'var(--success-color)'} tip="Projected dispatch − ETD. Positive means late. The number management reads first." />
            <div style={{ padding: '0 18px', borderLeft: '1px solid var(--border-color)', minWidth: 120 }}>
              <Progress type="circle" percent={plan.progressPct} size={56} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Progress</div>
            </div>
          </div>
        </Col>
      </Row>
      {plan.feasibility !== 'FEASIBLE' && (
        <Alert
          style={{ marginTop: 12 }}
          type={plan.feasibility === 'INFEASIBLE' ? 'error' : 'warning'}
          showIcon
          title={plan.feasibility === 'INFEASIBLE'
            ? `Infeasible — critical path exceeds the leadtime by ${plan.shortfallDays} days even with every activity at its floor. Plan is in Draft and NOT activated: negotiate a later ETD, switch to an express template, or record a management override.`
            : `Compressed to fit — ${plan.compressedDays} day${plan.compressedDays > 1 ? 's' : ''} squeezed out of ${Object.keys(plan.compressedFrom || {}).join(', ')}. Float on the critical path is zero: this order has no tolerance for slippage.`}
        />
      )}
    </Card>
  );
});

export default PlanHeaderStrip;
