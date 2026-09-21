/**
 * What a unit does. Mirrors com.avarsh.erp.hr.domain.UnitType. INTEGRATED is the
 * full cut-sew-finish shed most small companies run; the rest let a production PO
 * offer only the units that can do the work.
 */
export const UNIT_TYPES = [
  { value: 'INTEGRATED', label: 'Integrated (cut, sew, finish)' },
  { value: 'CUTTING', label: 'Cutting' },
  { value: 'SEWING', label: 'Sewing' },
  { value: 'FINISHING', label: 'Finishing' },
  { value: 'WASHING', label: 'Washing' },
  { value: 'PRINTING_EMBROIDERY', label: 'Printing / Embroidery' },
  { value: 'PACKING', label: 'Packing' },
  { value: 'SAMPLING', label: 'Sampling' },
];

export const unitTypeLabel = (value) => UNIT_TYPES.find((t) => t.value === value)?.label || value || '—';
