/**
 * Shared document-printing helpers.
 *
 * Extracted from sampleInvoicePdfGenerator.js so the export documents and the
 * sample invoice share one escaping routine, one bordered-cell helper and one
 * print mechanism rather than drifting apart.
 *
 * Deliberately NOT shared: the invoice body. That generator is coupled to the
 * sampling module (SAMPLE_DECLARATION_BAND, INVOICE_TYPES) and the two documents
 * genuinely differ — samples carry no FX, IGST or charges; exports carry no
 * "no commercial value" band.
 *
 * The printed HTML is fully self-contained with inline styles: the print window has
 * none of the app's CSS, and neither does the preview iframe.
 */

/**
 * Escape a value destined for TEXT content. Newlines become <br/>, which is what
 * multi-line address blocks need.
 *
 * On document.write: this is the mechanism all twelve generators in this folder
 * use, and it is safe here because the window is same-origin, opened by the user's
 * own click, and every interpolated value passes through esc() or escAttr() first.
 * Nothing reaches the document unescaped.
 */
export const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\n/g, '<br/>');

/**
 * Escape a value destined for an ATTRIBUTE.
 *
 * esc() is not safe here on two counts: it leaves quotes intact, so a value could
 * break out of the attribute, and it injects <br/> tags that would appear literally.
 * Use this for anything interpolated inside quotes — titles, alt text, data
 * attributes.
 */
export const escAttr = (v) => String(v ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/** A labelled cell in the bordered header grid used by Indian export documents. */
export const cell = (label, value, opts = {}) => `
  <td colspan="${opts.colspan || 1}" style="border:1px solid #333;padding:4px 6px;vertical-align:top;${opts.style || ''}">
    <div style="font-size:8px;color:#555;font-style:italic;">${esc(label)}</div>
    <div style="font-size:10px;font-weight:${opts.bold ? 700 : 400};white-space:pre-wrap;">${esc(value) || '&mdash;'}</div>
  </td>`;

/**
 * Open a document in a fresh same-origin window and print it.
 *
 * Returns false when the browser blocked the pop-up, so the caller can say so
 * rather than appearing to do nothing.
 */
export const openPrintWindow = (html, { delayMs = 400 } = {}) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => setTimeout(() => printWindow.print(), delayMs);
  return true;
};

/**
 * `@page` rules plus a label-sheet grid.
 *
 * Chrome and Edge honour `@page { size }`; Firefox is partial and Safari largely
 * ignores it, which is why anything printed to a non-A4 stock also tells the user
 * to set the paper in the print dialog.
 */
export const pageCss = ({ widthMm, heightMm, marginMm = 0, cols = 1, rows = 1 }) => `
  @page { size: ${widthMm}mm ${heightMm}mm; margin: ${marginMm}mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  .sheet {
    width: ${widthMm}mm; height: ${heightMm}mm;
    page-break-after: always; break-after: page;
    display: grid;
    grid-template-columns: repeat(${cols}, 1fr);
    grid-template-rows: repeat(${rows}, 1fr);
  }
  .sheet:last-child { page-break-after: auto; break-after: auto; }
  .label { break-inside: avoid; page-break-inside: avoid; overflow: hidden; }
`;

/**
 * A diagonal DRAFT band, the print-side counterpart of the DraftWatermark
 * component. Applied to anything generated before approval (PRD §18).
 */
export const watermarkCss = (text) => `
  body::before {
    content: '${String(text).replace(/'/g, '')}';
    position: fixed;
    top: 42%; left: 50%;
    transform: translate(-50%, -50%) rotate(-32deg);
    font-size: ${String(text).length > 9 ? 84 : 120}px; font-weight: 800; letter-spacing: 12px;
    color: rgba(120, 120, 120, 0.16);
    z-index: 9999; pointer-events: none;
  }
`;

export const draftWatermarkCss = watermarkCss('DRAFT');

/**
 * Standard document chrome. `bodyCss` is per-document; nothing is inherited.
 *
 * `watermark` names the band explicitly. A cancelled or superseded document must not
 * print as a clean original, and stamping it "DRAFT" would be its own lie — so the
 * band says what the document actually is.
 */
export const documentShell = ({ title, bodyCss = '', draft = false, watermark, body }) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${esc(title)}</title>
  <style>
    ${bodyCss}
    ${watermark ? watermarkCss(watermark) : (draft ? draftWatermarkCss : '')}
  </style>
</head>
<body>${body}</body>
</html>`;

/**
 * File name for a generated document: {DocType}_{Buyer}_{No}_{Version}.{ext}
 * (PRD §18). Used as the print window's title, which is what browsers offer as
 * the default "Save as PDF" name.
 */
export const documentFileName = ({ docType, buyer, docNo, version, ext = 'pdf' }) => {
  const clean = (v) => String(v ?? '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '');
  return [clean(docType), clean(buyer), clean(docNo), version != null ? `v${version}` : null]
    .filter(Boolean)
    .join('_') + `.${ext}`;
};
