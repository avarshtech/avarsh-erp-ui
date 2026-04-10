import dayjs from 'dayjs';
import { isWithinPoRange } from './numbering';

const CHALLAN_REGEX = /^[A-Za-z0-9\-/]+$/;

/**
 * Within-GRN roll number duplicate check. Same (lineItemId, rollNumber) pair
 * within the current draft is rejected. CROSS-GRN duplicate enforcement now
 * runs server-side inside GRNService.validateRollNumberUniqueness — the API
 * will return a 400 with the message and the form surfaces it via toast.
 */
const findDuplicateRollNumbersWithinGRN = ({ rolls = [] }) => {
  const dups = [];
  const seen = new Map();
  rolls.forEach((r, idx) => {
    if (!r.rollNumber || !r.poLineItemId) return;
    const k = `${r.poLineItemId}::${(r.rollNumber || '').trim().toUpperCase()}`;
    if (seen.has(k)) {
      dups.push(`Roll ${r.rollNumber} repeats for the same line item (rows ${seen.get(k) + 1} and ${idx + 1})`);
    } else {
      seen.set(k, idx);
    }
  });
  return [...new Set(dups)];
};

const baseHeaderValidations = ({ data, po, errors }) => {
  // PO + line items required for both draft and submit
  if (!data.poId) errors.push('Purchase Order is required');
  if (!data.lineItems || data.lineItems.length === 0) errors.push('Select at least one PO line item');

  // Challan / Invoice number — mandatory + format
  if (!data.challanNo || !String(data.challanNo).trim()) {
    errors.push('Challan / Invoice Number is required');
  } else if (!CHALLAN_REGEX.test(data.challanNo)) {
    errors.push('Challan / Invoice Number may only contain letters, digits, hyphen and slash');
  }

  // Invoice Date — mandatory + range + not future
  if (!data.invoiceDate) {
    errors.push('Invoice Date is required');
  } else {
    if (po && !isWithinPoRange(data.invoiceDate, po.createdDate, po.expectedDeliveryDate)) {
      errors.push('Invoice Date must fall within the PO date range');
    }
    if (dayjs(data.invoiceDate).isAfter(dayjs(), 'day')) {
      errors.push('Invoice Date cannot be in the future');
    }
  }

  // Delivery Challan Date — mandatory + range + not future
  if (!data.deliveryChallanDate) {
    errors.push('Delivery Challan Date is required');
  } else {
    if (po && !isWithinPoRange(data.deliveryChallanDate, po.createdDate, po.expectedDeliveryDate)) {
      errors.push('Delivery Challan Date must fall within the PO date range');
    }
    if (dayjs(data.deliveryChallanDate).isAfter(dayjs(), 'day')) {
      errors.push('Delivery Challan Date cannot be in the future');
    }
  }

  // Vehicle Number — mandatory
  if (!data.vehicleNumber || !String(data.vehicleNumber).trim()) {
    errors.push('Vehicle Number is required');
  }

  // Transporter — mandatory
  if (!data.transporter || !String(data.transporter).trim()) {
    errors.push('Transporter is required');
  }
};

const validateRollRows = ({ rolls, errors, isSubmit }) => {
  if (rolls.length === 0) {
    if (isSubmit) errors.push('At least one roll is required');
    return;
  }
  rolls.forEach((r, i) => {
    if (isSubmit) {
      if (!r.rollNumber || !String(r.rollNumber).trim()) errors.push(`Row ${i + 1}: Roll Number is required`);
      if (!r.receivingQty || Number(r.receivingQty) <= 0) errors.push(`Row ${i + 1}: Receiving Qty must be > 0`);
      if (!r.shadeLot || !String(r.shadeLot).trim()) errors.push(`Row ${i + 1}: Shade Lot is required`);
    }
    // Receiving qty <= balance check is always enforced when a value exists
    if (r.receivingQty != null && r.balance != null && Number(r.receivingQty) > Number(r.balance)) {
      errors.push(`Row ${i + 1}: Receiving Qty (${r.receivingQty}) exceeds balance (${r.balance})`);
    }
  });

  // Within-GRN duplicate check is enforced on Submit. Cross-GRN check runs server-side.
  if (isSubmit) {
    findDuplicateRollNumbersWithinGRN({ rolls }).forEach((d) => errors.push(d));
  }
};

const validateCartonRows = ({ cartons, items, errors, isSubmit }) => {
  if (cartons.length === 0) {
    if (isSubmit) errors.push('At least one carton is required');
    return;
  }
  cartons.forEach((c, i) => {
    if (isSubmit) {
      if (!c.cartonNumber || !String(c.cartonNumber).trim()) errors.push(`Carton row ${i + 1}: Carton # is required`);
      if (!c.quantity || Number(c.quantity) <= 0) errors.push(`Carton row ${i + 1}: Quantity must be > 0`);
    }
  });
  // Carton sum vs item receiving qty
  if (isSubmit && items) {
    items.forEach((item) => {
      const sum = cartons.filter((c) => c.poLineItemId === item.poLineItemId).reduce((s, c) => s + (Number(c.quantity) || 0), 0);
      if (sum > 0 && item.receivingQty > 0 && sum !== Number(item.receivingQty)) {
        errors.push(`Carton total (${sum}) for ${item.itemCode} does not equal Receiving Qty (${item.receivingQty})`);
      }
    });
  }
};

/**
 * Validate a Fabric GRN form payload.
 * Per business rules, the header fields (PO, Challan, Invoice Date, DC Date,
 * Vehicle, Transporter, line items) are mandatory in BOTH Draft and Submit.
 * Roll-level rules tighten on Submit.
 */
export const validateFabricGRN = (data, isSubmit = false, ctx = {}) => {
  const errors = [];
  const { po = null } = ctx;

  baseHeaderValidations({ data, po, errors });

  const rolls = data.rolls || (data.lineItems || []).flatMap((li) => li.rolls || []);
  validateRollRows({ rolls, errors, isSubmit });

  return errors;
};

/**
 * Validate a Trims GRN form payload.
 * Same header rules as fabric — header fields mandatory in both Draft and Submit.
 */
export const validateTrimsGRN = (data, isSubmit = false, ctx = {}) => {
  const errors = [];
  const { po = null } = ctx;

  baseHeaderValidations({ data, po, errors });

  // Items: receiving qty checks
  (data.items || []).forEach((item, i) => {
    if (isSubmit && (!item.receivingQty || Number(item.receivingQty) <= 0)) {
      errors.push(`Item row ${i + 1}: Receiving Qty must be > 0`);
    }
    if (item.receivingQty != null && item.balance != null && Number(item.receivingQty) > Number(item.balance)) {
      errors.push(`Item row ${i + 1}: Receiving Qty (${item.receivingQty}) exceeds balance (${item.balance})`);
    }
  });

  validateCartonRows({ cartons: data.cartons || [], items: data.items, errors, isSubmit });

  return errors;
};
