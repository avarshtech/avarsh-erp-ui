import dayjs from 'dayjs';
import { FABRIC_QC_DEFECT_FAIL_THRESHOLD, FABRIC_QC_TOLERANCE_PCT, FABRIC_QC_PARAMETERS } from './inventoryConstants';

/**
 * Returns true if `actual` is within ±tolerance% of `std` (inclusive boundary).
 * When the item has no standard (std null/0) the parameter is not applicable —
 * treated as passing, so items without a width/GSM standard can still clear QC.
 */
export const isWithinTolerance = (actual, std, tolerancePct = FABRIC_QC_TOLERANCE_PCT) => {
  if (actual == null) return false;
  if (std == null || std === 0) return true;
  const allowed = std * (tolerancePct / 100);
  return Math.abs(actual - std) <= allowed;
};

/**
 * Compute per-roll PASS/FAIL given std width/gsm and number of defects.
 * - Width within ±5% AND GSM within ±5% AND defectCount <= threshold → PASS
 * - Otherwise → FAIL
 */
export const computeFabricRollResult = (roll, defectCount = 0, threshold = FABRIC_QC_DEFECT_FAIL_THRESHOLD) => {
  const widthOk = isWithinTolerance(roll.actualWidth, roll.stdWidth);
  const gsmOk = isWithinTolerance(roll.actualGsm, roll.stdGsm);
  const defectsOk = defectCount <= threshold;
  return {
    widthOk,
    gsmOk,
    defectsOk,
    result: widthOk && gsmOk && defectsOk ? 'PASS' : 'FAIL',
  };
};

/**
 * Validate a Fabric QC inspection.
 *
 * Draft rules (E3 — tightened): grnId, poLineItemId, inspectionDate, inspector all required.
 * Roll/defect completeness stays optional on Draft.
 *
 * Submit rules (strict): Draft rules + inspection date range check + every roll has
 * actualWidth + actualGsm + every defect row has rollNumber + defectTypeId + count > 0 +
 * no duplicate (rollNumber, defectTypeId) pairs.
 *
 * Returns an array of error strings.
 */
export const validateFabricQC = (data, isSubmit = false, ctx = {}) => {
  const errors = [];
  const { grn = null } = ctx;

  // Tightened Draft header requirements
  if (!data.grnId) errors.push('GRN is required');
  if (!data.poLineItemId) errors.push('PO Line Item is required');
  if (!data.inspectionDate) errors.push('Inspection Date is required');
  if (!data.inspector || !String(data.inspector).trim()) errors.push('Inspector name is required');

  // Inspection date range check runs whenever a date is provided (Draft or Submit).
  if (data.inspectionDate) {
    const ins = dayjs(data.inspectionDate);
    if (grn?.grnDate && ins.isBefore(dayjs(grn.grnDate).startOf('day'))) {
      errors.push('Inspection Date must be on or after the GRN Date');
    }
    if (ins.isAfter(dayjs(), 'day')) {
      errors.push('Inspection Date cannot be in the future');
    }
  }

  if (isSubmit) {
    // Roll inspection completeness
    const rolls = data.rolls || [];
    if (rolls.length === 0) errors.push('No rolls available to inspect');
    const knownRollNumbers = new Set(rolls.map((r) => r.rollNumber).filter(Boolean));
    rolls.forEach((r, i) => {
      const label = r.rollNumber || `#${i + 1}`;
      if (r.actualWidth == null || r.actualWidth === '') {
        errors.push(`Roll ${label}: Actual Width is required`);
      } else if (Number(r.actualWidth) <= 0) {
        errors.push(`Roll ${label}: Actual Width must be greater than 0`);
      }
      if (r.actualGsm == null || r.actualGsm === '') {
        errors.push(`Roll ${label}: Actual GSM is required`);
      } else if (Number(r.actualGsm) <= 0) {
        errors.push(`Roll ${label}: Actual GSM must be greater than 0`);
      }
    });

    // QC parameters — every parameter in the standard set must have an actual value on submit
    const paramRows = Array.isArray(data.parameters) ? data.parameters : [];
    const paramByKey = new Map(paramRows.map((p) => [p.key, p]));
    FABRIC_QC_PARAMETERS.forEach((def) => {
      const row = paramByKey.get(def.key);
      const actual = row?.actual;
      if (actual == null || actual === '') {
        errors.push(`Parameter "${def.label}": Actual value is required`);
        return;
      }
      if (def.type === 'rating') {
        const n = Number(actual);
        if (!Number.isFinite(n) || n < 1 || n > 5) {
          errors.push(`Parameter "${def.label}": rating must be between 1 and 5`);
        }
      }
      if (def.type === 'number' && Number(actual) < 0) {
        errors.push(`Parameter "${def.label}": cannot be negative`);
      }
    });

    // Defect rows: each needs roll, type, count > 0 — and rollNumber must reference an inspected roll
    const defects = data.defects || [];
    defects.forEach((d, i) => {
      if (!d.rollNumber) {
        errors.push(`Defect row ${i + 1}: Roll # is required`);
      } else if (knownRollNumbers.size > 0 && !knownRollNumbers.has(d.rollNumber)) {
        errors.push(`Defect row ${i + 1}: Roll ${d.rollNumber} is not part of this inspection`);
      }
      if (!d.defectTypeId) errors.push(`Defect row ${i + 1}: Defect Type is required`);
      if (!d.count || Number(d.count) <= 0) errors.push(`Defect row ${i + 1}: Defects count must be > 0`);
    });

    // Uniqueness: (rollNumber, defectTypeId)
    const seen = new Set();
    defects.forEach((d, i) => {
      if (!d.rollNumber || !d.defectTypeId) return;
      const k = `${d.rollNumber}::${d.defectTypeId}`;
      if (seen.has(k)) errors.push(`Defect row ${i + 1}: duplicate (Roll + Defect Type) combination`);
      else seen.add(k);
    });
  }

  return errors;
};

/**
 * Validate a Trims QC inspection.
 */
export const validateTrimsQC = (data, isSubmit = false, ctx = {}) => {
  const errors = [];
  const { grn = null } = ctx;

  if (!data.grnId) errors.push('GRN is required');
  if (!data.poLineItemId) errors.push('PO Line Item is required');

  if (isSubmit) {
    if (!data.inspectionDate) {
      errors.push('Inspection Date is required');
    } else {
      const ins = dayjs(data.inspectionDate);
      if (grn?.grnDate && ins.isBefore(dayjs(grn.grnDate).startOf('day'))) {
        errors.push('Inspection Date must be on or after the GRN Date');
      }
      if (ins.isAfter(dayjs(), 'day')) {
        errors.push('Inspection Date cannot be in the future');
      }
    }

    if (!data.inspector || !String(data.inspector).trim()) {
      errors.push('Inspector name is required');
    }

    const criteria = data.criteriaRows || [];
    if (criteria.length === 0) errors.push('Select at least one criterion to inspect');
    const seenCriteria = new Set();
    criteria.forEach((c) => {
      if (!c.ok && !c.notOk) errors.push(`Criterion "${c.criteria}": mark as OK or Not OK`);
      if (c.notOk && !c.remarks?.trim()) errors.push(`Criterion "${c.criteria}": remarks required when Not OK`);
      if (c.id != null) {
        if (seenCriteria.has(c.id)) errors.push(`Criterion "${c.criteria}": duplicate selection`);
        else seenCriteria.add(c.id);
      }
    });

    // GRN Quantity Verdict — inspector must confirm Matched or Short for this GRN lot
    if (data.qtyVerdict !== 'MATCHED' && data.qtyVerdict !== 'SHORT') {
      errors.push('Mark the GRN Quantity Verdict as Matched or Short');
    }
  }

  return errors;
};
