/**
 * Order seed helpers — build the preconditions an order needs:
 *   - an APPROVED cost sheet (orders can only be created from one)
 *   - a payment term, a size preset, and a buyer shipping location (destination)
 *
 * Under the e2e profile a cost sheet submitted as 'Final' auto-approves (no flow),
 * so seedApprovedCosting returns an Approved sheet's costingId + derived FKs.
 */

import { stylePayload } from './test-data.js';

const FK = { buyerId: 1, styleId: 3, fabricItemId: 1 };

/**
 * A style may carry only ONE cost sheet (rule added 2026-08), so every costing seeded
 * here gets its own fresh style — reusing a seeded style conflicts on the second run.
 */
export async function seedFreshStyle(api, buyerId) {
  const res = await api.post('/styles', stylePayload(buyerId));
  if (res.status >= 300) throw new Error(`seed style failed: ${res.status} ${JSON.stringify(res.data)}`);
  return res.data;
}

/** Create + auto-approve a cost sheet; returns its identity for order creation. */
export async function seedApprovedCosting(api, overrides = {}) {
  const style = await seedFreshStyle(api, overrides.buyerId ?? FK.buyerId);
  const payload = {
    status: 'Final',
    date: new Date().toISOString().split('T')[0],
    buyerId: FK.buyerId, styleId: style.id, garmentName: 'Order Seed', season: 'SS26',
    currency: 'INR', quoteCurrency: 'USD', actualRate: 83.5, todaysRate: 83.5,
    sizes: ['M'], costingType: 'FOB', pricingUnit: 'PIECE', agentCommissionPct: 5, profitPct: 10,
    fabricRows: [{ itemId: FK.fabricItemId, classification: 'Woven', consumption: 1, fabricPrice: 100, allowancePct: 0, wastagePct: 0, netCost: 100, sizes: '' }],
    localTrims: [], importedTrims: [], manufacturingRows: [], overheadRows: [],
    ...overrides,
  };
  const res = await api.post('/cost-sheets', payload);
  if (res.status !== 200) throw new Error(`seed costing failed: ${res.status}`);
  // The POST response leaves FK display fields null (buyerName/styleNo/garmentName);
  // only GET resolves them — re-fetch so the order payload carries real values.
  const cs = (await api.get(`/cost-sheets/${res.data.id}`)).data;
  return {
    costSheetId: cs.id,
    costingId: cs.costingId,
    status: cs.status,
    buyerId: cs.buyerId,
    styleId: cs.styleId,
    styleNo: cs.styleNo,
    garmentName: cs.garmentName,
    season: cs.season,
    quoteCurrency: cs.quoteCurrency,
  };
}

/** Fetch a payment term, a size preset (+its sizes), and the buyer's first shipping destination. */
export async function loadOrderRefs(api, buyerId = 1) {
  const pts = (await api.get('/payment-terms')).data || [];
  const presets = (await api.get('/size-presets')).data || [];
  const buyer = (await api.get(`/buyers/${buyerId}`)).data;
  const pt = (pts.content || pts)[0];
  const preset = (presets.content || presets)[0];
  const sizes = Array.isArray(preset.sizes) ? preset.sizes : String(preset.sizes).split(',').map((s) => s.trim());
  const ship = (buyer?.shippingLocations || []).find((s) => s.active) || (buyer?.shippingLocations || [])[0];
  const destination = ship?.label || (ship ? `${ship.city}, ${ship.country}` : 'Test Destination');
  return {
    paymentTermsId: pt.id, paymentTermsName: pt.name, paymentDays: pt.paymentDays || 60,
    sizePresetId: preset.id, presetSizes: sizes, destination, buyerName: buyer?.name,
  };
}

/** Build a full order payload from a seeded costing + refs. */
export function buildOrderPayload(costing, refs, overrides = {}) {
  const sizePrices = {};
  refs.presetSizes.forEach((s, i) => { sizePrices[s] = 5 + i; });
  const mkColor = (name, base) => {
    const quantities = {};
    refs.presetSizes.forEach((s, i) => { quantities[s] = base + i; });
    return { sortOrder: 0, colorName: name, quantities };
  };
  return {
    costingId: costing.costingId,
    buyerId: costing.buyerId, buyerName: refs.buyerName,
    orderDate: new Date().toISOString().split('T')[0],
    styleId: costing.styleId, styleNo: costing.styleNo,
    garmentName: costing.garmentName, garmentType: costing.garmentName,
    season: costing.season, fabricDescription: 'Cotton fleece, 280 GSM',
    material: 'Knit', component: 'Single',
    currency: costing.quoteCurrency || 'USD',
    paymentTermsId: refs.paymentTermsId, paymentTermsName: refs.paymentTermsName, paymentDays: refs.paymentDays,
    remarks: 'E2E order',
    orderLines: [{
      lineNo: 1, buyerPoNo: 'PO-E2E-1', destination: refs.destination,
      dispatchDate: new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0], leadTime: 30,
      sizePresetId: refs.sizePresetId, sizePrices,
      colorRows: [mkColor('Black', 10), mkColor('Navy', 5)],
    }],
    ...overrides,
  };
}
