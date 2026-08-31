import { amountInWords } from './amountInWords';
import { SAMPLE_DECLARATION_BAND, INVOICE_TYPES } from './sampleRequestConstants';

/**
 * Invoice print, type-aware (R2) — reproduces the existing Avarsh export
 * invoice layout (bordered header grid, line-item block, totals, amount in
 * words, bankers + declaration + signature footer):
 *  - COMMERCIAL (series EXSG, ref SG20): titled "COMMERCIAL INVOICE — NOT FOR
 *    SALE" with the SAMPLES-ONLY band and the customs declaration.
 *  - SAMPLE (series SA, ref SA011): a chargeable INVOICE — no band, the
 *    actual-price declaration, payment terms, bankers block. The 2× recovery
 *    guidance NEVER prints — only the entered rates appear.
 * Same print mechanism as the other document generators in this folder
 * (new window + window.print()).
 */
const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/\n/g, '<br/>');

const cell = (label, value, opts = {}) => `
  <td colspan="${opts.colspan || 1}" style="border:1px solid #333;padding:4px 6px;vertical-align:top;${opts.style || ''}">
    <div style="font-size:8px;color:#555;font-style:italic;">${esc(label)}</div>
    <div style="font-size:10px;font-weight:${opts.bold ? 700 : 400};white-space:pre-wrap;">${esc(value) || '&mdash;'}</div>
  </td>`;

export const buildSampleInvoiceHtml = (inv, profile) => {
  const isSample = inv.invoiceType === INVOICE_TYPES.SAMPLE;
  const printTitle = isSample ? 'INVOICE' : 'COMMERCIAL INVOICE — NOT FOR SALE';
  const declaration = isSample
    ? (profile.extra?.declarationTextSample || '')
    : (profile.extra?.declarationText || '');
  const totalQty = (inv.lines || []).reduce((s, l) => s + (Number(l.quantity) || 0), 0);
  const totalValue = (inv.lines || []).reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);
  const uom = inv.lines?.[0]?.uom || 'PCS';

  const lineRows = (inv.lines || []).map((l, i) => `
    <tr>
      <td style="border:1px solid #333;padding:4px 6px;font-size:10px;text-align:center;">${i === 0 ? esc(inv.marksAndNos) : ''}</td>
      <td style="border:1px solid #333;padding:4px 6px;font-size:10px;text-align:center;">${esc(l.hsnCode)}</td>
      <td style="border:1px solid #333;padding:4px 6px;font-size:10px;text-align:center;">${i === 0 ? esc(inv.packages) : ''}</td>
      <td style="border:1px solid #333;padding:4px 6px;font-size:10px;">
        <strong>${esc(l.description)}</strong>
        ${l.srNo ? `<br/><span style="font-size:8.5px;color:#555;">${esc(l.srNo)} · Style ${esc(l.styleNo || '')}</span>` : '<br/><span style="font-size:8.5px;color:#555;">manual line</span>'}
      </td>
      <td style="border:1px solid #333;padding:4px 6px;font-size:10px;text-align:right;">${Number(l.quantity) || 0}</td>
      <td style="border:1px solid #333;padding:4px 6px;font-size:10px;text-align:right;">${l.rate != null ? Number(l.rate).toFixed(2) : ''}</td>
      <td style="border:1px solid #333;padding:4px 6px;font-size:10px;text-align:right;">${((Number(l.quantity) || 0) * (Number(l.rate) || 0)).toFixed(2)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${esc(inv.invoiceNo || 'DRAFT')} — ${isSample ? 'Invoice' : 'Commercial Invoice'}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 24px; color: #111; }
  table { border-collapse: collapse; width: 100%; }
  @media print { body { margin: 8mm; } .no-print { display: none; } }
</style>
</head>
<body>
  <div style="text-align:center;border:1px solid #333;border-bottom:none;padding:8px;">
    <span style="font-size:14px;font-weight:700;letter-spacing:3px;">${printTitle}</span>
  </div>
  <table>
    <tr>
      ${cell('Exporter', `${profile.exporterBlock}`, { colspan: 2, bold: true })}
      ${cell('Invoice No. & Date', `${inv.invoiceNo || 'DRAFT'}   Dt. ${inv.invoiceDate || ''}`, { bold: true })}
      ${cell("Exporter's Ref. (IEC No.)", profile.extra?.iecNumber || '')}
    </tr>
    <tr>
      ${cell('Consignee', [inv.consigneeName, inv.consigneeAddress, inv.consigneeContact].filter(Boolean).join('\n'), { colspan: 2, bold: true })}
      ${cell("Buyer's Order No. & Date", inv.buyerOrderNoDate || '')}
      ${cell('Buyer (other than Consignee)', inv.buyerOtherThanConsignee || '')}
    </tr>
    <tr>
      ${cell('Other References', inv.otherReferences || '', { colspan: 2 })}
      ${cell('Notify Party', inv.notifyParty || '', { colspan: 2 })}
    </tr>
    <tr>
      ${cell('Pre-Carriage by', inv.preCarriage || 'N.A.')}
      ${cell('Place of Receipt by Pre-Carrier', inv.placeOfReceipt || 'N.A.')}
      ${cell('Country of Origin of Goods', inv.countryOfOrigin || '', { bold: true })}
      ${cell('Country of Final Destination', inv.destinationCountry || '', { bold: true })}
    </tr>
    <tr>
      ${cell('Vessel / Flight No.', inv.vesselFlightNo || '—')}
      ${cell('Port of Loading', inv.portOfLoading || '')}
      ${cell('Terms of Delivery & Payment', [inv.termsOfDelivery, inv.paymentTerms ? `PAYMENT: ${inv.paymentTerms}` : null].filter(Boolean).join('\n'), { colspan: 2 })}
    </tr>
    <tr>
      ${cell('Port of Discharge', inv.portOfDischarge || '—')}
      ${cell('Final Destination', inv.finalDestination || inv.destinationCountry || '')}
      ${cell('Container No.', inv.containerNo || '—', { colspan: 2 })}
    </tr>
  </table>
  <table>
    <tr>
      <th style="border:1px solid #333;padding:4px;font-size:9px;width:70px;">Marks &amp; Nos.</th>
      <th style="border:1px solid #333;padding:4px;font-size:9px;width:70px;">HSN Code</th>
      <th style="border:1px solid #333;padding:4px;font-size:9px;width:80px;">No. &amp; Kind of Pkg</th>
      <th style="border:1px solid #333;padding:4px;font-size:9px;">Description of Goods</th>
      <th style="border:1px solid #333;padding:4px;font-size:9px;width:70px;">Quantity<br/>in ${esc(uom).toLowerCase()}</th>
      <th style="border:1px solid #333;padding:4px;font-size:9px;width:70px;">Rate<br/>${esc(inv.currency)}<br/>Per ${esc(uom)}</th>
      <th style="border:1px solid #333;padding:4px;font-size:9px;width:80px;">Amount<br/>${esc(inv.currency)}</th>
    </tr>
    ${lineRows}
    ${isSample ? '' : `<tr>
      <td colspan="7" style="border:1px solid #333;padding:6px;text-align:center;font-size:10px;font-weight:700;">
        ${SAMPLE_DECLARATION_BAND}<br/>
        <span style="font-weight:400;font-size:9px;">COUNTRY OF ORIGIN : ${esc((inv.countryOfOrigin || '').toUpperCase())} · Value declared for customs purposes only</span>
      </td>
    </tr>`}
    <tr>
      <td colspan="4" style="border:1px solid #333;padding:4px 6px;font-size:10px;text-align:right;font-weight:700;">Total</td>
      <td style="border:1px solid #333;padding:4px 6px;font-size:10px;text-align:right;font-weight:700;">${totalQty} ${esc(uom)}</td>
      <td style="border:1px solid #333;"></td>
      <td style="border:1px solid #333;padding:4px 6px;font-size:10px;text-align:right;font-weight:700;">${totalValue.toFixed(2)}</td>
    </tr>
    <tr>
      <td colspan="7" style="border:1px solid #333;padding:4px 6px;font-size:10px;font-weight:700;">
        AMOUNT ${esc(amountInWords(totalValue, inv.currency))}
      </td>
    </tr>
    <tr>
      <td colspan="4" style="border:1px solid #333;padding:6px;font-size:9.5px;vertical-align:top;">
        <em>Our Bankers</em><br/>${esc(profile.bankBlock)}
        <br/><br/><strong>Declaration:</strong><br/>
        <span style="font-size:9px;">${esc(declaration)}</span>
      </td>
      <td colspan="3" style="border:1px solid #333;padding:6px;font-size:10px;text-align:center;vertical-align:top;">
        <em style="font-size:9px;">Signature &amp; Date</em>
        <br/><br/><br/><strong>For ${esc((profile.companyName || '').toUpperCase())}</strong>
        <br/><br/><br/>${esc(profile.extra?.signatory || 'Authorised Signatory')}
      </td>
    </tr>
  </table>
</body>
</html>`;
};

export const printSampleInvoice = (inv, profile) => {
  // Same print mechanism as trimsQCPdfGenerator/returnToSupplierPdfGenerator:
  // a fresh same-origin window; every interpolated value is HTML-escaped via
  // esc() above, so no user-controlled markup can execute.
  const html = buildSampleInvoiceHtml(inv, profile);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => setTimeout(() => printWindow.print(), 400);
  return true;
};
