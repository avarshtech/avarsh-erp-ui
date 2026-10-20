/**
 * Colour substitution rules for Sample Request material lines (PRD v3 §9).
 *
 * The flag is a per-TYPE default (sample-type master, colourSubstitutionDefault)
 * that pre-fills a per-SR override (sr.colourSubstitutionAllowed). Spec columns
 * (fabric type, classification, description, width, consumption, UOM) are ALWAYS
 * locked to BOM values — an SR never mutates the BOM.
 *
 * Per-line override (v3 Open Question 2, confirmed): trim lines carry a
 * `mandatory` lock, so e.g. the specified Sewing Thread stays locked to spec
 * even when substitution is allowed for the rest of the SR.
 *
 * Rule cases:
 *  - substitution allowed + fabric line            → colour editable
 *  - substitution allowed + trim, mandatory=false  → colour editable
 *  - substitution allowed + trim, mandatory=true   → colour LOCKED
 *  - substitution not allowed + any line           → colour LOCKED
 *  - mandatory toggle: trim lines only, Draft only, substitution allowed only
 */

export const isColourEditable = (sr, line) =>
  Boolean(sr?.colourSubstitutionAllowed) && !(line?.section === 'TRIM' && line?.mandatory);

export const isMandatoryToggleEnabled = (sr, line, status) =>
  Boolean(sr?.colourSubstitutionAllowed) && line?.section === 'TRIM' && status === 'DRAFT';

// Heuristic default applied when seeding materials from the BOM: trims a buyer
// specifies exactly (threads, labels) default to mandatory.
export const defaultMandatory = (line) =>
  /thread|main label|care label|size label/i.test(
    `${line?.subCategoryName || ''} ${line?.itemName || ''} ${line?.classification || ''} ${line?.description || ''}`
  );

// Banner above Section D — interpolates the (user-defined) type name, PRD §8.2 D.
export const substitutionBanner = (allowed, typeName) =>
  allowed
    ? `Substitution Allowed — "${typeName}": Fabric specifications are fixed from BOM. Colour and design may be substituted with any available stock.`
    : `Substitution Not Allowed — "${typeName}": All material lines are locked to BOM values. No colour or design substitution is permitted.`;
