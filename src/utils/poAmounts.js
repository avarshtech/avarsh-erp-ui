/**
 * A supplier PO's money as the PO form computes, shows and sends it: each line's amount, each
 * line's GST, and the PO's totals. The API recomputes the same figures in exact decimals
 * (erp-purchase PoAmounts) and keeps the form's whenever they are within a paisa, so these are
 * the figures the PO prints and stores.
 *
 * Moved out of POForm.jsx unchanged, so the arithmetic can be tested; the inputs are the numbers
 * the form has already parsed.
 */

/** A line's amount including GST, rounded to paise. */
export const poLineAmount = (qty, unitPrice, gstPercent) =>
  parseFloat((qty * unitPrice * (1 + gstPercent / 100)).toFixed(2));

/**
 * A line's GST as the payload carries it: the rates, and each amount rounded to paise. An
 * inter-state PO carries IGST alone; a local one splits the rate into CGST and SGST.
 */
export const poLineTax = (taxableBase, gstPercent, isIgst) => {
  let cgst = 0,
    sgst = 0,
    igst = 0;
  let cgstValue = 0,
    sgstValue = 0,
    igstValue = 0;

  if (isIgst) {
    igst = gstPercent;
    igstValue = parseFloat(((taxableBase * gstPercent) / 100).toFixed(2));
  } else {
    const halfGst = gstPercent / 2;
    cgst = halfGst;
    sgst = halfGst;
    cgstValue = parseFloat(((taxableBase * halfGst) / 100).toFixed(2));
    sgstValue = parseFloat(((taxableBase * halfGst) / 100).toFixed(2));
  }

  const taxValue = parseFloat((cgstValue + sgstValue + igstValue).toFixed(2));
  return { cgst, sgst, igst, cgstValue, sgstValue, igstValue, taxValue };
};

/** The PO's subtotal, tax split and grand total: unrounded sums, each rounded to paise at the end. */
export const poTotals = (lineItems, isIgstApplicable) => {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
  }, 0);

  let sgst = 0;
  let cgst = 0;
  let igst = 0;

  lineItems.forEach((item) => {
    const base = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
    const gstPercent = parseFloat(item.gstPercent) || 0;
    const gstAmount = (base * gstPercent) / 100;

    if (isIgstApplicable) {
      igst += gstAmount;
    } else {
      sgst += gstAmount / 2;
      cgst += gstAmount / 2;
    }
  });

  const grandTotal = isIgstApplicable ? subtotal + igst : subtotal + sgst + cgst;

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    sgst: parseFloat(sgst.toFixed(2)),
    cgst: parseFloat(cgst.toFixed(2)),
    igst: parseFloat(igst.toFixed(2)),
    grandTotal: parseFloat(grandTotal.toFixed(2)),
  };
};
