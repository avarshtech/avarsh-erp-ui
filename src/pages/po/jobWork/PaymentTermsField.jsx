import { memo } from 'react';
import { Input, Select } from 'antd';

/**
 * Payment terms on a job-work PO (deviation D5): a pick from the Payment Terms master when
 * it is readable and has entries, free text otherwise.
 */
const PaymentTermsField = memo(function PaymentTermsField({ id, terms, value, disabled, onChange }) {
  return terms.length ? (
    <Select id={id} style={{ width: '100%' }} disabled={disabled} value={value ?? undefined}
      options={terms.map((t) => ({ value: t.name, label: t.name }))} onChange={onChange} />
  ) : <Input id={id} disabled={disabled} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />;
});

export default PaymentTermsField;
