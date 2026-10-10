/**
 * A buyer PO as Export Documentation tells it apart: by its number and destination
 * together (one PO may go to two destinations), kept by number because an order's
 * lines are rebuilt on every order save. Shared by the shipment form and the packing
 * lists. Pure.
 */
const SEP = '\u0000';

export const poText = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

export const poKey = (p) => `${poText(p?.buyerPoNo) ?? ''}${SEP}${poText(p?.destination) ?? ''}`;

export const poRefOf = (key) => {
  const [buyerPoNo, destination] = String(key).split(SEP);
  return { buyerPoNo: buyerPoNo || null, destination: destination || null };
};
