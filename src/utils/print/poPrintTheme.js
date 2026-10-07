/**
 * The Supplier PO print's design (utils/poPdfGenerator.js) as building blocks, so every print of the PO family looks
 * the same: A4, Segoe UI 9px, the indigo header band with the company logo, party cards, the hairline details grid,
 * the dark-header line table, the totals box with its highlighted total, amount in words, notes, signatures and the
 * footer. Only the design is shared — each document keeps its own sections and content.
 *
 * Every builder escapes the text it is given (`esc`); only `itemsSection` takes markup (rows the caller built and
 * escaped). poPdfGenerator.js does not use this module yet: making it do so is a follow-up, so the Supplier PO print
 * is untouched (roadmap-status.md).
 */
import { esc } from '../printDoc';
import companyLogo from '../../assets/images/sristi_logo.jpeg';

export const PO_PRINT_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 10mm 8mm 12mm 8mm; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    font-size: 9px; color: #1a1a1a; line-height: 1.35; background: #fff;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .watermark {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 72px; font-weight: 800; color: rgba(99, 102, 241, 0.04); white-space: nowrap;
    pointer-events: none; z-index: 0; letter-spacing: 8px; text-transform: uppercase;
  }
  .page-content { position: relative; z-index: 1; }
  .header-section {
    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: white; padding: 12px 16px;
    border-radius: 6px 6px 0 0; display: flex; justify-content: space-between; align-items: center;
  }
  .brand { display: flex; align-items: center; }
  .company-info { flex: 1; }
  .company-name { font-size: 15px; font-weight: 700; margin-bottom: 4px; }
  .company-details { font-size: 8px; opacity: 0.9; line-height: 1.4; }
  .logo-box {
    width: 65px; height: 65px; background: white; border-radius: 6px; display: flex; align-items: center;
    justify-content: center; margin-right: 12px;
  }
  .logo-box img { max-width: 55px; max-height: 55px; object-fit: contain; }
  .po-badge { text-align: right; padding-left: 20px; }
  .po-badge .po-label { font-size: 7px; opacity: 0.8; text-transform: uppercase; letter-spacing: 1px; }
  .po-badge .po-number { font-size: 16px; font-weight: 700; letter-spacing: 0.5px; }
  .po-badge .po-status {
    display: inline-block; background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 10px;
    font-size: 8px; font-weight: 600; margin-top: 4px;
  }
  .info-row { display: flex; gap: 8px; margin-top: 8px; }
  .info-card { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 10px; }
  .info-card-header {
    font-size: 7px; text-transform: uppercase; letter-spacing: 0.5px; color: #6366f1; font-weight: 600;
    margin-bottom: 5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px;
  }
  .info-card-body { font-size: 8px; }
  .info-card-body .name { font-size: 10px; font-weight: 600; color: #1e293b; margin-bottom: 3px; }
  .info-card-body .detail { color: #475569; margin-bottom: 2px; }
  .info-card-body .gstin {
    font-family: monospace; background: #e0e7ff; padding: 2px 5px; border-radius: 3px; font-size: 8px;
    display: inline-block; margin-top: 3px; margin-right: 6px;
  }
  .po-details-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e2e8f0;
    border: 1px solid #e2e8f0; border-radius: 4px; margin-top: 8px; overflow: hidden;
  }
  .po-detail-item { background: white; padding: 6px 8px; text-align: center; }
  .po-detail-item .label { font-size: 7px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
  .po-detail-item .value { font-size: 9px; font-weight: 600; color: #1e293b; margin-top: 2px; }
  .items-section { margin-top: 8px; }
  .section-title {
    font-size: 9px; font-weight: 600; color: #374151; padding: 5px 8px; background: #f1f5f9;
    border-radius: 4px 4px 0 0; border: 1px solid #e2e8f0; border-bottom: none;
  }
  .items-table { width: 100%; border-collapse: collapse; font-size: 8px; }
  .items-table th {
    background: #1e293b; color: white; padding: 5px 3px; text-align: center; font-weight: 600; font-size: 7px;
    white-space: nowrap;
  }
  .items-table th.left, .items-table td.left { text-align: left; padding-left: 6px; }
  .items-table td { border: 1px solid #e2e8f0; padding: 4px 3px; vertical-align: top; }
  .items-table .num { text-align: right; font-family: 'SF Mono', Monaco, monospace; font-size: 8px; }
  .items-table .total-col { background: #f0fdf4; font-weight: 600; }
  .items-table tfoot td { background: #f8fafc; font-weight: 600; }
  .summary-section { margin-top: 8px; display: flex; gap: 8px; align-items: flex-start; }
  .qty-summary { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px; }
  .qty-summary .label { font-size: 7px; color: #64748b; text-transform: uppercase; }
  .qty-summary .value { font-size: 10px; font-weight: 600; color: #1e293b; margin-top: 2px; }
  .totals-box { width: 260px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 8px; font-size: 8px; border-bottom: 1px solid #e2e8f0; }
  .totals-row:last-child { border-bottom: none; }
  .totals-row .label { color: #475569; }
  .totals-row .value { font-weight: 600; font-family: monospace; }
  .totals-row.tax { padding-left: 16px; font-size: 7px; background: #fafafa; }
  .totals-row.tax .label { color: #64748b; }
  .totals-row.subtotal { background: #f1f5f9; font-weight: 600; }
  .totals-row.subtotal .label { color: #374151; }
  .totals-row.highlight { background: #6366f1; color: white; font-weight: 700; font-size: 10px; }
  .totals-row.highlight .label, .totals-row.highlight .value { color: white; }
  .amount-words {
    background: #fffbeb; border: 1px solid #fbbf24; border-radius: 4px; padding: 6px 10px; margin-top: 8px; font-size: 8px;
  }
  .amount-words strong { color: #92400e; }
  .terms-section { margin-top: 8px; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; }
  .terms-header {
    background: #f1f5f9; padding: 5px 8px; font-size: 8px; font-weight: 600; color: #374151; border-bottom: 1px solid #e2e8f0;
  }
  .terms-content { padding: 8px 10px; font-size: 8px; line-height: 1.4; color: #475569; }
  .remarks-section {
    background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; padding: 6px 10px; margin-top: 8px; font-size: 8px;
  }
  .remarks-section strong { color: #92400e; }
  .signature-section {
    margin-top: 12px; display: flex; justify-content: space-between; padding-top: 10px; border-top: 1px solid #e2e8f0;
  }
  .signature-box { text-align: center; min-width: 90px; }
  .signature-box .line { width: 80px; height: 1px; background: #94a3b8; margin: 25px auto 5px; }
  .signature-box .role { font-size: 7px; color: #64748b; font-weight: 500; }
  .signature-box .name { font-size: 8px; font-weight: 600; margin-bottom: 2px; min-height: 11px; }
  .footer {
    margin-top: 10px; text-align: center; font-size: 7px; color: #6366f1; font-weight: 600; padding: 6px;
    background: #f0f4ff; border-radius: 4px;
  }
  .note-line { font-size: 7px; color: #64748b; text-align: center; margin-top: 5px; }
`;

const text = (v) => esc(v == null || v === '' ? '—' : v);

/** The company name, faint and diagonal behind the page, as on the Supplier PO. */
export const companyWatermark = (org = {}) => `<div class="watermark">${esc(org.organisationName || '')}</div>`;

/** The indigo band: logo, company name and details, then the document label, number and status on the right. */
export const headerBand = ({ org = {}, docLabel, docNo, status }) => {
  const place = [org.city, org.state].filter(Boolean).join(', ') + (org.pincode ? ` - ${org.pincode}` : '');
  const contact = [org.phone && `Tel: ${org.phone}`, org.email && `Email: ${org.email}`].filter(Boolean).join(' | ');
  const ids = [`GSTIN: ${org.gstin || '-'}`, `PAN: ${org.pan || '-'}`, org.cin && `CIN: ${org.cin}`].filter(Boolean).join(' | ');
  const details = [[org.addressLine1, org.addressLine2].filter(Boolean).join(', '), place, contact, ids].filter(Boolean).map(esc).join('<br>');
  return `<div class="header-section">
    <div class="brand"><div class="logo-box"><img src="${companyLogo}" alt="Logo" /></div>
      <div class="company-info"><div class="company-name">${esc(org.organisationName || 'Company')}</div><div class="company-details">${details}</div></div></div>
    <div class="po-badge"><div class="po-label">${esc(docLabel)}</div><div class="po-number">${text(docNo)}</div>${status ? `<div class="po-status">${esc(status)}</div>` : ''}</div>
  </div>`;
};

/** Party cards side by side: [{ title, name, details: [lines], gstin }]. */
export const infoCards = (cards) => `<div class="info-row">${cards.map((c) => `<div class="info-card">
    <div class="info-card-header">${esc(c.title)}</div>
    <div class="info-card-body">${c.name ? `<div class="name">${esc(c.name)}</div>` : ''}${(c.details || []).filter(Boolean).map((d) => `<div class="detail">${esc(d)}</div>`).join('')}${c.gstin ? `<span class="gstin">GSTIN: ${esc(c.gstin)}</span>` : ''}</div>
  </div>`).join('')}</div>`;

/** The hairline grid of [label, value] pairs, four to a row; a short last row is padded so no gap shows. */
export const detailsGrid = (items) => {
  const cells = items.map(([label, value]) => `<div class="po-detail-item"><div class="label">${esc(label)}</div><div class="value">${text(value)}</div></div>`);
  while (cells.length % 4) cells.push('<div class="po-detail-item"></div>');
  return `<div class="po-details-grid">${cells.join('')}</div>`;
};

/** A titled line table. `head`, `body` and `foot` are markup the caller built (and escaped). */
export const itemsSection = ({ title, head, body, foot = '' }) => `<div class="items-section">
    <div class="section-title">${esc(title)}</div>
    <table class="items-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot ? `<tfoot>${foot}</tfoot>` : ''}</table>
  </div>`;

/** The totals box: [{ label, value, kind? }] — kind `tax` (indented), `subtotal` (shaded) or `highlight` (the total). */
export const totalsBox = (rows) => `<div class="totals-box">${rows.map((r) => `<div class="totals-row${r.kind ? ` ${r.kind}` : ''}"><span class="label">${esc(r.label)}</span><span class="value">${esc(r.value)}</span></div>`).join('')}</div>`;

/** A summary card (left) beside the totals box (right). */
export const summarySection = ({ label, value, totals }) => `<div class="summary-section">
    <div class="qty-summary"><div class="label">${esc(label)}</div><div class="value">${text(value)}</div></div>${totals}
  </div>`;

export const amountInWords = (words) => `<div class="amount-words"><strong>Amount in Words:</strong> ${esc(words)}</div>`;

/** A titled block of free text (instructions, terms); line breaks kept. */
export const notesSection = (title, body) => `<div class="terms-section"><div class="terms-header">${esc(title)}</div>
    <div class="terms-content">${text(body).replace(/\n/g, '<br>')}</div></div>`;

/** The amber note strip. */
export const noteStrip = (label, body) => `<div class="remarks-section"><strong>${esc(label)}:</strong> ${esc(body)}</div>`;

/** Signature boxes: [{ name, role }]. */
export const signatures = (list) => `<div class="signature-section">${list.map((s) => `<div class="signature-box">
    <div class="name">${esc(s.name || '')}</div><div class="line"></div><div class="role">${esc(s.role)}</div></div>`).join('')}</div>`;

/** The closing strip and contact line. */
export const printFooter = (org = {}, note = 'This is a computer generated document') => `<div class="footer">${esc(note.toUpperCase())}</div>
  ${org.email ? `<div class="note-line">For any queries, please contact: ${esc(org.email)}</div>` : ''}`;
