import { memo } from 'react';
import { Button, InputNumber, Select, Space, Tag, Typography } from 'antd';
import { numericInputProps } from '../../../utils/inputHelpers';
import { jobWorkUomOptions } from '../../../utils/jobWorkConstants';
import { billingQty, isKeyedBilling } from '../../../utils/jobWorkPoCalc';

const { Text } = Typography;
const n = (v, dp = 0) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: dp });
const EXCESS_TAG = { REQUESTED: ['warning', 'Excess requested'], AUTHORISED: ['success', 'Excess approved'] };
const focusRate = (key) => document.getElementById(`gpo-rate-${key}`)?.focus();

/**
 * PO qty of one line (V4, V5): the cell turns red and says by how much it exceeds the
 * balance, with "Request excess override" beside it (§11). Enter moves to the rate (§19).
 */
export const GpoQtyCell = memo(function GpoQtyCell({ line, balance, editable, excess, canRequest, onChange, onRequest }) {
  const over = Number(line.poQty || 0) - balance;
  return (
    <div>
      <InputNumber id={`gpo-qty-${line.key}`} aria-label={`PO qty ${line.color} ${line.size}`} size="small" min={0} precision={2} controls={false}
        style={{ width: 100 }} disabled={!editable} value={line.poQty} status={(over > 0 && excess?.status !== 'AUTHORISED') || !(Number(line.poQty) > 0) ? 'error' : undefined}
        onChange={(v) => onChange({ poQty: v ?? 0 })} onPressEnter={() => focusRate(line.key)} {...numericInputProps} />
      {over > 0 && (
        <div style={{ fontSize: 12, lineHeight: 1.3, marginTop: 2 }}>
          <Text type={excess?.status === 'AUTHORISED' ? 'secondary' : 'danger'}>Exceeds balance by {n(over, 2)} pcs</Text>
          {excess && <Tag color={EXCESS_TAG[excess.status][0]} style={{ marginLeft: 4 }}>{EXCESS_TAG[excess.status][1]} +{n(excess.excessQty, 2)}</Tag>}
          {!excess && canRequest && <Button type="link" size="small" style={{ padding: 0, marginLeft: 4 }} onClick={() => onRequest(over)}>Request excess override</Button>}
        </div>
      )}
    </div>
  );
});

/** UOM of one line (V7): Piece, Dozen or Kg; Dozen bills qty ÷ 12, Kg a keyed weight (deviation D19). */
export const GpoUomCell = memo(function GpoUomCell({ line, editable, onChange }) {
  return (
    <Space orientation="vertical" size={2}>
      <Select size="small" name={`uom-${line.key}`} aria-label={`UOM ${line.color} ${line.size}`} style={{ width: 90 }} disabled={!editable}
        options={jobWorkUomOptions('Garment')} value={line.uom} onChange={(uom) => onChange({ uom, billingQty: null })} />
      {line.uom === 'DOZEN' && <Text type="secondary" style={{ fontSize: 11 }}>= {n(billingQty(line), 3)} dz</Text>}
      {isKeyedBilling(line.uom) && (
        <InputNumber size="small" name={`billingQty-${line.key}`} aria-label={`Billing ${line.uom} ${line.color} ${line.size}`} min={0} precision={3} controls={false}
          style={{ width: 90 }} disabled={!editable} placeholder="kg" value={line.billingQty} status={line.billingQty == null ? 'warning' : undefined}
          onChange={(v) => onChange({ billingQty: v })} {...numericInputProps} />
      )}
    </Space>
  );
});

/** Rate per UOM, up to four decimals (§14); the last approved rate for the vendor, process and UOM as reference. */
export const GpoRateCell = memo(function GpoRateCell({ line, lastRate, editable, onChange }) {
  return (
    <div>
      <InputNumber id={`gpo-rate-${line.key}`} aria-label={`Rate ${line.color} ${line.size}`} size="small" min={0} precision={4} controls={false}
        prefix="₹" style={{ width: 112 }} disabled={!editable} value={line.rate} status={editable && !(Number(line.rate) > 0) ? 'error' : undefined}
        onChange={(rate) => onChange({ rate })} {...numericInputProps} />
      {lastRate != null && <div><Text type="secondary" style={{ fontSize: 11 }}>Last ₹{n(lastRate, 4)}</Text></div>}
    </div>
  );
});
