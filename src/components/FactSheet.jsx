import { memo } from 'react';

const LABEL = {
  margin: 0, fontSize: 11, fontWeight: 500, lineHeight: '16px', letterSpacing: 0.4, textTransform: 'uppercase', color: 'var(--text-muted)',
};
const VALUE = { margin: 0, fontWeight: 600, color: 'var(--text-primary)', overflowWrap: 'anywhere' };
const ROW = { display: 'flex', flexWrap: 'wrap', margin: 0 };
const FIELD = { flex: '1 1 170px', minWidth: 0 };
const WIDE = { flex: '2 1 340px', minWidth: 0 };
const TILE = { flex: '1 1 130px', maxWidth: 240, minWidth: 0, padding: '8px 14px', borderRadius: 8, background: 'var(--bg-tertiary)' };
const CHIPS = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 };
const CHIP = {
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '1px 10px', borderRadius: 999,
  border: '1px solid var(--border-color)', fontSize: 12, lineHeight: '20px', color: 'var(--text-primary)',
};
const SWATCH = { width: 10, height: 10, borderRadius: '50%', boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.25)' };
const shown = (v) => (v == null || v === '' ? '—' : v);
const tone = (t) => (t.danger ? { color: 'var(--error-color)' } : t.accent ? { color: 'var(--primary-color)' } : null);

/**
 * Read-only facts as label over value — the replacement for bordered Descriptions grids on the job-work screens.
 * `fields` [{ label, value, wide? }] read as plain text; `tiles` [{ label, value, accent?, danger? }] are the numbers
 * and dates, `accent` marking the one the screen works from; `chips` [{ label, items: [{ key, text, swatch? }] }] are
 * lists such as colours and sizes; `footer` closes it (created by / on, remarks). Everything wraps — no sideways
 * scroll at any width — and the colours are the theme's, light or dark.
 */
const FactSheet = memo(function FactSheet({ fields = [], tiles = [], chips = [], footer }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {fields.length > 0 && (
        <dl style={{ ...ROW, gap: '12px 24px' }}>
          {fields.map((f) => (
            <div key={f.label} style={f.wide ? WIDE : FIELD}>
              <dt style={LABEL}>{f.label}</dt>
              <dd style={{ ...VALUE, fontSize: 14 }}>{shown(f.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {tiles.length > 0 && (
        <dl style={{ ...ROW, gap: 10 }}>
          {tiles.map((t) => (
            <div key={t.label} style={TILE}>
              <dt style={LABEL}>{t.label}</dt>
              <dd style={{ ...VALUE, fontSize: 16, fontVariantNumeric: 'tabular-nums', ...tone(t) }}>{shown(t.value)}</dd>
            </div>
          ))}
        </dl>
      )}
      {chips.filter((c) => c.items.length).map((c) => (
        <div key={c.label} style={CHIPS}>
          <span style={{ ...LABEL, minWidth: 84 }}>{c.label}</span>
          {c.items.map((i) => (
            <span key={i.key} style={CHIP}>{i.swatch && <span style={{ ...SWATCH, background: i.swatch }} />}{i.text}</span>
          ))}
        </div>
      ))}
      {footer && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{footer}</div>}
    </div>
  );
});

export default FactSheet;
