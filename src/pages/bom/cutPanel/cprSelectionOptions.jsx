import ColorDot from '../shared/ColorDot';

export const ALL_COLOURS = '__all__';

const muted = { fontSize: 12, color: 'var(--text-secondary)' };

/** Fabric options: name, code, composition, GSM and BOM consumption (PRD §8.2). */
export const fabricOptions = (fabrics = []) => fabrics.map((f) => ({
  value: f.id,
  label: f.name,
  data: f,
}));

export const renderFabricOption = (opt) => (
  <div>
    <div style={{ fontWeight: 600 }}>{opt.data.label}</div>
    <div style={muted}>
      {opt.data.data.code} · {opt.data.data.composition} · {opt.data.data.gsm} GSM · {opt.data.data.consumption} {opt.data.data.uom}/pc
    </div>
  </div>
);

/** Colours carrying the selected fabric (BOM colour mapping), led by "Select All Colours". */
export const colourOptions = (order, fabric) => {
  const allowed = new Set(fabric?.colors || []);
  const colours = (order?.colors || []).filter((c) => allowed.has(c.name));
  if (!colours.length) return [];
  return [
    { value: ALL_COLOURS, label: 'Select All Colours' },
    ...colours.map((c) => ({ value: c.name, label: c.name, color: c })),
  ];
};

export const renderColourOption = (opt) => (opt.data.color ? (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <ColorDot hex={opt.data.color.hex} name={opt.data.color.name} />
    <span>{opt.data.color.name}</span>
    <span style={muted}>{opt.data.color.code} · {opt.data.color.qty.toLocaleString('en-IN')} pcs</span>
  </span>
) : <strong>{opt.data.label}</strong>);

/** Panels are the Parts master; panels per garment is shown because it doubles paired panels. */
export const panelOptions = (parts = []) => parts.map((p) => ({
  value: p.id,
  label: `${p.partName} ×${p.panelsPerGarment ?? 1}`,
}));

export const processOptions = (processes = []) => processes.map((p) => ({ value: p.id, label: p.processName }));

/** Each ticked process shows its sequence number (tick order) inside the dropdown. */
export const renderProcessOption = (selectedIds) => (opt) => {
  const idx = selectedIds.indexOf(opt.value);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18, height: 18, borderRadius: 9,
        fontSize: 11, fontWeight: 700, color: '#fff', background: idx >= 0 ? 'var(--primary-color)' : 'var(--border-color, #d9d9d9)',
      }}
      >
        {idx >= 0 ? idx + 1 : ''}
      </span>
      {opt.data.label}
    </span>
  );
};
