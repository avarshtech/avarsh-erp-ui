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

/** What an order offers: its own POs, then any saved on the shipment that the order has since dropped. */
export const poChoicesOf = (offered = [], saved = []) => {
  const out = [...offered];
  saved.forEach((p) => { if (!out.some((o) => poKey(o) === poKey(p))) out.push(p); });
  return out;
};

/** The saved ticks per order. An order saved without POs is absent: it ticks every PO it offers once they load. */
export const savedTicksOf = (orders = []) => Object.fromEntries(
  orders.filter((o) => o.pos?.length).map((o) => [String(o.orderId), o.pos.map(poKey)]),
);

/**
 * The form's ticks as the API takes them, order by order. An order whose ticks were never
 * set sends every PO it offers; one without POs sends none. An order whose POs were never
 * loaded (`knownOf` false: saved before buyer POs, and outside the picker's answer) is
 * left out, and the API keeps what the shipment has for it.
 */
export const orderPosPayload = (orderIds = [], ticked = {}, choicesOf = () => [], knownOf = () => true) => orderIds
  .filter((orderId) => ticked?.[String(orderId)] !== undefined || knownOf(orderId))
  .map((orderId) => ({
    orderId,
    pos: (ticked?.[String(orderId)] ?? choicesOf(orderId).map(poKey)).map(poRefOf),
  }));
