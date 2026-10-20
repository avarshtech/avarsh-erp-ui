import { memo } from 'react';
import { Alert, Button, Space } from 'antd';
import { fmtDate, fmtDateTime } from '../../../utils/tnaConstants';

/**
 * Plan-level states the CR wants stated, not hidden: an infeasible commitment (generated,
 * not activated — §9.4), tight float, provisional activities, post-baseline addenda and the
 * single driving open activity (FR-8.8).
 */
const PlanBanners = memo(function PlanBanners({ header: h, activities, canAcknowledge, onAcknowledge, settings }) {
  const g = h.generation || {};
  const provisional = activities.filter((a) => a.provisional);
  const addenda = activities.filter((a) => a.postBaseline);
  const warnFloat = settings?.floatWarningWd ?? 3;
  const items = [];
  if (h.status === 'INFEASIBLE') {
    items.push(
      <Alert
        key="infeasible"
        type="error"
        showIcon
        title="Infeasible commitment — plan generated, not activated"
        description={`Earliest feasible dispatch ${fmtDate(g.earliestDispatch)} against the commitment ${fmtDate(h.originalCommitment)}: short by ${g.shortfallDays} calendar days; float at order receipt ${g.floatAtReceipt} WD. No duration was shortened to hide it (FR-3.10).`}
        action={canAcknowledge ? <Button size="small" danger onClick={onAcknowledge}>Acknowledge</Button> : null}
      />,
    );
  }
  if (h.acknowledged) {
    items.push(<Alert key="ack" type="info" showIcon title={`Infeasible commitment acknowledged by ${h.acknowledged.by} on ${fmtDateTime(h.acknowledged.at)}`} description={h.acknowledged.reason} />);
  }
  if (h.status === 'ACTIVE' && h.latest && h.latest.forecastDelay <= 0 && h.latest.dispatchFloat <= warnFloat) {
    items.push(<Alert key="tight" type="warning" showIcon title={`Feasible — tight: ${h.latest.dispatchFloat} working day(s) of float left at dispatch`} />);
  }
  if (provisional.length) {
    items.push(
      <Alert
        key="prov"
        type="warning"
        showIcon
        title={`Provisional: ${provisional.map((a) => a.code).join(', ')} planned from master defaults`}
        description={`${provisional[0].sourceModule} requirement ${provisional[0].requirementRef} is still in Draft. These activities are excluded from the baseline, and the order from baseline-variance reporting, until it is submitted (FR-1.6, FR-4.3).`}
      />,
    );
  }
  if (addenda.length) {
    items.push(
      <Alert
        key="add"
        type="info"
        showIcon
        title={`Post-baseline addendum: ${addenda.map((a) => `${a.code} ${a.name}`).join(', ')}`}
        description={`${addenda[0].addendumReason} (${fmtDate(addenda[0].addendumOn)}). Addendum variance is reported separately; the original baseline is never retro-edited (FR-4.4).`}
      />,
    );
  }
  if (h.driving?.overdueDays > 0) {
    items.push(
      <Alert
        key="drive"
        type="warning"
        showIcon
        title={`Driving constraint: ${h.driving.code} ${h.driving.name} has been open ${h.driving.overdueDays} working day(s) past its revised target`}
        description={`Owned by ${h.driving.sourceModule}. Every working day it stays open moves the forecast dispatch by one working day.`}
      />,
    );
  }
  if (!items.length) return null;
  return <Space orientation="vertical" style={{ width: '100%', marginBottom: 12 }} size={8}>{items}</Space>;
});

export default PlanBanners;
