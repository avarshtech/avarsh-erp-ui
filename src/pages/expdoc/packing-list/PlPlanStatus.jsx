import { Button, Space, Tag, Tooltip, Typography } from 'antd';
import { PLAN_STATUS, PLAN_STATUS_LABELS, rangesText } from '../../../utils/expDocPlanMatch';
import { formatRanges } from '../../../utils/expDocCalc';

const { Text } = Typography;

const COLOR = {
  [PLAN_STATUS.PACKED]: 'green',
  [PLAN_STATUS.PARTLY_PACKED]: 'gold',
  [PLAN_STATUS.DIFFERS]: 'red',
  [PLAN_STATUS.NOT_PACKED]: 'default',
  [PLAN_STATUS.NOT_SHIPPING]: 'default',
};

/**
 * The buyer's plan for one PO, range by range: packed as planned, partly, packed
 * differently (and how), not packed yet, or marked Not shipping. On a draft an unpacked
 * range can be marked Not shipping (a short shipment), or shipping again.
 */
const PlPlanStatus = ({ match, editable, busy, onNotShipping }) => {
  if (!match?.rows?.length) return null;
  return (
    <Space wrap size={6} style={{ marginTop: 6 }}>
      <Text type="secondary" style={{ fontSize: 12 }}>Buyer&apos;s plan</Text>
      {match.rows.map(({ plan, status, toPack, differs }) => (
        <Space key={plan.id} size={2}>
          <Tooltip title={differs.length ? `Packed differently: ${[...new Set(differs.flatMap((d) => d.aspects))].join(', ')}` : undefined}>
            <Tag color={COLOR[status]}>
              {`${formatRanges([{ from: Number(plan.cartonFrom), to: Number(plan.cartonTo) }])} ${PLAN_STATUS_LABELS[status]}`}
              {status !== PLAN_STATUS.NOT_PACKED && toPack.length ? ` · ${rangesText(toPack)} to pack` : ''}
            </Tag>
          </Tooltip>
          {/* Whatever is still to pack can go short — also on a range partly packed differently */}
          {editable && toPack.length > 0 && (
            <Button size="small" type="link" loading={busy} onClick={() => onNotShipping(plan, true)}>Not shipping</Button>
          )}
          {editable && plan.notShipping && (
            <Tooltip title={plan.notShipping.reason}>
              <Button size="small" type="link" loading={busy} onClick={() => onNotShipping(plan, false)}>Shipping after all</Button>
            </Tooltip>
          )}
        </Space>
      ))}
      {match.extra.length > 0 && <Tag color="orange">{`${rangesText(match.extra)} packed outside the plan`}</Tag>}
    </Space>
  );
};

export default PlPlanStatus;
