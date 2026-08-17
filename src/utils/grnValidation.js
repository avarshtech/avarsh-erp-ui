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

/**
 * Supplier Invoice upload check. Mandatory on Submit, optional on Draft.
 *
 * The file lives in the global file storage (fil_file_storage), not on the
 * GRN entity. The caller passes `hasSupplierInvoice` computed from the form
 * state: `true` when either a file is staged for upload OR an existingFile
 * is already linked to this GRN's id.
 */
const validateSupplierInvoice = ({ data, errors, isSubmit }) => {
  if (!isSubmit) return;
  if (!data.hasSupplierInvoice) {
    errors.push('Supplier Invoice upload is required on submit');
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
      if (!r.receivingQty || Number(r.receivingQty) <= 0) errors.push(`Row ${i + 1}: Quantity must be > 0`);
      if (!r.shadeLot || !String(r.shadeLot).trim()) errors.push(`Row ${i + 1}: Shade Lot is required`);
    }
  });

  // Excess vs PO balance is ALLOWED (business decision 2026-08-17): suppliers
  // over-ship routinely. The roll table's inline notice surfaces the excess %
  // against the item's allowance %, and the GRN Allowance screen flags
  // beyond-allowance receipts for review — no blocking validation here.

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
  // On submit, every selected line item must be fully packed — the over-case
  // is already caught by the always-on sum-exceeds-received check above, so we
  // only flag the under-packed case here.
  if (isSubmit && items) {
    items.forEach((item) => {
      const sum = cartons
        .filter((c) => c.poLineItemId === item.poLineItemId)
        .reduce((s, c) => s + (Number(c.quantity) || 0), 0);
      const received = Number(item.receivingQty) || 0;
      if (received > 0 && sum < received) {
        errors.push(`${item.itemCode || `Line ${item.poLineItemId}`}: Carton total (${sum}) is less than received Quantity (${received}) — pack the full received quantity`);
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
  validateSupplierInvoice({ data, errors, isSubmit });

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
  validateSupplierInvoice({ data, errors, isSubmit });

  // Items: quantity checks. Excess vs PO balance is ALLOWED (see fabric note) —
  // the item table's inline notice + the Allowance screen handle over-receipts.
  (data.items || []).forEach((item, i) => {
    if (isSubmit && (!item.receivingQty || Number(item.receivingQty) <= 0)) {
      errors.push(`Item row ${i + 1}: Quantity must be > 0`);
    }
  });

  // Carton sum per line item must never exceed the item's received quantity
  // (enforced on draft + submit so it matches the inline feedback).
  const cartonTotals = new Map();
  (data.cartons || []).forEach((c) => {
    if (c.poLineItemId == null) return;
    cartonTotals.set(c.poLineItemId, (cartonTotals.get(c.poLineItemId) || 0) + (Number(c.quantity) || 0));
  });
  (data.items || []).forEach((item) => {
    const total = cartonTotals.get(item.poLineItemId) || 0;
    const allowance = Number(item.receivingQty) || 0;
    if (total > 0 && allowance > 0 && total > allowance) {
      errors.push(`${item.itemCode || `Line ${item.poLineItemId}`}: Total carton quantity (${total}) exceeds received quantity (${allowance})`);
    }
  });

  validateCartonRows({ cartons: data.cartons || [], items: data.items, errors, isSubmit });

  return errors;
};
