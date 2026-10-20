import { memo, useMemo } from 'react';
import { Select, Typography } from 'antd';
import { vendorEligibility } from '../../../utils/vendorEligibility';

const { Text } = Typography;

const matches = (input, o) => [o.label, o.vendor.gstin, String(o.vendor.id), o.vendor.city]
  .some((v) => String(v || '').toLowerCase().includes(input.toLowerCase()));

/**
 * Job worker lookup (CPP FR-19, GPO §13): every job worker, the ineligible ones greyed with
 * the reason — never hidden. The Cut Panel PO blocks on any issue; with `allowWarnings`
 * (Garment Process PO) an unapproved or untagged vendor stays selectable with a warning.
 * Search by name, GSTIN, city or code (the vendor id — deviation D29).
 */
const JobWorkVendorSelect = memo(function JobWorkVendorSelect({
  id, vendors, value, onChange, processId, processLabel, category, onDate, allowWarnings = false, disabled, loading,
}) {
  const options = useMemo(() => vendors.map((v) => {
    const check = vendorEligibility(v, { processId, processLabel, category, onDate });
    const blocked = check.issues.some((i) => !allowWarnings || !i.warnOnly);
    return { value: v.id, label: v.name, disabled: blocked, vendor: v, check };
  }).sort((a, b) => Number(a.disabled) - Number(b.disabled) || a.label.localeCompare(b.label)), [vendors, processId, processLabel, category, onDate, allowWarnings]);

  return (
    <Select
      id={id}
      showSearch
      allowClear={false}
      placeholder="Search job worker by name, GSTIN or code"
      options={options}
      value={value ?? undefined}
      loading={loading}
      disabled={disabled}
      filterOption={matches}
      onChange={(vid) => onChange(options.find((o) => o.value === vid)?.vendor ?? null)}
      optionRender={(o) => (
        <div style={{ lineHeight: 1.35 }}>
          <div>{o.data.label} <Text type="secondary">· {o.data.vendor.city || '—'} · Code {o.data.vendor.id}</Text></div>
          <Text type={o.data.check.reason ? (o.data.disabled ? 'danger' : 'warning') : 'secondary'} style={{ fontSize: 12 }}>
            {o.data.check.reason ?? `${o.data.vendor.gstin || 'No GSTIN'} · ${o.data.check.approval.label}`}
          </Text>
        </div>
      )}
      style={{ width: '100%' }}
    />
  );
});

export default JobWorkVendorSelect;
