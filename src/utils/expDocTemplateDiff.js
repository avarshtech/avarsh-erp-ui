/**
 * Side-by-side compare of ANY two template revisions (§10.3), not only consecutive
 * ones — the question an admin actually asks is "what changed since the version this
 * shipment was documented against?", which may be three versions back.
 *
 * Flattened to leaf paths so the answer is "these seven values differ", which an admin
 * can act on, rather than "these two objects are not equal".
 */
import { LAYOUT_KEYS } from './expDocSystemTemplates';

/** What a revision is compared on: its name and buyer scope plus every layout key. */
const COMPARABLE = ['name', 'buyerName', 'buyerCode', 'subClientCode', 'stickerLayout', ...LAYOUT_KEYS];

const flatten = (value, prefix, out) => {
  if (value === null || value === undefined) { out[prefix] = null; return; }
  if (Array.isArray(value)) {
    out[`${prefix}.length`] = value.length;
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
    return;
  }
  if (typeof value === 'object') {
    Object.keys(value).sort().forEach((k) => flatten(value[k], `${prefix}.${k}`, out));
    return;
  }
  out[prefix] = value;
};

const identity = (t) => ({ id: t.id, templateCode: t.templateCode, version: t.version, status: t.status });

export const diffTemplates = (a, b) => {
  const flatA = {};
  const flatB = {};
  COMPARABLE.forEach((k) => { flatten(a[k], k, flatA); flatten(b[k], k, flatB); });

  const paths = [...new Set([...Object.keys(flatA), ...Object.keys(flatB)])].sort();
  const changes = paths
    .filter((p) => JSON.stringify(flatA[p]) !== JSON.stringify(flatB[p]))
    .map((p) => ({
      path: p,
      from: flatA[p] === undefined ? null : flatA[p],
      to: flatB[p] === undefined ? null : flatB[p],
      kind: flatA[p] === undefined ? 'ADDED' : (flatB[p] === undefined ? 'REMOVED' : 'CHANGED'),
    }));

  return { a: identity(a), b: identity(b), changes, identical: changes.length === 0 };
};
