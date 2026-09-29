/**
 * What the Help Genie is told about the sheet with every question, and what the launcher's badge
 * counts. Rows are numbered from 1 per section, the numbers the Genie uses to address them.
 */
export const GENIE_SECTIONS = {
  FABRIC: 'fabric', LOCAL_TRIM: 'localTrim', IMPORTED_TRIM: 'importedTrim', MANUFACTURING: 'manufacturing', OVERHEAD: 'overhead',
};
const LABEL = { fabric: 'Fabric', localTrim: 'Local trim', importedTrim: 'Imported trim', manufacturing: 'Manufacturing', overhead: 'Overhead' };

const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const round = (v) => (v == null ? null : Math.round(Number(v) * 100) / 100);

const ROW = {
  fabric: (r) => ({
    name: r.fabricType || null, variantId: r.variantId, quantity: num(r.consumption), unit: r.uom || null,
    rate: num(r.fabricPrice), allowancePct: num(r.allowancePct), wastagePct: num(r.wastagePct), amount: round(r.netCost),
  }),
  localTrim: (r) => ({ name: r.item || null, variantId: r.variantId, quantity: num(r.consumption), unit: r.uom || null, rate: num(r.cost), amount: round(r.price) }),
  importedTrim: (r) => ({
    name: r.item || null, variantId: r.variantId, quantity: num(r.consumption), unit: r.uom || null, rateUsd: num(r.costUsd), amountUsd: round(r.priceUsd),
  }),
  manufacturing: (r) => ({ name: r.process || null, processId: r.processId, cost: num(r.cost) }),
  overhead: (r) => ({ name: r.description || null, overheadId: r.overheadId, cost: num(r.cost) }),
};

const linked = (key, r) => (key === 'manufacturing' ? !!r.processId : key === 'overhead' ? !!r.overheadId : !!r.variantId);
const hasFigures = (key, r) => (['manufacturing', 'overhead'].includes(key)
  ? num(r.cost) != null
  : num(r.consumption) != null || num(key === 'fabric' ? r.fabricPrice : key === 'localTrim' ? r.cost : r.costUsd) != null);
const rateOf = (key, r) => num({ fabric: r.fabricPrice, localTrim: r.cost, importedTrim: r.costUsd, manufacturing: r.cost, overhead: r.cost }[key]);

/** Plain-words problems that stop a submit or deserve a look, most important first. */
export function sheetBlockers({ values, sheet, totals }) {
  const problems = [];
  if (!values.buyerId) problems.push('Buyer is not picked');
  if (!values.styleNo) problems.push('Style is not picked');
  if (!values.sizes?.length) problems.push('Sizes are not picked');
  if (!(Number(values.actualRate) > 0)) problems.push('Actual rate is missing');
  Object.entries(sheet.sections).forEach(([key, rows]) => rows.forEach((r, i) => {
    if (!linked(key, r) && hasFigures(key, r)) problems.push(`${LABEL[key]} row ${i + 1} has figures but no ${key === 'manufacturing' ? 'process' : key === 'overhead' ? 'overhead' : 'material'}`);
    else if (linked(key, r) && !(rateOf(key, r) > 0)) problems.push(`${LABEL[key]} row ${i + 1} has no ${['manufacturing', 'overhead'].includes(key) ? 'cost' : 'rate'}`);
  }));
  if (Number(sheet.commercial.targetPrice) > 0 && totals.profitPct < 0) problems.push('The target price is below cost');
  return problems.slice(0, 9);
}

export function sheetSnapshot({ values, labels, meta, sheet, totals, rates, problems }) {
  return {
    sheet: { costingId: meta.costingId || null, status: meta.status || 'New (not saved yet)' },
    header: {
      buyer: values.buyerId ? { buyerId: values.buyerId, name: labels.buyerName || null } : null,
      style: values.styleNo ? { styleId: values.styleNo, styleNo: labels.styleNo || null } : null,
      garmentName: values.garmentName || null,
      season: [values.seasonCode, values.seasonYear].filter(Boolean).join(' ') || null,
      sizes: values.sizes || [],
      costingType: values.costingType, pricingUnit: values.pricingUnit,
      currency: values.currency, quoteCurrency: values.quoteCurrency, actualRate: num(values.actualRate),
      // Today's market rate as the screen shows it: LIVE from the exchange API, or STORED when unreachable.
      todaysRate: num(rates?.todaysRate), todaysRateSource: rates?.rateSource || null,
    },
    sections: Object.fromEntries(Object.entries(GENIE_SECTIONS).map(([api, key]) => [
      api, sheet.sections[key].map((r, i) => ({ row: i + 1, ...ROW[key](r), sizes: r.sizes || undefined })),
    ])),
    totals: {
      fabric: round(totals.fabric), accessories: round(totals.accessories), manufacturing: round(totals.manufacturing),
      markup: round(totals.markup), makingPrice: round(totals.making), agentCommissionPct: totals.agentPct, profitPct: totals.profitPct,
      overheadCharges: round(totals.charges), totalPrice: round(totals.total), finalPrice: round(totals.final),
      usdPrice: round(totals.usd), targetPrice: num(sheet.commercial.targetPrice),
    },
    // Rows limited to some sizes: each size is priced on its own (as the live panel shows it).
    perSize: totals.perSize.length ? totals.perSize.map((p) => ({
      size: p.size, makingPrice: round(p.making), totalPrice: round(p.total), finalPrice: round(p.final), usdPrice: round(p.usd),
    })) : undefined,
    problems,
  };
}
