import { memo } from 'react';
import { InputNumber, Typography } from 'antd';
import { amountInWordsIndian } from '../../../utils/amountInWords';
import { numericInputProps } from '../../../utils/inputHelpers';

const { Text } = Typography;
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ValueRow = ({ label, children, strong }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontWeight: strong ? 600 : 400 }}>
    <span>{label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{children}</span>
  </div>
);

const CPP_LABELS = { basic: 'Basic amount', total: 'PO value (INR)' };

/**
 * The PO value block (CPP §13.3, GPO §15), live as quantities and rates are keyed. Other
 * charges apply before tax — a job-work PO carries no discount; GST is IGST or CGST + SGST
 * from the vendor's IGST tick (deviation D2). `commercial` is { otherCharges };
 * `onChange(patch)` only when editable. Currency is INR (D11). The Cut Panel PO rounds its
 * value; the Garment Process PO (`rounding={false}`) states a grand total with its own
 * `labels` (GPO §8.4).
 */
const JobWorkValueSummary = memo(function JobWorkValueSummary({ value, qty, sacCode, commercial, editable, onChange, labels = CPP_LABELS, rounding = true }) {
  const half = value.gstRatePercent / 2;
  return (
    <div style={{ maxWidth: 440 }}>
      <ValueRow label={`${labels.basic} — ${Number(qty || 0).toLocaleString('en-IN')} pcs`}>{inr(value.basic)}</ValueRow>
      <ValueRow label="Other charges">
        {editable ? (
          <InputNumber name="otherCharges" aria-label="Other charges" min={0} precision={2} controls={false} prefix="₹" style={{ width: 192 }}
            value={commercial.otherCharges} onChange={(v) => onChange({ otherCharges: v ?? 0 })} {...numericInputProps} />
        ) : inr(value.otherCharges)}
      </ValueRow>
      <ValueRow label="Taxable value" strong>{inr(value.taxable)}</ValueRow>
      {value.igst
        ? <ValueRow label={`IGST @ ${value.gstRatePercent}% (SAC ${sacCode || '—'})`}>{inr(value.igstAmount)}</ValueRow>
        : (
          <>
            <ValueRow label={`CGST @ ${half}% (SAC ${sacCode || '—'})`}>{inr(value.cgst)}</ValueRow>
            <ValueRow label={`SGST @ ${half}%`}>{inr(value.sgst)}</ValueRow>
          </>
        )}
      <ValueRow label={labels.total} strong>{inr(value.total)}</ValueRow>
      {rounding && <ValueRow label={`Rounded${value.roundOff ? ` (round-off ${value.roundOff > 0 ? '+' : ''}${value.roundOff.toFixed(2)})` : ''}`} strong>{inr(value.rounded)}</ValueRow>}
      <Text type="secondary" style={{ fontSize: 12 }}>{amountInWordsIndian(rounding ? value.rounded : value.total)}</Text>
    </div>
  );
});

export default JobWorkValueSummary;
