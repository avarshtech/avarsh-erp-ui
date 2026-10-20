/**
 * What may change on a Cut Panel PO after approval — the details editable until it is sent
 * (BR-16), and what an amendment may change — and an amendment's field-level before / after diff
 * (PRD FR-29, report R-8). Lines keep their keys; only quantity, UOM, billing quantity and
 * rate move — a different vendor or process means cancelling and raising a fresh PO.
 */
export const REVISION_FIELDS = ['otherCharges', 'requiredDeliveryDate', 'paymentTerms', 'lateDeliveryReason', 'duplicateReason'];

/** Still editable once Approved, until Sent to Vendor (BR-16) — without an amendment. */
export const ISSUED_FIELDS = ['vendor', 'paymentTerms', 'requiredDeliveryDate', 'returnTo', 'returnToOther',
  'returnUnitId', 'returnUnitName', 'returnUnitAddress'];

const pick = (src, fields) => Object.fromEntries(fields.filter((f) => f in src).map((f) => [f, src[f]]));

/**
 * The PO as the amendment would make it — what is shown, validated and, on approval,
 * allocated. The live PO's authorised overrides carry over (they can only be requested on a
 * draft), so an amendment is never refused for an excess that was already authorised.
 */
export const mergedRevision = (doc, rev) => ({
  ...doc, ...pick(rev, REVISION_FIELDS), lines: rev.lines, overrides: (doc.overrides || []).filter((o) => o.status === 'AUTHORISED'),
});

const LABELS = {
  otherCharges: 'Other charges', requiredDeliveryDate: 'Expected delivery date', paymentTerms: 'Payment terms',
  lateDeliveryReason: 'Late delivery reason', duplicateReason: 'Duplicate PO reason', vendor: 'Job worker',
  returnTo: 'Return to', returnToOther: 'Return to (other)', returnUnitName: 'Return unit', returnUnitAddress: 'Delivery place',
  instructions: 'Processing instructions',
};

/** A PO header field as the history and the amendment diff name it. */
export const fieldLabel = (f) => LABELS[f] ?? f;

const LINE_FIELDS = [['poQty', 'PO qty'], ['uom', 'UOM'], ['billingQty', 'Billing qty'], ['rate', 'Rate']];

const same = (a, b) => String(a ?? '') === String(b ?? '');

export const revisionChanges = (doc, rev) => {
  const out = REVISION_FIELDS.filter((f) => !same(doc[f], rev[f]))
    .map((f) => ({ field: fieldLabel(f), from: doc[f] ?? '—', to: rev[f] ?? '—' }));
  rev.lines.forEach((l) => {
    const before = doc.lines.find((x) => x.key === l.key);
    if (!before) return;
    LINE_FIELDS.filter(([f]) => !same(before[f], l[f])).forEach(([f, label]) => out.push({
      field: `${l.cprNo} ${l.colorName} ${l.size} — ${label}`, from: before[f] ?? '—', to: l[f] ?? '—',
    }));
  });
  return out;
};
