/**
 * What packing reads off an order (GET /orders/{id}): its sizes in size-preset order,
 * its quantities per buyer PO, colour and size, and its buyer POs. Shared by Carton
 * Packing and the packing lists, so both read an order the same way. Pure.
 */

const text = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim());

/** Sizes in preset order — the persisted quantity maps are unordered. */
export const resolveOrderSizes = (order, presets = []) => {
  const fromLines = new Set();
  (order?.orderLines || []).forEach((l) => {
    Object.keys(l.sizePrices || {}).forEach((s) => fromLines.add(s));
    // Some orders carry no size prices, only colour-wise quantities.
    (l.colorRows || []).forEach((cr) => Object.keys(cr.quantities || {}).forEach((s) => fromLines.add(s)));
  });
  const presetId = (order?.orderLines || [])[0]?.sizePresetId;
  const preset = (presets || []).find((p) => p.id === presetId);
  if (preset?.sizes?.length) {
    const ordered = preset.sizes.filter((s) => fromLines.has(s));
    // Anything on the order but absent from the preset still has to appear.
    const extras = [...fromLines].filter((s) => !preset.sizes.includes(s));
    return [...ordered, ...extras];
  }
  return [...fromLines];
};

/** A line's price for a size, when the order prices sizes (`sizePrices`); else null. */
const priceOf = (line, size) => {
  const v = Number((line.sizePrices || {})[size]);
  return Number.isFinite(v) && v > 0 ? v : null;
};

/** Ordered quantities (and price), one row per buyer PO line, colour and size. */
export const orderBreakdownOf = (order) => (order?.orderLines || []).flatMap((line) =>
  (line.colorRows || []).flatMap((cr) => Object.entries(cr.quantities || {})
    .filter(([, qty]) => Number(qty))
    .map(([size, qty]) => ({
      styleNo: order.styleNo,
      colorName: cr.colorName,
      size,
      orderQty: Number(qty),
      orderRate: priceOf(line, size),
      buyerPoNo: text(line.buyerPoNo),
      destination: text(line.destination),
    }))));

/** The order's buyer POs, one per PO number and destination, in line order. */
export const orderPosOf = (order) => {
  const out = [];
  (order?.orderLines || []).forEach((line) => {
    const buyerPoNo = text(line.buyerPoNo);
    if (!buyerPoNo) return;
    const destination = text(line.destination);
    if (!out.some((p) => p.buyerPoNo === buyerPoNo && p.destination === destination)) {
      out.push({ buyerPoNo, destination, dispatchDate: line.dispatchDate ?? null });
    }
  });
  return out;
};
