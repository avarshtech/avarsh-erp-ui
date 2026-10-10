import { createElement } from 'react';
import { EvidenceTag } from './EditorParts';

/**
 * What every template editor shares.
 *
 * Every editor works on an ordered list, so all of them share one row-mover.
 * `listEditor` is a plain unit, not a hook — it holds no state, and naming it `use…`
 * would both mislead and trip the rules-of-hooks check where a face maps over its lines.
 */
export const listEditor = (list, onChange) => ({
  add: (item) => onChange([...(list || []), item]),
  set: (i, changes) => onChange((list || []).map((x, n) => (n === i ? { ...x, ...changes } : x))),
  remove: (i) => onChange((list || []).filter((_, n) => n !== i)),
  move: (i, delta) => {
    const next = [...(list || [])];
    const j = i + delta;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  },
});

/*
 * AntD 6 deprecates the index parameter of rowKey, and an index is the only stable
 * identity these ordered lists have — a seeded column carries no id. So the index is
 * stamped onto a render-only copy instead; the stored template is untouched.
 */
export const withRowKeys = (list) => (list || []).map((row, i) => ({ ...row, __row: i }));

// Kept in a plain module (no antd) so models can use it; re-exported for the editors.
export { newRowKey } from './rowKeys';

/** A "Source" table column for a list, shown only when there are reader notes. */
export const evidenceColumn = (meta, list, onEvidence) => (meta && Object.keys(meta).length ? [{
  title: 'Source',
  width: 120,
  render: (_, r) => createElement(EvidenceTag, { meta: meta[`${list}:${r.key}`], onEvidence }),
}] : []);
