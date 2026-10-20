/**
 * Indian tax and bank identifiers as the Supplier and Vendor masters check them (upper case), and the
 * normaliser their inputs share. The API checks the same formats (VendorDTO), accepting a blank value.
 */
export const PAN_REGEX = /^[A-Z]{3}[PCAFHTBLJG][A-Z][0-9]{4}[A-Z]$/;
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{3}[PCAFHTBLJG][A-Z][0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
export const SWIFT_REGEX = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/** Letters and digits only, upper case, at most `max` long: what an identifier input normalises to. */
export const toIdentifier = (max) => (value) => value?.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, max);
