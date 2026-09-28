import { memo } from 'react';
import { Button, Input, InputNumber, Select, Space, Tag, Typography } from 'antd';
import { numericInputProps } from '../../../utils/inputHelpers';
import { ZERO_RATE_REASON, RATE_VARIANCE_PCT } from '../../../utils/jobWorkConstants';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');
const OVERRIDE_TAG = { REQUESTED: ['warning', 'Override requested'], AUTHORISED: ['success', 'Override authorised'] };

/**
 * PO qty of one grid line (FR-13, VR-11/15): the offending cell turns red and says by how
 * much it exceeds the balance, with the override request beside it (§18.2).
 */
export const QtyCell = memo(function QtyCell({ line, balance, editable, override, canRequest, onChange, onRequest }) {
  const excess = Number(line.poQty || 0) - balance;
  return (
    <div>
      <InputNumber
        name={`poQty-${line.key}`} aria-label={`PO qty ${line.colorName} ${line.size}`} size="small" min={0} precision={2}
        controls={false} style={{ width: 96 }} disabled={!editable} value={line.poQty} status={excess > 0 && !override ? 'error' : undefined}
        onChange={(v) => onChange({ poQty: v ?? 0 })} {...numericInputProps}
      />
      {excess > 0 && (
        <div style={{ fontSize: 12, lineHeight: 1.3, marginTop: 2 }}>
          <Text type={override?.status === 'AUTHORISED' ? 'secondary' : 'danger'}>Exceeds balance by {n(excess)}</Text>
          {override && <Tag color={OVERRIDE_TAG[override.status][0]} style={{ marginLeft: 4 }}>{OVERRIDE_TAG[override.status][1]}</Tag>}
          {!override && canRequest && <Button type="link" size="small" style={{ padding: 0, marginLeft: 4 }} onClick={() => onRequest(excess)}>Request override</Button>}
        </div>
      )}
    </div>
  );
});

/**
 * Rate of one grid line (FR-14, VR-09/10/12): 2 dp; 0.00 needs the Free / rework reason;
 * more than 10% over the vendor's last rate needs a remark (warn, never block).
 */
export const RateCell = memo(function RateCell({ line, lastRate, editable, onChange }) {
  const hasRate = line.rate !== null && line.rate !== undefined && line.rate !== '';
  const zero = hasRate && Number(line.rate) === 0 && Number(line.poQty) > 0;
  const variance = hasRate && lastRate && Number(line.rate) > lastRate * (1 + RATE_VARIANCE_PCT / 100);
  return (
    <Space orientation="vertical" size={2} style={{ width: '100%' }}>
      <InputNumber
        name={`rate-${line.key}`} aria-label={`Rate ${line.colorName} ${line.size}`} size="small" min={0} precision={2} controls={false}
        prefix="₹" style={{ width: 104 }} disabled={!editable} value={line.rate} onChange={(v) => onChange({ rate: v })} {...numericInputProps}
      />
      {zero && (
        <Select size="small" name={`rateReason-${line.key}`} aria-label="Zero-rate reason" disabled={!editable} style={{ width: 132 }}
          placeholder="Reason for 0.00" value={line.rateReasonCode ?? undefined} options={[ZERO_RATE_REASON]} onChange={(v) => onChange({ rateReasonCode: v })} />
      )}
      {variance && (
        <Input size="small" name={`rateRemark-${line.key}`} aria-label="Rate variance reason" disabled={!editable} style={{ width: 132 }}
          status={String(line.rateRemark || '').trim() ? undefined : 'warning'} placeholder={`> ${RATE_VARIANCE_PCT}% over ₹${lastRate}: why?`}
          value={line.rateRemark} onChange={(e) => onChange({ rateRemark: e.target.value })} />
      )}
    </Space>
  );
});
