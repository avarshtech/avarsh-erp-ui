/**
 * Export invoice arithmetic and line generation (PRD §8.3, §8.4, BR-07).
 *
 * Pure: no I/O, no React. Shared by the mock service (which persists lines) and the
 * wizard (which regenerates them live), so the two can never disagree — the same
 * contract `expDocCalc.js` states for the packing list.
 *
 * The design point is Appendix A.5's observation: every buyer's invoice is the SAME
 * carton data at a different grain. So there is one projection — `packedAtoms()`,
 * which flattens packing-list rows into (style, colour, size, qty) atoms carrying
 * their row's identity — and the five §8.3 grains are five groupings of it. Adding a
 * sixth buyer grain is a `groupBy` array, not a new code path.
 *
 * Money is rounded once per line with the same EPSILON correction as
 * `billPassingCalc.js`, then accumulated, so a hundred lines cannot drift from a
 * hand-calculated control (PRD §25).
 */
import { PACKING_TYPE, LINE_GRAIN } from './expDocConstants';
import { cartonCount, sizeQtyPerCarton, round } from './expDocCalc';

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const text = (v) => String(v ?? '').trim();
const lower = (v) => text(v).toLowerCase();

/** Default colour key: Pantone-suffixed names must match their bare form. */
export const defaultMatchColour = (c) => lower(c);

// ─── The canonical projection ───────────────────────────────────────────────────

/**
 * Flatten packing-list rows into one atom per (row, colour, size) with a quantity.
 *
 * This is the only place carton rows are unpacked for invoicing. Every grain groups
 * these atoms; none of them re-reads the rows. Cost is O(rows × sizes) — independent
 * of carton count, which has no ceiling.
 */
export const packedAtoms = (rows, options = {}) => {
  const { matchColour = defaultMatchColour } = options;
  const out = [];

  (rows || []).forEach((row) => {
    const count = cartonCount(row);
    if (!count) return;

    const push = (colorName, size, perCarton, extra = {}) => {
      const qty = num(perCarton) * count;
      if (!qty) return;
      out.push({
        styleNo: row.styleNo ?? null,
        colorName: colorName ?? null,
        colourKey: matchColour(colorName),
        size: text(size),
        qty,
        // Identity carried from the row, because the grains group on it.
        rowId: row.id,
        sectionKey: row.sectionKey ?? null,
        packingType: row.packingType ?? null,
        orderLineId: row.orderLineId ?? null,
        // An order-line id is only unique WITHIN its order, and every packing entry
        // binds one order — so the entry is what separates line 1 of two orders.
        sourceEntryId: row.sourceEntryId ?? null,
        sourceEntryNo: row.sourceEntryNo ?? null,
        orderNo: row.orderNo ?? null,
        buyerPoNo: row.buyerPoNo ?? null,
        destination: row.destination ?? null,
        endCustomer: row.endCustomer ?? null,
        packingCode: row.packingCode ?? null,
        danNo: row.danNo ?? null,
        articleNo: (row.articleNos || {})[size] ?? null,
        ean: (row.eanBySize || {})[size] ?? null,
        cartonFrom: row.cartonFrom ?? null,
        cartonTo: row.cartonTo ?? null,
        ...extra,
      });
    };

    // A mixed carton carries its own colour rows; every other packing type resolves
    // to a single colour through the row.
    if (row.packingType === PACKING_TYPE.MIXED) {
      (row.mixedRows || []).forEach((mr) => {
        Object.entries(mr?.sizeQty || {}).forEach(([size, q]) => {
          push(mr.colorName, size, q, {
            articleNo: (mr.articleNos || row.articleNos || {})[size] ?? null,
            ean: (mr.eanBySize || row.eanBySize || {})[size] ?? null,
          });
        });
      });
      return;
    }

    Object.entries(sizeQtyPerCarton(row)).forEach(([size, q]) => push(row.colorName, size, q));
  });

  return out;
};

// ─── Size ranges ────────────────────────────────────────────────────────────────

/**
 * "74-140" for a set of sizes, ordered by the style's size preset rather than
 * alphabetically — otherwise XXL sorts before XS and the printed range is wrong.
 * Sizes absent from the preset keep their given order, after the known ones.
 */
export const sizeRangeLabel = (sizes, presetOrder = []) => {
  const present = [...new Set((sizes || []).map(text).filter(Boolean))];
  if (!present.length) return '';
  const rank = new Map(presetOrder.map((s, i) => [text(s), i]));
  const sorted = present.sort((a, b) => {
    const ra = rank.has(a) ? rank.get(a) : Number.MAX_SAFE_INTEGER;
    const rb = rank.has(b) ? rank.get(b) : Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b, undefined, { numeric: true });
  });
  if (sorted.length === 1) return sorted[0];
  return `${sorted[0]}-${sorted[sorted.length - 1]}`;
};

// ─── Description templates ──────────────────────────────────────────────────────

/**
 * Render a `{{a.b}}` template against a scope. An unresolved placeholder collapses
 * to nothing rather than printing "{{style.hsCode}}" on a customs document; the
 * separators around it are tidied so the result never reads as a missing field.
 */
export const renderTemplate = (tpl, scope = {}) => {
  if (!tpl) return '';
  const filled = String(tpl).replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path) => {
    const v = String(path).split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), scope);
    return v === null || v === undefined ? '' : String(v);
  });
  return filled
    .replace(/\s*[—–-]\s*(?=\s*[—–-]|$)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s—–-]+|[\s—–-]+$/g, '')
    .trim();
};

// ─── Grains ─────────────────────────────────────────────────────────────────────

/** The grouping key each §8.3 grain uses, when the template does not state one. */
export const DEFAULT_GROUP_BY = {
  [LINE_GRAIN.PER_STYLE_SIZE_RANGE]: ['styleNo', 'colourKey'],
  [LINE_GRAIN.PER_SIZE]: ['styleNo', 'colourKey', 'size'],
  [LINE_GRAIN.PER_PO_STYLE]: ['buyerPoNo', 'styleNo'],
  [LINE_GRAIN.PER_ORDER_LINE]: ['sourceEntryId', 'orderLineId'],
  [LINE_GRAIN.MATERIAL_ROWS]: ['styleNo'],
};

/** The atom properties a template may group by. Anything else is derived. */
export const GROUPABLE_KEYS = new Set([
  'styleNo', 'colourKey', 'colorName', 'size', 'buyerPoNo', 'orderLineId',
  'destination', 'endCustomer', 'packingCode', 'danNo', 'sectionKey', 'articleNo',
  'sourceEntryId', 'sourceEntryNo', 'orderNo',
]);

const groupKeyOf = (atom, keys) => keys.map((k) => lower(atom[k])).join('||');

/**
 * Build invoice lines from packing-list rows.
 *
 * `resolve` supplies what the packing data does not carry — the order's rate, the
 * style's HS code and composition. Each is a function of the group so a caller can
 * key them however its data allows, and each may return null, which V-12 then
 * reports rather than this silently printing a blank.
 */
export const buildInvoiceLines = (rows, options = {}) => {
  const {
    grain = {},
    sizes = [],
    matchColour = defaultMatchColour,
    rateFor = () => null,
    hsCodeFor = () => null,
    compositionFor = () => null,
    garmentNameFor = () => null,
    articleNoFor = () => null,
    unit = 'PCS',
  } = options;

  const mode = grain.mode || LINE_GRAIN.PER_STYLE_SIZE_RANGE;

  // MATERIAL_ROWS may be stated outright by the template (Centric's SAP materials
  // are not derivable from carton data), in which case the atoms are not consulted.
  if (mode === LINE_GRAIN.MATERIAL_ROWS && (grain.materialRows || []).length) {
    return grain.materialRows.map((m, i) => finaliseLine({
      seq: i + 1,
      key: `material:${m.materialNo ?? i}`,
      description: m.description || m.materialNo || '',
      materialNo: m.materialNo ?? null,
      hsCode: m.hsCode ?? null,
      quantity: num(m.quantity),
      rate: m.rate === null || m.rate === undefined ? null : num(m.rate),
      unit: m.unit || unit,
      nonMerchandise: Boolean(m.nonMerchandise),
      sourceAtoms: [],
    }));
  }

  const fallbackKeys = DEFAULT_GROUP_BY[mode] || DEFAULT_GROUP_BY[LINE_GRAIN.PER_STYLE_SIZE_RANGE];
  /*
   * A template may only group by properties an ATOM carries. `sizeRange` is derived
   * FROM a group, so grouping by it collapses every size into one empty key.
   *
   * Validation is all-or-nothing on purpose: honouring the valid subset of
   * ['styleNo', 'sizeRange'] would silently turn "per style and size range" into
   * "per style", merging colours that must stay apart — the same silent collapse,
   * one step removed. An unusable groupBy falls back to the grain's own default.
   */
  const requested = grain.groupBy || [];
  const keys = requested.length && requested.every((k) => GROUPABLE_KEYS.has(k))
    ? requested
    : fallbackKeys;

  const atoms = packedAtoms(rows, { matchColour });
  const groups = new Map();
  atoms.forEach((atom) => {
    const k = groupKeyOf(atom, keys);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(atom);
  });

  return [...groups.entries()].map(([key, members], index) => {
    const first = members[0];
    const quantity = members.reduce((s, a) => s + a.qty, 0);
    const memberSizes = members.map((a) => a.size);
    const colours = [...new Set(members.map((a) => a.colorName).filter(Boolean))];
    const pos = [...new Set(members.map((a) => a.buyerPoNo).filter(Boolean))];

    const group = {
      styleNo: first.styleNo,
      colorName: mode === LINE_GRAIN.PER_PO_STYLE ? colours.join(', ') : first.colorName,
      colours,
      size: mode === LINE_GRAIN.PER_SIZE ? first.size : null,
      sizeRange: sizeRangeLabel(memberSizes, sizes),
      sizes: memberSizes,
      buyerPoNo: pos.length === 1 ? pos[0] : (pos[0] ?? null),
      buyerPoNos: pos,
      orderLineId: first.orderLineId,
      sourceEntryId: first.sourceEntryId,
      orderNo: first.orderNo,
      destination: first.destination,
      endCustomer: first.endCustomer,
      packingCode: first.packingCode,
      danNo: first.danNo,
      quantity,
      members,
    };

    const hsCode = hsCodeFor(group);
    const composition = compositionFor(group);
    const garmentName = garmentNameFor(group);
    const articleNo = articleNoFor(group)
      ?? (mode === LINE_GRAIN.PER_SIZE ? first.articleNo : null);

    const scope = {
      row: group,
      style: { garmentName, hsCode, composition },
      line: { sizeRange: group.sizeRange, size: group.size },
    };
    const description = grain.descriptionTemplate
      ? renderTemplate(grain.descriptionTemplate, scope)
      : [garmentName, group.styleNo, group.colorName, composition].filter(Boolean).join(' — ');

    return finaliseLine({
      seq: index + 1,
      key,
      description,
      styleNo: group.styleNo,
      colorName: group.colorName,
      size: group.size,
      sizeRange: group.sizeRange,
      buyerPoNo: group.buyerPoNo,
      orderLineId: group.orderLineId,
      orderNo: group.orderNo,
      articleNo,
      hsCode,
      composition,
      // Prénatal's with/without-hanger column is packaging metadata the template
      // opts into; it is carried, never invented.
      packagingAttributes: grain.showPackagingAttributes
        ? { packingCode: group.packingCode, danNo: group.danNo, endCustomer: group.endCustomer }
        : null,
      quantity,
      rate: rateFor(group),
      unit,
      nonMerchandise: false,
      // styleNo and colorName travel WITH the atom: a mixed carton's colours live on
      // its colour rows, so re-reading them from the row loses them and every mixed
      // quantity then looks unpriced.
      sourceAtoms: members.map((a) => ({
        rowId: a.rowId, size: a.size, qty: a.qty, styleNo: a.styleNo, colorName: a.colorName,
      })),
    });
  });
};

/** Amount is always computed, never typed (PRD §8.5). */
const finaliseLine = (line) => ({
  ...line,
  id: line.id ?? line.key,
  quantity: Math.trunc(num(line.quantity)), // §24: pieces are integers, always
  amount: line.rate === null || line.rate === undefined
    ? null
    : round(Math.trunc(num(line.quantity)) * num(line.rate), 2),
});

/** Recompute one line after an edit, so `amount` can never be stale or hand-typed. */
export const recalcLine = (line) => finaliseLine(line);

// ─── Charges and totals (PRD §8.4) ──────────────────────────────────────────────

/**
 * grand total = lines − discount + freight + insurance + other.
 *
 * The discount is returned as its own signed figure because Prénatal prints it as a
 * line of its own; percentage discounts resolve against the line subtotal.
 */
export const invoiceTotals = (lines, charges = {}) => {
  const linesTotal = round((lines || []).reduce((s, l) => s + num(l.amount), 0), 2);

  const d = charges.discount || {};
  const discount = !d.enabled
    ? 0
    : round(d.mode === 'PERCENT' ? (linesTotal * num(d.value)) / 100 : num(d.value), 2);

  const freight = charges.freight?.enabled ? round(num(charges.freight.value), 2) : 0;
  const insurance = charges.insurance?.enabled ? round(num(charges.insurance.value), 2) : 0;
  const other = charges.other?.enabled ? round(num(charges.other.value), 2) : 0;

  return {
    linesTotal,
    discount,
    discountPercent: d.enabled && d.mode === 'PERCENT' ? num(d.value) : null,
    freight,
    insurance,
    other,
    netTotal: round(linesTotal - discount + freight + insurance + other, 2),
    quantity: (lines || []).filter((l) => !l.nonMerchandise).reduce((s, l) => s + num(l.quantity), 0),
  };
};

/**
 * IGST block (BR-07): taxable INR = invoice value × FX; IGST = taxable × rate.
 *
 * Returns nulls rather than zeros when the FX rate is missing — a blank block is
 * honest, a zero one reads as a computed result and is not.
 */
export const igstBlock = (netTotal, fxRate, ratePct) => {
  const fx = num(fxRate);
  if (!(fx > 0)) return { fxRate: null, taxableInr: null, igstRatePct: num(ratePct), igstValue: null, totalTaxableInr: null };
  const taxableInr = round(num(netTotal) * fx, 2);
  const igstValue = round((taxableInr * num(ratePct)) / 100, 2);
  return {
    fxRate: fx,
    taxableInr,
    igstRatePct: num(ratePct),
    igstValue,
    totalTaxableInr: round(taxableInr + igstValue, 2),
  };
};

/**
 * The PL-derived block the invoice prints read-only (§8.4 "Totals block").
 * Summed across every bound packing list, because one invoice may cover several.
 */
export const aggregatePlTotals = (plTotalsList) => (plTotalsList || []).reduce((acc, t) => ({
  cartons: acc.cartons + num(t?.cartons),
  pieces: acc.pieces + num(t?.pieces),
  netWeightKg: round(acc.netWeightKg + num(t?.netWeightKg), 3),
  grossWeightKg: round(acc.grossWeightKg + num(t?.grossWeightKg), 3),
  cbm: round(acc.cbm + num(t?.cbm), 3),
}), { cartons: 0, pieces: 0, netWeightKg: 0, grossWeightKg: 0, cbm: 0 });

// ─── Defaulting from the order (PRD §8.3 "rates default from the order FOB") ────

/**
 * Resolve a line's rate from the ordered breakdown.
 *
 * A grouped line may span sizes the order priced differently — VGT prices 74–104
 * and 110–140 apart, yet invoices a single size range. A quantity-weighted average
 * is the only figure for which `qty x rate` still equals the ordered value, so that
 * is what is returned, flagged as blended so the wizard can say so rather than
 * presenting it as the order's price.
 *
 * Returns null when nothing in the group was priced — the caller must not invent a
 * rate, and V-12 reports the gap.
 */
export const makeRateResolver = (orderBreakdown, options = {}) => {
  const { matchColour = defaultMatchColour, decimals = 4 } = options;
  const key = (styleNo, colour, size) => `${lower(styleNo)}||${matchColour(colour)}||${text(size)}`;

  const index = new Map();
  (orderBreakdown || []).forEach((l) => {
    // `Number(null)` is 0, which is finite — so an unpriced line has to be rejected
    // before the numeric test, or every one of them indexes as a free item.
    if (l.orderRate === null || l.orderRate === undefined || l.orderRate === '') return;
    const r = Number(l.orderRate);
    // A zero FOB price is not a price to default from; V-12 reports the gap instead.
    if (!Number.isFinite(r) || r <= 0) return;
    index.set(key(l.styleNo, l.colorName, l.size), r);
  });

  const resolve = (group) => {
    if (!index.size) return null;
    let weighted = 0;
    let qty = 0;
    const distinct = new Set();
    (group.members || []).forEach((atom) => {
      const r = index.get(key(atom.styleNo, atom.colorName, atom.size));
      if (r === undefined) return;
      weighted += r * atom.qty;
      qty += atom.qty;
      distinct.add(r);
    });
    if (!qty) return null;
    return {
      rate: round(weighted / qty, decimals),
      blended: distinct.size > 1,
      pricedQty: qty,
      // Sizes the order never priced would otherwise vanish into the average.
      unpricedQty: (group.members || []).reduce((s, a) => s + a.qty, 0) - qty,
    };
  };

  // Convenience for buildInvoiceLines, which wants a plain number.
  resolve.rateOnly = (group) => resolve(group)?.rate ?? null;
  return resolve;
};
