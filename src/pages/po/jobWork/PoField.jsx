import { memo } from 'react';
import { FIELD_LABEL, FIELD_VALUE } from './poFieldStyles';

/**
 * A field of a job-work PO in the Supplier PO view's style — uppercase muted label over the value. While `editing` it
 * holds the input (`children`, labelled through `htmlFor`); viewed, the value as text (`text`, a dash when empty).
 */
const PoField = memo(function PoField({ label, required, editing, text, htmlFor, children }) {
  return (
    <div>
      <label htmlFor={editing ? htmlFor : undefined} style={FIELD_LABEL}>
        {label}{editing && required && <span style={{ color: 'var(--error-color)' }}> *</span>}
      </label>
      {editing ? children : <div style={FIELD_VALUE}>{text == null || text === '' ? '—' : text}</div>}
    </div>
  );
});

export default PoField;
