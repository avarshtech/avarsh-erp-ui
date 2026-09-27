import { memo } from 'react';
import { InputNumber, Select, Space, Typography } from 'antd';
import { amountInWordsIndian } from '../../../utils/amountInWords';
import { numericInputProps } from '../../../utils/inputHelpers';

const { Text } = Typography;
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ValueRow = ({ label, children, strong }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontWeight: strong ? 600 : 400 }}>
    <span>{label}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{children}</span>
  </div>
);

/**
 * The PO value block (CPP §13.3, GPO §15), live as quantities and rates are keyed.
 * Discount (amount or %) and other charges apply before tax; GST is IGST or CGST + SGST
 * from the vendor's IGST tick (deviation D2). `commercial` is { discountType,
 * discountValue, otherCharges }; `onChange(patch)` only when editable. Currency is INR (D11).
 */
const JobWorkValueSummary = memo(function JobWorkValueSummary({ value, qty, sacCode, commercial, editable, onChange }) {
  const half = value.gstRatePercent / 2;
  return (
    <div style={{ maxWidth: 440 }}>
      <ValueRow label={`Basic amount — ${Number(qty || 0).toLocaleString('en-IN')} pcs`}>{inr(value.basic)}</ValueRow>
      <ValueRow label="Discount">
        {editable ? (
          <Space.Compact>
            <Select name="discountType" aria-label="Discount type" value={commercial.discountType} style={{ width: 72 }}
              options={[{ value: 'AMOUNT', label: '₹' }, { value: 'PERCENT', label: '%' }]}
              onChange={(v) => onChange({ discountType: v })} />
            <InputNumber name="discountValue" aria-label="Discount" min={0} precision={2} controls={false} style={{ width: 120 }}
              value={commercial.discountValue} onChange={(v) => onChange({ discountValue: v ?? 0 })} {...numericInputProps} />
          </Space.Compact>
        ) : `− ${inr(value.discount)}`}
      </ValueRow>
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
      <ValueRow label="PO value (INR)" strong>{inr(value.total)}</ValueRow>
      <ValueRow label={`Rounded${value.roundOff ? ` (round-off ${value.roundOff > 0 ? '+' : ''}${value.roundOff.toFixed(2)})` : ''}`} strong>{inr(value.rounded)}</ValueRow>
      <Text type="secondary" style={{ fontSize: 12 }}>{amountInWordsIndian(value.rounded)}</Text>
    </div>
  );
});

export default JobWorkValueSummary;
