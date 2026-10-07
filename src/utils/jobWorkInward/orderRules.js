/**
 * Checks for a new job order (an Order of type Job work, no costing) and for a principal's master
 * record (the Buyer master's new fields). Pure; the screens run them as the user types.
 */
import {
  MAIN_KIND, MATERIAL_KIND, PP_SAMPLE, SUPPLIED_BY, WASTE_RULE,
} from './inwardConstants';

export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const blank = (v) => !String(v ?? '').trim();

/** [{ field?, message }] for a job order payload. */
export const validateJobOrder = (p, today) => {
  const e = [];
  const push = (field, message) => e.push({ field, message });
  if (!p.principalId) push('principalId', 'Pick the principal.');
  if (blank(p.principalRef)) push('principalRef', 'Enter the principal\'s order reference.');
  if (blank(p.styleNo) || blank(p.styleName)) push('style', 'Enter the style number and name.');
  if (!p.scope) push('scope', 'Pick what they send: fabric (cut to pack) or cut panels (stitching onwards).');
  const colours = (p.colours || []).filter((c) => !blank(c.colour));
  const names = colours.map((c) => c.colour.trim().toUpperCase());
  if (!colours.length) push('colours', 'Add at least one colour.');
  if (new Set(names).size !== names.length) push('colours', 'A colour is repeated.');
  const total = colours.reduce((a, c) => a + Object.values(c.qty || {}).reduce((x, q) => x + (Number(q) || 0), 0), 0);
  if (colours.length && total <= 0) push('colours', 'Enter the quantities by size.');
  if (!(Number(p.rate) > 0)) push('rate', 'Enter the job rate per piece.');
  if (Object.values(p.ratesBySize || {}).some((r) => !(Number(r) > 0))) push('rate', 'Every size rate must be above 0.');
  if (!/^\d{6}$/.test(String(p.sacCode || ''))) push('sacCode', 'The SAC code has 6 digits.');
  if (!(Number(p.gstRatePct) >= 0 && Number(p.gstRatePct) <= 28)) push('gstRatePct', 'Enter a GST rate between 0 and 28%.');
  if (!p.dueDate) push('dueDate', 'Enter the date it is due back.');
  else if (p.dueDate < today) push('dueDate', 'The due date cannot be in the past.');
  if (p.ppSample?.status === PP_SAMPLE.APPROVED && blank(p.ppSample.ref)) push('ppSample', 'Enter who approved the PP sample, and when.');
  const lines = p.materials || [];
  if (!lines.length) push('materials', 'Add the materials.');
  lines.forEach((m, i) => {
    if (blank(m.itemName) || blank(m.uom)) push(`materials.${i}`, `Line ${i + 1}: enter the material and its unit.`);
    if (!(Number(m.consumption) > 0)) push(`materials.${i}`, `Line ${i + 1}: enter the agreed consumption per piece.`);
    if (!(Number(m.allowancePct) >= 0 && Number(m.allowancePct) <= 20)) push(`materials.${i}`, `Line ${i + 1}: allowance between 0 and 20%.`);
  });
  if (p.scope && lines.length && !lines.some((m) => m.kind === MAIN_KIND[p.scope] && m.suppliedBy === SUPPLIED_BY.PRINCIPAL)) {
    push('materials', `The principal must supply the ${MAIN_KIND[p.scope] === 'FABRIC' ? 'fabric' : 'cut panels'} for this kind of work.`);
  }
  return e;
};

/** [{ field?, message }] for a principal. A GSTIN fixes the state; without one the state is picked. */
export const validatePrincipal = (p) => {
  const e = [];
  const push = (field, message) => e.push({ field, message });
  if (blank(p.name)) push('name', 'Enter the company name.');
  if (!blank(p.gstin) && !GSTIN_PATTERN.test(String(p.gstin).trim().toUpperCase())) push('gstin', 'That GSTIN is not in the right format (15 characters).');
  if (blank(p.gstin) && blank(p.stateCode)) push('stateCode', 'Pick the state (there is no GSTIN to read it from).');
  if (blank(p.address)) push('address', 'Enter the billing address.');
  if (!/^\d{6}$/.test(String(p.pincode || ''))) push('pincode', 'The pincode has 6 digits.');
  if (!Object.values(WASTE_RULE).includes(p.wasteRule)) push('wasteRule', 'Say what happens to their cutting waste.');
  if (!(Number(p.weightTolerancePct) >= 0 && Number(p.weightTolerancePct) <= 5)) push('weightTolerancePct', 'Weight tolerance between 0 and 5%.');
  return e;
};

/** Typical lines for new work: the principal's fabric (or panels) per colour, a label, and our own thread. */
export const typicalMaterialLines = (scope, colours) => [
  ...colours.filter((c) => c.trim()).map((c) => (scope === 'CMT'
    ? { kind: MATERIAL_KIND.FABRIC, itemName: `Fabric — ${c}`, colour: c, uom: 'kg', consumption: 0.22, allowancePct: 3, suppliedBy: SUPPLIED_BY.PRINCIPAL }
    : { kind: MATERIAL_KIND.PANELS, itemName: `Cut panels — ${c}`, colour: c, uom: 'sets', consumption: 1, allowancePct: 1, suppliedBy: SUPPLIED_BY.PRINCIPAL })),
  { kind: MATERIAL_KIND.TRIM, itemName: 'Main label', colour: null, uom: 'pcs', consumption: 1, allowancePct: 2, suppliedBy: SUPPLIED_BY.PRINCIPAL },
  { kind: MATERIAL_KIND.TRIM, itemName: 'Sewing thread 40s', colour: null, uom: 'cone', consumption: 0.012, allowancePct: 0, suppliedBy: SUPPLIED_BY.OWN },
].map((m, i) => ({ key: `m${i}`, ...m }));
