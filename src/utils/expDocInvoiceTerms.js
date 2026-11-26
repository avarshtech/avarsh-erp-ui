/**
 * What an export invoice takes from the orders on its packing lists (owner, 2026-11-17): the
 * orders' currency and payment terms, and the HS code of each order's style. `orderTerms` is the
 * shipment's GET /export-docs/shipments/{id}/order-terms. Pure, so the rules are tested apart
 * from the document store.
 */

const fmt = (value) => String(value ?? '').trim();

/** orderId -> its terms row. */
export const termsByOrder = (orderTerms = []) => new Map((orderTerms || []).map((t) => [Number(t.orderId), t]));

/** The orders the packing lists' rows came from, first seen first: [{ orderId, orderNo }]. */
export const ordersOfPls = (pls = []) => {
  const seen = new Map();
  pls.forEach((pl) => (pl.sections || []).forEach((s) => (s.rows || []).forEach((r) => {
    const id = Number(r.orderId);
    if (Number.isInteger(id) && id > 0 && !seen.has(id)) seen.set(id, { orderId: id, orderNo: r.orderNo ?? null });
  })));
  return [...seen.values()];
};

/**
 * The invoice's currency and payment terms, or `{ error }` with the sentence to show. An invoice is
 * in one currency: an order without one, or orders that disagree, are refused rather than guessed.
 */
export const resolveInvoiceTerms = (orders, orderTerms) => {
  if (!orders.length) return { error: 'These packing lists name no order, so the invoice currency cannot be read.' };
  const byId = termsByOrder(orderTerms);
  const rows = [];
  for (const o of orders) {
    const t = byId.get(o.orderId);
    if (!t) return { error: `Order ${o.orderNo || o.orderId} is no longer on this shipment. Reload the shipment and try again.` };
    if (!fmt(t.currency)) {
      return { error: `Order ${t.orderNo || o.orderNo} has no currency. It comes from the order's cost sheet: set it there, then create the invoice.` };
    }
    rows.push({ ...t, currency: fmt(t.currency).toUpperCase() });
  }
  const currencies = [...new Set(rows.map((r) => r.currency))];
  if (currencies.length > 1) {
    const which = rows.map((r) => `${r.currency} on ${r.orderNo}`).join(', ');
    return { error: `An invoice is in one currency, and these orders are not (${which}).` };
  }
  const terms = [...new Set(rows.map((r) => fmt(r.paymentTerms)).filter(Boolean))];
  return { currency: currencies[0], paymentTerms: terms.join('; ') || null };
};

/** The HS code an invoice line starts with: its order's style code, else none for staff to fill. */
export const hsCodeOfOrder = (byOrder, orderId) => fmt(byOrder.get(Number(orderId))?.hsCode) || null;

/** CBIC notifies twice a month, so a rate in force for longer has probably been replaced. */
export const CUSTOMS_RATE_STALE_DAYS = 16;

const dayNo = (iso) => Math.floor(Date.parse(`${String(iso).slice(0, 10)}T00:00:00Z`) / 86400000);

/**
 * How the invoice's exchange rate reads on screen: the tag, its tooltip, and a warning when there is
 * no rate or the customs rate in force is older than a notification cycle. Invoices made before the
 * customs rate list carry MASTER / MASTER_LIVE.
 */
export const invoiceFxStatus = (inv) => {
  if (inv.fxSource === 'MANUAL') {
    return { tag: 'manual', color: 'purple', tooltip: `Overridden: ${inv.fxOverrideReason || 'no reason recorded'}`, warning: null };
  }
  if (!(Number(inv.fxRate) > 0)) {
    return {
      tag: 'no rate', color: 'red', tooltip: null,
      warning: `No customs rate for ${inv.currency || 'this currency'} is in force on ${inv.invoiceDate}. Add the CBIC notification under "Customs rates" on the Export Invoices list, or override the rate.`,
    };
  }
  if (inv.fxSource === 'CUSTOMS') {
    const age = inv.fxDate && inv.invoiceDate ? dayNo(inv.invoiceDate) - dayNo(inv.fxDate) : 0;
    return {
      tag: 'customs rate',
      color: 'blue',
      tooltip: `CBIC customs export rate${inv.fxNotificationNo ? `, notification ${inv.fxNotificationNo}` : ''}, in force from ${inv.fxDate}.`,
      warning: age > CUSTOMS_RATE_STALE_DAYS
        ? `This rate has been in force for ${age} days. CBIC notifies twice a month: check that no newer notification applies to ${inv.invoiceDate}.`
        : null,
    };
  }
  return { tag: 'rate master', color: 'default', tooltip: 'Taken from the rate master before customs rates were kept.', warning: null };
};

/**
 * The buyer's most recent document in `docs` (held oldest first, as the store loads them), matched
 * by buyer id, else by name; `except` leaves one out. A new document starts with that one's
 * settings (discount, tolerance) so a standing term is not retyped.
 */
export const latestOfBuyer = (docs = [], { buyerId, buyerName } = {}, except = null) => {
  const name = fmt(buyerName).toLowerCase();
  for (let i = docs.length - 1; i >= 0; i -= 1) {
    const d = docs[i];
    if (except != null && d.id === except) continue;
    const sameId = buyerId != null && d.buyerId != null && Number(d.buyerId) === Number(buyerId);
    const sameName = buyerId == null && name && fmt(d.buyerName).toLowerCase() === name;
    if (sameId || sameName) return d;
  }
  return null;
};
