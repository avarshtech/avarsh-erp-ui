import dayjs from 'dayjs';

/**
 * The buyer POs a shipment carries (owner, 2026-10-09): a shipment to one location takes
 * several buyer POs, and one order's POs may travel on different shipments, so each order
 * on a shipment names the POs it sends. The API keeps them by number, because an order's
 * lines are rebuilt on every order save; an order with no PO numbers travels whole.
 *
 * A PO is told apart by its number and destination together (one PO may go to two), and
 * the form holds it as one key per checkbox. Pure, so the unit spec imports it in Node.
 */
import { poKey, poRefOf } from '../../../utils/expDocPoKeys';

export { poKey, poRefOf };

export const poLabel = (p) => [
  p.buyerPoNo,
  p.destination,
  p.dispatchDate ? dayjs(p.dispatchDate).format('DD-MMM-YYYY') : null,
].filter(Boolean).join(' · ');

/**
 * What an order offers: its own POs (with what is packed and shipped elsewhere), then any saved on the shipment
 * that the order has since dropped. A PO the shipment saved carries the pieces it sends (colorQty).
 */
export const poChoicesOf = (offered = [], saved = []) => {
  const out = offered.map((o) => {
    const s = saved.find((p) => poKey(p) === poKey(o));
    return s?.colorQty ? { ...o, colorQty: s.colorQty, shipQty: s.shipQty } : o;
  });
  saved.forEach((p) => { if (!out.some((o) => poKey(o) === poKey(p))) out.push(p); });
  return out;
};

const qtyOf = (m, colour, size) => Number(m?.[colour]?.[size]) || 0;

/** What may still go of a PO, {colour: {size: pieces}}: packed less what other shipments take. */
export const balanceOf = (p) => Object.fromEntries(Object.entries(p?.packed || {})
  .map(([colour, sizes]) => [colour, Object.fromEntries(Object.keys(sizes)
    .map((size) => [size, Math.max(0, qtyOf(p.packed, colour, size) - qtyOf(p.shippedElsewhere, colour, size))])
    .filter(([, n]) => n > 0))])
  .filter(([, sizes]) => Object.keys(sizes).length));

/** The pieces a ticked PO starts with: what the shipment saved, else its balance; null when unknown yet. */
export const startQtyOf = (p) => (p?.colorQty ? p.colorQty : p?.packed ? balanceOf(p) : null);

export const totalOf = (m) => Object.values(m || {}).reduce((t, sizes) => t
  + Object.values(sizes || {}).reduce((a, n) => a + (Number(n) || 0), 0), 0);

/** The saved ticks per order. An order saved without POs is absent: it ticks every PO it offers once they load. */
export const savedTicksOf = (orders = []) => Object.fromEntries(
  orders.filter((o) => o.pos?.length).map((o) => [String(o.orderId), o.pos.map(poKey)]),
);

/**
 * The form's ticks, with the pieces each sends, as the API takes them, order by order. An order whose ticks were never
 * set sends every PO it offers; one without POs sends none. An order whose POs were never
 * loaded (`knownOf` false: saved before buyer POs, and outside the picker's answer) is
 * left out, and the API keeps what the shipment has for it.
 */
export const orderPosPayload = (orderIds = [], ticked = {}, choicesOf = () => [], knownOf = () => true, shipQty = {}) => orderIds
  .filter((orderId) => ticked?.[String(orderId)] !== undefined || knownOf(orderId))
  .map((orderId) => ({
    orderId,
    pos: (ticked?.[String(orderId)] ?? choicesOf(orderId).map(poKey)).map((key) => {
      // The grid's pieces when it was shown; without them the server sends a new PO's balance and keeps a saved one
      const colorQty = shipQty?.[String(orderId)]?.[key];
      return colorQty ? { ...poRefOf(key), colorQty } : poRefOf(key);
    }),
  }));
