/** The fields of a vendor that live in its private details: never in the list rows or a picker. */
export const PRIVATE_KEYS = ['pan', 'bankName', 'bankAccountNumber', 'bankBranch', 'ifscCode', 'swiftCode'];

/** What a new vendor's form starts with. */
export const NEW_VENDOR = { active: true, igstApplicable: false, country: 'India', processIds: [] };

/** A list row without its private fields, as the master keeps rows after a save. */
export const withoutPrivate = (vendor) => Object.fromEntries(
  Object.entries(vendor || {}).filter(([key]) => !PRIVATE_KEYS.includes(key)),
);

/** The form's values as the API takes them: identifiers upper-cased, blanks as null, state code from the GSTIN. */
export const toPayload = (values, version) => {
  const blank = (v) => (typeof v === 'string' && !v.trim() ? null : v);
  const upper = (v) => (typeof v === 'string' && v.trim() ? v.trim().toUpperCase() : null);
  const gstin = upper(values.gstin);
  return {
    ...Object.fromEntries(Object.entries(values).map(([k, v]) => [k, blank(v)])),
    name: values.name?.trim(),
    gstin,
    stateCode: gstin ? gstin.slice(0, 2) : blank(values.stateCode) ?? null,
    pan: upper(values.pan),
    ifscCode: upper(values.ifscCode),
    swiftCode: upper(values.swiftCode),
    processIds: values.processIds || [],
    active: values.active !== false,
    version: version ?? null,
  };
};
