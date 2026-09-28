/**
 * Export Documentation — buyer template choice and field bindings.
 *
 * Two jobs:
 *
 *  1. CHOICE. A buyer may keep several active packing-list and invoice templates
 *     (sea / air, one per end customer …). There is no default: a new document takes
 *     the buyer's only template, and when there are several the user picks one
 *     (`rankTemplateCandidates`). The chosen revision is recorded on the document with
 *     a snapshot of its layout, so re-rendering a year later reproduces the original —
 *     templates are immutable once active. Carton-sticker templates are still resolved
 *     automatically, by buyer + sub-client (`resolveTemplate`).
 *
 *  2. BINDINGS. Everything printed is either a binding drawn from this catalogue or
 *     a fixed literal, so an admin cannot invent a field that would force manual
 *     entry downstream (PRD §10.3). The AI reader of uploaded buyer documents is sent
 *     this catalogue too, so it can only propose fields that exist.
 */
import { DOC_TYPE, TEMPLATE_STATUS } from './expDocConstants';
import { round } from './expDocCalc';
import { systemTemplateFor } from './expDocSystemTemplates';

// ─── Field catalogue ────────────────────────────────────────────────────────────
// `path` is what a template stores. `category` groups the picker. `sample` is what
// the live preview shows before real data exists.

export const FIELD_CATALOGUE = [
  // Exporter — from the organisation master plus the mock profile extras.
  { path: 'exporter.name', label: 'Exporter name', category: 'EXPORTER', type: 'string', sample: 'Avarsh Technologies' },
  { path: 'exporter.block', label: 'Exporter address block', category: 'EXPORTER', type: 'block', sample: 'Avarsh Technologies\nTiruppur, Tamil Nadu' },
  { path: 'exporter.gstin', label: 'GSTIN', category: 'EXPORTER', type: 'string', sample: '33AAACS1234F1Z5' },
  { path: 'exporter.iecNumber', label: 'IEC number', category: 'EXPORTER', type: 'string', sample: 'AAACS1234F' },
  { path: 'exporter.country', label: 'Country of origin', category: 'EXPORTER', type: 'string', sample: 'INDIA' },
  { path: 'exporter.logoUrl', label: 'Exporter logo', category: 'EXPORTER', type: 'string', sample: '' },
  { path: 'exporter.panNumber', label: 'PAN', category: 'EXPORTER', type: 'string', sample: 'AAACS1234F' },
  { path: 'exporter.adCode', label: 'AD code', category: 'EXPORTER', type: 'string', sample: '6390004-1900001' },
  { path: 'exporter.lutNumber', label: 'LUT number', category: 'EXPORTER', type: 'string', sample: 'AD330324000123X' },
  { path: 'exporter.aepcRegnNo', label: 'AEPC registration no.', category: 'EXPORTER', type: 'string', sample: 'TN/12345/2019' },
  { path: 'exporter.rexNumber', label: 'REX number', category: 'EXPORTER', type: 'string', sample: 'INREX3300123' },
  { path: 'exporter.starExportHouse', label: 'Star export house', category: 'EXPORTER', type: 'string', sample: 'Two Star Export House' },
  { path: 'exporter.bankBlock', label: 'Exporter bank details', category: 'EXPORTER', type: 'block', sample: 'UCO Bank, IBB Branch\nA/C NO: 18100200002081' },

  // Buyer and sub-client.
  { path: 'buyer.name', label: 'Buyer name', category: 'BUYER', type: 'string', sample: 'JOMO BV' },
  { path: 'buyer.subClient', label: 'Sub-client / end customer', category: 'BUYER', type: 'string', sample: 'AMG' },

  // Shipment — the entity this module supplies.
  { path: 'shipment.shipmentNo', label: 'Shipment number', category: 'SHIPMENT', type: 'string', sample: 'SHP/26-27/1001' },
  { path: 'shipment.etd', label: 'ETD', category: 'SHIPMENT', type: 'date', sample: '2026-09-13' },
  { path: 'shipment.eta', label: 'ETA', category: 'SHIPMENT', type: 'date', sample: '2026-10-09' },
  { path: 'shipment.vesselFlightNo', label: 'Vessel / flight', category: 'SHIPMENT', type: 'string', sample: 'MAERSK CHENNAI V.214W' },
  { path: 'shipment.portOfLoading', label: 'Port of loading', category: 'SHIPMENT', type: 'string', sample: 'Chennai Sea' },
  { path: 'shipment.portOfDischarge', label: 'Port of discharge', category: 'SHIPMENT', type: 'string', sample: 'Rotterdam' },
  { path: 'shipment.finalDestination', label: 'Final destination', category: 'SHIPMENT', type: 'string', sample: 'Valkenswaard, Netherlands' },
  { path: 'shipment.containerNos', label: 'Container number(s)', category: 'SHIPMENT', type: 'list', sample: 'MSKU7712345' },
  { path: 'shipment.sealNo', label: 'Seal number', category: 'SHIPMENT', type: 'string', sample: 'IN884213' },
  { path: 'shipment.incoterm', label: 'Incoterm', category: 'SHIPMENT', type: 'string', sample: 'FOB' },
  { path: 'shipment.deliveryCentre', label: 'Delivery centre', category: 'SHIPMENT', type: 'string', sample: 'DM Karlsruhe' },
  { path: 'shipment.consignee.block', label: 'Consignee address block', category: 'SHIPMENT', type: 'block', sample: 'JOMO BV\nValkenswaard' },
  { path: 'shipment.notify.block', label: 'Notify party block', category: 'SHIPMENT', type: 'block', sample: 'ABN AMRO Bank N.V.' },
  { path: 'shipment.preCarriageBy', label: 'Pre-carriage by', category: 'SHIPMENT', type: 'string', sample: 'N.A.' },
  { path: 'shipment.placeOfReceipt', label: 'Place of receipt by pre-carrier', category: 'SHIPMENT', type: 'string', sample: 'N.A.' },
  { path: 'shipment.countryOfFinalDestination', label: 'Country of final destination', category: 'SHIPMENT', type: 'string', sample: 'Netherlands' },

  // Document header.
  { path: 'pl.plNo', label: 'Packing list number', category: 'PL', type: 'string', sample: 'PKL/26-27/1001' },
  { path: 'pl.plDate', label: 'Packing list date', category: 'PL', type: 'date', sample: '2026-09-01' },
  { path: 'pl.revision', label: 'Revision', category: 'PL', type: 'number', sample: 0 },
  // §12.1 document-level fields. The four resolved ones fall back to the shipment when
  // the document has not overridden them, so a template binds one path either way.
  { path: 'pl.descriptionOfGoods', label: 'Description of goods', category: 'PL', type: 'string', sample: "MEN'S KNITTED GARMENTS" },
  { path: 'pl.marksAndNos', label: 'Marks & numbers', category: 'PL', type: 'string', sample: '1-48' },
  { path: 'pl.orderNos', label: 'Order number(s)', category: 'PL', type: 'list', sample: 'SG/26-27/1042' },
  { path: 'pl.remarks', label: 'Document remarks', category: 'PL', type: 'string', sample: 'Loose cartons stowed aft' },
  { path: 'pl.resolved.consignee.block', label: 'Consignee (document)', category: 'PL', type: 'block', sample: 'JOMO BV, Valkenswaard' },
  { path: 'pl.resolved.deliveryCentre', label: 'Delivery centre (document)', category: 'PL', type: 'string', sample: 'DM Karlsruhe' },
  { path: 'pl.resolved.containerNo', label: 'Container no. (document)', category: 'PL', type: 'string', sample: 'MSKU1234567' },
  { path: 'pl.resolved.sealNo', label: 'Seal no. (document)', category: 'PL', type: 'string', sample: 'SL-889210' },
  { path: 'pl.totals.cartons', label: 'Total cartons', category: 'PL', type: 'number', sample: 48 },
  { path: 'pl.totals.pieces', label: 'Total pieces', category: 'PL', type: 'number', sample: 2627 },
  { path: 'pl.totals.netWeightKg', label: 'Total net weight (kg)', category: 'PL', type: 'number', decimals: 3, sample: 322.12 },
  { path: 'pl.totals.grossWeightKg', label: 'Total gross weight (kg)', category: 'PL', type: 'number', decimals: 3, sample: 371.82 },
  { path: 'pl.totals.cbm', label: 'Total CBM', category: 'PL', type: 'number', decimals: 3, sample: 2.43 },

  // Style.
  { path: 'style.styleNo', label: 'Style number', category: 'STYLE', type: 'string', sample: 'ST-2026-0441' },
  { path: 'style.garmentName', label: 'Garment name', category: 'STYLE', type: 'string', sample: "Men's Slim Fit Polo" },
  { path: 'style.compositionText', label: 'Composition', category: 'STYLE', type: 'string', sample: '95% COTTON 5% ELASTANE' },
  { path: 'style.hsCode', label: 'HS code', category: 'STYLE', type: 'string', sample: '6109' },

  // Carton row — the packing grid.
  { path: 'row.cartonRange', label: 'Carton number range', category: 'ROW', type: 'string', sample: '1-47' },
  { path: 'row.cartonCount', label: 'Number of cartons', category: 'ROW', type: 'number', sample: 47 },
  { path: 'row.danNo', label: 'DAN number', category: 'ROW', type: 'string', sample: 'DAN-4471' },
  { path: 'row.endCustomer', label: 'End customer', category: 'ROW', type: 'string', sample: 'Ten Hoor' },
  { path: 'row.packingCode', label: 'Packing code', category: 'ROW', type: 'string', sample: 'PC-12' },
  { path: 'row.buyerPoNo', label: 'Buyer PO number', category: 'ROW', type: 'string', sample: 'PO-884213' },
  { path: 'row.styleNo', label: 'Style (row)', category: 'ROW', type: 'string', sample: 'ST-2026-0441' },
  { path: 'row.colorName', label: 'Colour', category: 'ROW', type: 'string', sample: 'Navy' },
  { path: 'row.sizeQty', label: 'Size quantities', category: 'ROW', type: 'map', sample: '{ M: 10, L: 20 }' },
  { path: 'row.netWeightKg', label: 'Net weight per carton', category: 'ROW', type: 'number', decimals: 3, sample: 12.48 },
  { path: 'row.grossWeightKg', label: 'Gross weight per carton', category: 'ROW', type: 'number', decimals: 3, sample: 13.5 },
  { path: 'row.lengthCm', label: 'Length (cm)', category: 'ROW', type: 'number', sample: 60 },
  { path: 'row.breadthCm', label: 'Breadth (cm)', category: 'ROW', type: 'number', sample: 40 },
  { path: 'row.heightCm', label: 'Height (cm)', category: 'ROW', type: 'number', sample: 35 },
  { path: 'row.destination', label: 'Destination (row)', category: 'ROW', type: 'string', sample: 'Rotterdam' },
  { path: 'row.packingType', label: 'Packing type', category: 'ROW', type: 'string', sample: 'Ratio / assortment' },

  // Individual carton — sticker layouts only.
  { path: 'carton.cartonNo', label: 'Carton number', category: 'CARTON', type: 'number', sample: 12 },
  { path: 'carton.nOfN', label: 'Carton "n of N"', category: 'CARTON', type: 'string', sample: '12 of 61' },
  { path: 'carton.pieces', label: 'Pieces in the carton', category: 'CARTON', type: 'number', sample: 60 },
  { path: 'carton.colorName', label: 'Carton colour', category: 'CARTON', type: 'string', sample: 'Navy' },
  { path: 'carton.danNo', label: 'Carton DAN number', category: 'CARTON', type: 'string', sample: 'DAN-4471' },
  { path: 'carton.endCustomer', label: 'Carton end customer', category: 'CARTON', type: 'string', sample: 'Ten Hoor' },
  { path: 'carton.buyerPoNo', label: 'Carton PO number', category: 'CARTON', type: 'string', sample: 'PO-884213' },
  { path: 'carton.styleNo', label: 'Carton style', category: 'CARTON', type: 'string', sample: 'ST-2026-0441' },
  { path: 'carton.netWeightKg', label: 'Carton net weight', category: 'CARTON', type: 'number', decimals: 3, sample: 12.48 },
  { path: 'carton.grossWeightKg', label: 'Carton gross weight', category: 'CARTON', type: 'number', decimals: 3, sample: 13.5 },
  { path: 'carton.dimensions', label: 'Carton measurement', category: 'CARTON', type: 'string', sample: '60 × 40 × 35' },
  { path: 'carton.sizeText', label: 'Sizes in the carton', category: 'CARTON', type: 'string', sample: 'M / L / XL' },
  { path: 'carton.articleNo', label: "Buyer's article number", category: 'CARTON', type: 'string', sample: 'ART-99120' },
  { path: 'carton.destination', label: 'Port of destination', category: 'CARTON', type: 'string', sample: 'Rotterdam' },
  { path: 'carton.cbm', label: 'Carton CBM', category: 'CARTON', type: 'number', decimals: 3, sample: 0.084 },
  { path: 'carton.eanBySize', label: 'EAN by size', category: 'CARTON', type: 'map', sample: '{ M: 8712345678901 }' },

  // Computed — never enterable.
  { path: 'calc.piecesPerCarton', label: 'Pieces per carton', category: 'CALC', type: 'number', sample: 60 },
  { path: 'calc.totalPieces', label: 'Total pieces', category: 'CALC', type: 'number', sample: 2820 },
  { path: 'calc.cbm', label: 'CBM', category: 'CALC', type: 'number', decimals: 3, sample: 0.084 },
  { path: 'calc.dimensions', label: 'L × B × H', category: 'CALC', type: 'string', sample: '60 × 40 × 35' },
  // Per-row totals: a buyer's "TTL NT.WT" is the carton weight times the cartons in the row.
  { path: 'calc.totalNetWeightKg', label: 'Net weight, all cartons in the row', category: 'CALC', type: 'number', decimals: 3, sample: 587.0 },
  { path: 'calc.totalGrossWeightKg', label: 'Gross weight, all cartons in the row', category: 'CALC', type: 'number', decimals: 3, sample: 634.5 },
  { path: 'calc.totalCbm', label: 'CBM, all cartons in the row', category: 'CALC', type: 'number', decimals: 3, sample: 3.948 },

  // Pack structure. A JOMO "Units" section prints pieces-per-assortment ×
  // assortments-per-carton; a Prenatal ratio pack prints PCS/MPB × MPB/carton. The
  // data was captured and used for arithmetic but could not be bound to a column.
  { path: 'row.assortmentsPerCarton', label: 'Assortments per carton', category: 'ROW', type: 'number', sample: 4 },
  { path: 'row.pcsPerMpb', label: 'Pieces per master polybag', category: 'ROW', type: 'number', sample: 6 },
  { path: 'row.mpbPerCarton', label: 'Master polybags per carton', category: 'ROW', type: 'number', sample: 8 },
  { path: 'calc.piecesPerAssortment', label: 'Pieces per assortment', category: 'CALC', type: 'number', sample: 5 },
  { path: 'carton.assortmentsPerCarton', label: 'Assortments per carton', category: 'CARTON', type: 'number', sample: 4 },
  { path: 'carton.pcsPerMpb', label: 'Pieces per master polybag', category: 'CARTON', type: 'number', sample: 6 },
  { path: 'carton.mpbPerCarton', label: 'Master polybags per carton', category: 'CARTON', type: 'number', sample: 8 },
  { path: 'carton.piecesPerAssortment', label: 'Pieces per assortment', category: 'CARTON', type: 'number', sample: 5 },

  // Invoice — bindable on INVOICE templates. `resolveBinding` already read these
  // (it walks any dotted path), but without a catalogue entry the binding picker
  // could not offer them and `isBindable` reported them as unknown.
  { path: 'invoice.invoiceNo', label: 'Invoice number', category: 'INVOICE', type: 'string', sample: 'EXP/26-27/1001' },
  { path: 'invoice.invoiceDate', label: 'Invoice date', category: 'INVOICE', type: 'date', sample: '2026-09-01' },
  { path: 'invoice.buyerOrderNo', label: "Buyer's order number", category: 'INVOICE', type: 'string', sample: 'SG/26-27/1042' },
  { path: 'invoice.buyerOrderDate', label: "Buyer's order date", category: 'INVOICE', type: 'date', sample: '2026-08-14' },
  { path: 'invoice.exporterRef', label: "Exporter's reference", category: 'INVOICE', type: 'string', sample: 'IEC AAACS1234F' },
  { path: 'invoice.plTotals.cartons', label: 'Total cartons (invoice)', category: 'INVOICE', type: 'number', sample: 61 },
  { path: 'invoice.plTotals.pieces', label: 'Total pieces (invoice)', category: 'INVOICE', type: 'number', sample: 2124 },
  { path: 'invoice.plTotals.netWeightKg', label: 'Total net weight (invoice)', category: 'INVOICE', type: 'number', decimals: 3, sample: 700.5 },
  { path: 'invoice.plTotals.grossWeightKg', label: 'Total gross weight (invoice)', category: 'INVOICE', type: 'number', decimals: 3, sample: 760.25 },
  { path: 'invoice.plTotals.cbm', label: 'Total CBM (invoice)', category: 'INVOICE', type: 'number', decimals: 3, sample: 5.124 },
  { path: 'invoice.consignee.block', label: 'Consignee address block', category: 'INVOICE', type: 'block', sample: 'JOMO BV, Handelsweg 24, 5555 XT Valkenswaard' },
  { path: 'invoice.notify.block', label: 'Notify party block', category: 'INVOICE', type: 'block', sample: 'ABN AMRO Bank N.V., Amsterdam' },
  { path: 'invoice.incoterm', label: 'Incoterm', category: 'INVOICE', type: 'string', sample: 'FOB' },
  { path: 'invoice.incotermPlace', label: 'Incoterm named place', category: 'INVOICE', type: 'string', sample: 'Chennai Sea' },
  { path: 'invoice.paymentTerms', label: 'Payment terms', category: 'INVOICE', type: 'string', sample: 'TT 60 DAYS FROM BL DATE' },
  { path: 'invoice.currency', label: 'Currency', category: 'INVOICE', type: 'string', sample: 'EUR' },
  { path: 'invoice.fxRate', label: 'Exchange rate', category: 'INVOICE', type: 'number', decimals: 4, sample: 94.25 },
  { path: 'invoice.countryOfOrigin', label: 'Country of origin', category: 'INVOICE', type: 'string', sample: 'INDIA' },
  { path: 'invoice.countryOfFinalDestination', label: 'Country of final destination', category: 'INVOICE', type: 'string', sample: 'Netherlands' },
  { path: 'invoice.marksAndNos', label: 'Marks & numbers', category: 'INVOICE', type: 'string', sample: '1–61' },
  { path: 'invoice.totals.linesTotal', label: 'Lines total', category: 'INVOICE', type: 'number', decimals: 2, sample: 24847.5 },
  { path: 'invoice.totals.discount', label: 'Discount', category: 'INVOICE', type: 'number', decimals: 2, sample: 745.43 },
  { path: 'invoice.totals.netTotal', label: 'Invoice total', category: 'INVOICE', type: 'number', decimals: 2, sample: 24102.07 },
  { path: 'invoice.igst.taxableInr', label: 'Taxable value (INR)', category: 'INVOICE', type: 'number', decimals: 2, sample: 2271620.09 },
  { path: 'invoice.igst.igstValue', label: 'IGST value (INR)', category: 'INVOICE', type: 'number', decimals: 2, sample: 113581.0 },

  // Invoice goods lines — what a buyer's own invoice columns bind to. Quantity, rate
  // and amount always close the table, so a column bound to them is not repeated.
  { path: 'line.buyerPoNo', label: 'PO / order number', category: 'LINE', type: 'string', sample: '793272' },
  { path: 'line.orderNo', label: 'Our order number', category: 'LINE', type: 'string', sample: 'SG/26-27/1042' },
  { path: 'line.styleNo', label: 'Style / supplier article no.', category: 'LINE', type: 'string', sample: '555-14-01-W24' },
  { path: 'line.colorName', label: 'Colour', category: 'LINE', type: 'string', sample: 'BEIGE BROWN' },
  { path: 'line.description', label: 'Description of goods', category: 'LINE', type: 'string', sample: '100% ORGANIC COTTON WOVEN BABIES SHIRT' },
  { path: 'line.composition', label: 'Composition', category: 'LINE', type: 'string', sample: '100% ORGANIC COTTON' },
  { path: 'line.sizeRange', label: 'Size range', category: 'LINE', type: 'string', sample: '56-68' },
  { path: 'line.size', label: 'Size', category: 'LINE', type: 'string', sample: '62' },
  { path: 'line.hsCode', label: 'HS code', category: 'LINE', type: 'string', sample: '62092090' },
  { path: 'line.articleNo', label: "Buyer's article number", category: 'LINE', type: 'string', sample: '6342094' },
  { path: 'line.quantity', label: 'Quantity', category: 'LINE', type: 'number', sample: 264 },
  { path: 'line.rate', label: 'Rate', category: 'LINE', type: 'number', decimals: 2, sample: 3.55 },
  { path: 'line.amount', label: 'Amount', category: 'LINE', type: 'number', decimals: 2, sample: 937.2 },
];

export const FIELD_CATEGORIES = [
  { key: 'EXPORTER', label: 'Exporter' },
  { key: 'BUYER', label: 'Buyer' },
  { key: 'SHIPMENT', label: 'Shipment' },
  { key: 'PL', label: 'Document' },
  { key: 'STYLE', label: 'Style' },
  { key: 'ROW', label: 'Carton row' },
  { key: 'CARTON', label: 'Individual carton' },
  { key: 'CALC', label: 'Calculated' },
  { key: 'INVOICE', label: 'Invoice' },
  { key: 'LINE', label: 'Invoice line' },
];

const CATALOGUE_BY_PATH = FIELD_CATALOGUE.reduce((acc, f) => {
  acc[f.path] = f;
  return acc;
}, {});

export const getFieldMeta = (path) => CATALOGUE_BY_PATH[path] || null;

export const isBindable = (path) =>
  Boolean(CATALOGUE_BY_PATH[path]) || String(path || '').startsWith('fixed:');

// ─── Resolution ─────────────────────────────────────────────────────────────────

const active = (tpl, onDate) => {
  if (tpl.status !== TEMPLATE_STATUS.ACTIVE) return false;
  if (tpl.effectiveFrom && onDate && tpl.effectiveFrom > onDate) return false;
  if (tpl.effectiveTo && onDate && tpl.effectiveTo < onDate) return false;
  return true;
};

/**
 * Resolve the template for a document.
 *
 * Specificity order, most specific first:
 *   buyer + sub-client  >  buyer  >  generic
 * so a JOMO order for end-customer AMG picks the AMG template over JOMO's own,
 * and a buyer with no template at all still gets the standard export set rather
 * than failing (PRD §15: offer the standard template and notify the admin).
 */
export const resolveTemplate = (templates, { buyerCode, subClientCode, docType, onDate } = {}) => {
  const candidates = (templates || []).filter((t) => t.docType === docType && active(t, onDate));
  if (!candidates.length) return { template: null, matchedOn: 'NONE', isFallback: true };

  const bySpecificity = [
    { level: 'BUYER_SUBCLIENT', test: (t) => buyerCode && subClientCode && t.buyerCode === buyerCode && t.subClientCode === subClientCode },
    { level: 'BUYER', test: (t) => buyerCode && t.buyerCode === buyerCode && !t.subClientCode },
    { level: 'GENERIC', test: (t) => !t.buyerCode },
  ];

  for (const tier of bySpecificity) {
    const hits = candidates.filter(tier.test);
    if (!hits.length) continue;
    // Newest active version wins if a tenant has somehow published two.
    const template = hits.sort((a, b) => (b.version || 0) - (a.version || 0))[0];
    return { template, matchedOn: tier.level, isFallback: tier.level === 'GENERIC' && Boolean(buyerCode) };
  }

  return { template: null, matchedOn: 'NONE', isFallback: true };
};

/**
 * A buyer name as the template matcher compares it: accents, case, punctuation and
 * company-form words do not count, so "Prénatal Moeder en Kind BV" and "PRENATAL
 * MOEDER EN KIND B.V." are one buyer.
 */
export const normBuyerName = (name) => String(name || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b(b v|bv|ltd|limited|gmbh|inc|co|pvt|private|llc|nv|sa|ag)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * Does a template belong to this buyer? By buyer id when both sides have one; by
 * name otherwise, because packing lists and invoices are still mock documents that
 * carry the buyer's NAME, while templates are keyed on the real buyer master.
 */
export const templateMatchesBuyer = (template, { buyerId, buyerName } = {}) => {
  if (template.buyerId != null && buyerId != null) return Number(template.buyerId) === Number(buyerId);
  const own = normBuyerName(template.buyerName);
  return Boolean(own) && own === normBuyerName(buyerName);
};

/**
 * The templates a new packing list or invoice may use, in the order they are offered.
 *
 *   1. the buyer's own active templates — those for the document's sub-client first;
 *   2. tenant-wide templates (no buyer);
 *   3. the built-in standard layout.
 *
 * There is no default: `autoSelectId` is set only when the first tier that has any
 * template has exactly one. With two or more the user must choose.
 */
export const rankTemplateCandidates = (templates, { buyerId, buyerName, subClientCode, docType } = {}) => {
  const active = (templates || []).filter((t) => t.docType === docType
    && t.status === TEMPLATE_STATUS.ACTIVE && !t.isSystem);
  const sub = String(subClientCode || '').trim().toUpperCase();
  const own = active
    .filter((t) => (t.buyerId != null || t.buyerName) && templateMatchesBuyer(t, { buyerId, buyerName }))
    .map((t) => ({ ...t, tier: 'BUYER', matchesSubClient: Boolean(sub) && String(t.subClientCode || '').toUpperCase() === sub }))
    .sort((a, b) => Number(b.matchesSubClient) - Number(a.matchesSubClient)
      || String(a.name).localeCompare(String(b.name)));
  const generic = active
    .filter((t) => t.buyerId == null && !t.buyerName)
    .map((t) => ({ ...t, tier: 'GENERIC' }));
  const standard = systemTemplateFor(docType);
  const system = standard ? [{ ...standard, tier: 'SYSTEM' }] : [];
  const first = [own, generic, system].find((tier) => tier.length) || [];
  return {
    candidates: [...own, ...generic, ...system],
    autoSelectId: first.length === 1 ? first[0].id : null,
    hasOwn: own.length > 0,
  };
};

/**
 * Every bound element of a template, wherever it lives in the layout: header fields,
 * address blocks, the grid, each sheet's own columns, the invoice's columns and header
 * boxes, and sticker faces. `label` is what the builder names it by.
 */
export const templateBindings = (t = {}) => {
  const out = [];
  const add = (label, binding, bindable = true) => out.push({ label, binding, bindable });
  (t.headerFields || []).forEach((f) => add(f.label, f.binding));
  (t.addressBlocks || []).forEach((f) => add(f.label, f.binding));
  const columns = (cols) => (cols || []).forEach((c) => add(c.label, c.binding, c.type !== 'SIZE_GRID'));
  columns(t.columns);
  (t.sheets || []).forEach((s) => columns(s.columns));
  columns(t.invoiceColumns);
  Object.values(t.invoiceHeader?.boxes || {}).forEach((b) => { if (b?.binding) add(b.label, b.binding); });
  (t.stickerLayout?.faces || []).forEach((face) => {
    (face.lines || []).forEach((l) => add(l.label, l.binding, false));
    if (face.barcode?.binding) add('Barcode', face.barcode.binding, false);
  });
  return out;
};

/** Bindings the catalogue does not know — they print blank (§10.3). */
export const unknownBindingsOf = (t) => [...new Set(templateBindings(t)
  .map((e) => e.binding)
  .filter((b) => b && typeof b === 'string' && !isBindable(b) && !b.startsWith('row.sizeQty')))];

/** Labelled fields and columns with no data source at all — they print their label only. */
export const unboundLabelsOf = (t) => templateBindings(t)
  .filter((e) => e.bindable && e.label && !e.binding)
  .map((e) => e.label);

/** The catalogue as the AI reader of uploaded documents is sent it (no sticker-only fields). */
export const catalogueForReader = () => FIELD_CATALOGUE
  .filter((f) => f.category !== 'CARTON')
  .map(({ path, label, category }) => ({ path, label, category }));

/**
 * Sticker templates that break "exactly one Active per buyer / sub-client / doc type"
 * — the rule stickers still resolve by. Surfaced on the template register rather than
 * discovered at render time. Packing-list and invoice templates may have several.
 */
export const findActiveConflicts = (templates) => {
  const seen = new Map();
  (templates || [])
    .filter((t) => t.status === TEMPLATE_STATUS.ACTIVE)
    .forEach((t) => {
      const key = `${t.buyerCode || '*'}|${t.subClientCode || '*'}|${t.docType}`;
      seen.set(key, [...(seen.get(key) || []), t]);
    });
  return [...seen.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, list]) => ({ key, templates: list }));
};

// ─── Binding resolution ─────────────────────────────────────────────────────────

const readPath = (source, path) =>
  String(path).split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), source);

/**
 * Resolve one binding against a render context.
 *
 * `fixed:` literals pass through verbatim — that is how a template carries text the
 * ERP has no field for (a licence number, a regulatory line) without inventing one.
 * Unknown paths return null rather than throwing: a document must still render when
 * a template references something the current data does not carry.
 */
export const resolveBinding = (path, ctx, options = {}) => {
  if (path == null) return null;
  const raw = String(path);
  if (raw.startsWith('fixed:')) return raw.slice(6);

  const value = readPath(ctx, raw);
  if (value === undefined) return null;

  const meta = CATALOGUE_BY_PATH[raw];
  const decimals = options.decimals ?? meta?.decimals;

  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'number' && decimals != null) return round(value, decimals).toFixed(decimals);
  return value;
};

/** Format a resolved value for display, honouring a column's prefix/suffix/decimals. */
export const formatBound = (value, spec = {}) => {
  if (value === null || value === undefined || value === '') return spec.emptyText ?? '—';
  const shown = typeof value === 'number' && spec.decimals != null
    ? round(value, spec.decimals).toFixed(spec.decimals)
    : value;
  return `${spec.prefix || ''}${shown}${spec.suffix || ''}`;
};

/**
 * Expand a template's column set against a size list. The SIZE_GRID pseudo-column
 * becomes one column per size, in the order the packing entry froze — which is why
 * the on-screen grid and the printed grid cannot drift apart: they share this spec.
 */
export const expandColumnSpec = (cols = [], sizes = []) => (cols || []).flatMap((col) => {
  if (col.type !== 'SIZE_GRID') return [col];
  return sizes.map((size) => ({
    key: `size-${size}`,
    label: size,
    binding: `row.sizeQty.${size}`,
    size,
    isSizeColumn: true,
    width: col.width || 76,
    align: col.align || 'right',
    total: col.total,
    // A spanning header over the sizes ("units"), and whether a size cell prints the
    // pieces in the carton or the assortment ratio (AMG, Prénatal ratio packs).
    group: col.group,
    sizeValue: col.sizeValue,
  }));
});

export const expandColumns = (template, sizes = []) => expandColumnSpec(template?.columns || [], sizes);

export const templateLabel = (template) =>
  (template ? `${template.name} v${template.version}` : 'No template');

export const DOC_TYPE_TEMPLATE_ORDER = [DOC_TYPE.PACKING_LIST, DOC_TYPE.INVOICE, DOC_TYPE.STICKER];
