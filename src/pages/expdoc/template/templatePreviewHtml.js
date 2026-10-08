/**
 * A template printed with sample data (§10.3), as HTML.
 *
 * Rendered by the SAME builders the real documents use, against real seeded packing
 * data — so what the user sees while configuring is the document, not an approximation
 * of it. A preview built by a second renderer would be free to be wrong in ways the real
 * one is not. Shared by the preview drawer and the upload review's inline preview.
 */
import {
  buildPackingListHtml, buildStickerSheetHtml, buildExportInvoiceHtml, templatePageMm,
} from '../../../utils/expDocHtml';
import { expandCartonRange } from '../../../utils/expDocCalc';
import { DOC_TYPE } from '../../../utils/expDocConstants';

const MM_TO_PX = 96 / 25.4;

/**
 * How wide the template's page is on screen, so a preview lays the document out at the
 * paper's width and scales it, rather than re-flowing it to fit. Null for a sticker
 * sheet, which fixes its own label sizes.
 */
export const previewPageWidthPx = (template) => (template && template.docType !== DOC_TYPE.STICKER
  ? Math.round(templatePageMm(template).widthMm * MM_TO_PX)
  : null);

/**
 * A sample loaded once, dressed in the template being edited — so an edit re-renders
 * without fetching the sample again. The packing list carries its template too.
 */
export const withTemplate = (sample, template) => (sample ? {
  ...sample,
  template,
  pl: sample.pl ? { ...sample.pl, template, templateId: template.id, templateVersion: template.version } : sample.pl,
} : sample);

/** What a preview can show: the template filled with sample values, or the template alone. */
export const PREVIEW_MODE = { VALUES: 'values', TEMPLATE: 'template' };
export const PREVIEW_MODES = [
  { value: PREVIEW_MODE.VALUES, label: 'Sample values' },
  { value: PREVIEW_MODE.TEMPLATE, label: 'Template only' },
];

/*
 * "Template only" hides the document's own values — every `.v` the renderer marks — and
 * keeps their space, so the page keeps its real shape. What belongs to the template
 * stays: labels and headings, text fixed in the layout, the exporter's organisation
 * details and the buyer.
 */
const TEMPLATE_ONLY_CSS = '<style>.v, .v * { color: transparent !important; }</style>';

const renderSample = (sample, exporter) => {
  if (!sample || sample.empty) return '';
  const tpl = sample.template;
  const shipment = sample.shipment || {};
  const ctxExporter = exporter || {};

  if (tpl.docType === DOC_TYPE.PACKING_LIST) {
    return buildPackingListHtml(sample.pl, { exporter: ctxExporter, shipment, draft: true });
  }

  if (tpl.docType === DOC_TYPE.STICKER) {
    const rows = (sample.pl.sections || []).flatMap((s) => s.rows || []);
    const first = rows[0];
    if (!first || !tpl.stickerLayout?.faces?.length) return '';
    // Two cartons is enough to show the layout and the "n of N" counter without
    // materialising a shipment's worth of labels.
    const cartons = expandCartonRange(rows, first.cartonFrom, Math.min(first.cartonTo, first.cartonFrom + 1), {
      totalCartonsInShipment: sample.pl.totalCartons || 0,
    });
    return buildStickerSheetHtml(cartons, {
      layout: tpl.stickerLayout,
      paper: tpl.stickerLayout.paperDefault,
      draft: true,
      // `pl` is in the context because a sticker layout may bind document-level
      // fields (the order number, say) alongside carton ones.
      ctx: {
        exporter: ctxExporter,
        shipment,
        pl: sample.pl,
        buyer: { name: sample.pl.buyerName },
        showLogo: tpl.identity?.showLogo === true,
      },
    });
  }

  // An invoice preview needs lines; the sample carries packing data, so a single
  // representative line is composed rather than a full invoice being invented.
  const rows = (sample.pl.sections || []).flatMap((s) => s.rows || []);
  const line = {
    id: 1,
    seq: 1,
    description: sample.entry?.garmentName || 'Sample garment',
    composition: sample.entry?.compositionText || null,
    styleNo: rows[0]?.styleNo || null,
    colorName: rows[0]?.colorName || null,
    sizeRange: (sample.pl.sizes || []).length
      ? `${sample.pl.sizes[0]}-${sample.pl.sizes[sample.pl.sizes.length - 1]}`
      : null,
    buyerPoNo: rows[0]?.buyerPoNo || null,
    hsCode: '6109',
    quantity: 1000,
    rate: 8.75,
    amount: 8750,
    unit: 'PCS',
    nonMerchandise: false,
    packagingAttributes: null,
  };
  return buildExportInvoiceHtml({
    invoiceNo: null,
    provisionalNo: 'SAMPLE',
    invoiceDate: sample.pl.plDate,
    buyerName: sample.pl.buyerName,
    currency: 'EUR',
    fxRate: 94.25,
    igstRatePct: tpl.igst?.defaultRatePct ?? 5,
    countryOfOrigin: 'INDIA',
    countryOfFinalDestination: shipment.countryOfFinalDestination,
    incoterm: shipment.incoterm,
    incotermPlace: shipment.portOfLoading,
    paymentTerms: 'TT 60 DAYS FROM BL DATE',
    buyerOrderNo: sample.entry?.orderNo,
    consignee: shipment.consignee || null,
    notify: shipment.notify || null,
    marksAndNos: '1–61',
    lines: [line],
    totals: {
      linesTotal: 8750, discount: 0, discountPercent: null, freight: 0,
      insurance: 0, other: 0, netTotal: 8750, quantity: 1000,
    },
    igst: {
      fxRate: 94.25, taxableInr: 824687.5, igstRatePct: tpl.igst?.defaultRatePct ?? 5,
      igstValue: 41234.38, totalTaxableInr: 865921.88,
    },
    plTotals: { cartons: 61, pieces: 1000, netWeightKg: 700.5, grossWeightKg: 760.25, cbm: 5.124 },
    finalSnapshot: null,
    template: tpl,
  }, { exporter: ctxExporter, shipment, draft: true });
};

/**
 * The preview's HTML: '' when there is nothing to show (no sample data, or a template
 * with no printable content yet). `templateOnly` hides the document's own values.
 */
export const buildTemplatePreviewHtml = (sample, exporter, { templateOnly = false } = {}) => {
  const html = renderSample(sample, exporter);
  return templateOnly && html ? html.replace('</head>', `${TEMPLATE_ONLY_CSS}</head>`) : html;
};
