/** Pure helpers turning master lists into what the sheet's pickers need. */

export const unwrapList = (res) => (Array.isArray(res) ? res : res?.data || res?.content || []);

/**
 * Sizes grouped by preset. A size in several presets is offered once, under the first preset
 * that has it — duplicate values across option groups break AntD's multi-select.
 */
export function sizePresetGroups(presets) {
  const seen = new Set();
  return (presets || [])
    .filter((p) => p.isActive !== false && p.active !== false)
    .map((p) => ({
      label: p.name,
      options: (p.sizes || [])
        .map((s) => String(s).trim().toUpperCase())
        .filter((s) => s && !seen.has(s) && seen.add(s))
        .map((s) => ({ value: s, label: s })),
    }))
    .filter((g) => g.options.length > 0);
}

/**
 * The category each variant section searches: exactly "Fabric", and names containing
 * "local trim" / "imported trim" — falling back to a general "Trims" category for both.
 * CostingMasterMatcher on the server applies the same rule.
 */
export function resolveCategorySlots(categories) {
  const names = (categories || []).map((c) => c.name || '');
  const find = (test) => names.find((n) => test(n.toLowerCase())) || '';
  const general = find((n) => n.includes('trim') && !n.includes('local') && !n.includes('imported'));
  return {
    fabric: find((n) => n === 'fabric'),
    localTrim: find((n) => n.includes('local trim')) || general,
    importedTrim: find((n) => n.includes('imported trim')) || general,
  };
}

export const toBuyerOptions = (buyers) => (buyers || []).map((b) => ({ value: b.id, label: b.name }));

export const toSupplierOptions = (suppliers) => (suppliers || [])
  .filter((s) => s.active !== false && s.isActive !== false)
  .map((s) => ({ value: s.id, label: s.name }));

export const toCostMasterOptions = (list, nameField) =>
  (list || []).map((x) => ({ value: x.id, label: x[nameField], defaultCost: x.defaultCost || 0 }));
