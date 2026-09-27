/**
 * The job-work PO vendor copy — Cut Panel PO (PRD FR-23, §18.4) and Garment Process PO
 * (§19.1 S4). One page per PO: company, job worker, order references, the lines the vendor
 * acts on, taxes, value and amount in words, instructions, delivery / return, signatures.
 * NEVER printed: required qty, previously PO'd, balance, internal remarks (OP-8).
 * Mixed UOMs show a subtotal per UOM instead of one quantity total (EC-12).
 */
import { esc, documentShell, openPrintWindow, documentFileName } from './printDoc';
import { amountInWordsIndian } from './amountInWords';
import { subtotalsByUom, lineAmount, billingQty } from './jobWorkPoCalc';
import { jobWorkUomLabel, optionLabel, CPP_RETURN_TO, GPO_RETURN_TO, FREIGHT_OPTIONS, PROCESSING_LOCATIONS } from './jobWorkConstants';
import { JOB_WORK_PO_TYPE_LABEL, jobWorkPoStatusLabel, JW_PO_STATUS as S } from './jobWorkPoStatus';
import { formatDate } from './formatters';

const n = (v, dp = 0) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const money = (v) => n(v, 2);
const uniq = (vals) => [...new Set(vals.filter(Boolean))].join(', ') || '—';

const CSS = `
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; margin: 18px; }
  h1 { font-size: 16px; margin: 0; } h2 { font-size: 12px; margin: 14px 0 6px; }
  .top { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #333; padding-bottom: 8px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 16px; margin: 10px 0; }
  .grid b, .party b { display: block; font-size: 9px; color: #666; text-transform: uppercase; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 10px; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #bbb; padding: 3px 5px; }
  th { background: #f0f0f0; } .num { text-align: right; } tfoot td { font-weight: bold; }
  .value { width: 45%; margin-left: auto; margin-top: 8px; } .value td:first-child { border-right: 0; }
  .signs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin-top: 40px; text-align: center; }
  .signs div { border-top: 1px solid #333; padding-top: 4px; }
`;

const LINE_COLUMNS = {
  CPP: [['Panel', (l) => l.panelName], ['Process', (l) => l.processLabel], ['Colour', (l) => l.colorName], ['Size', (l) => l.size]],
  GPO: [['GPR', (l) => l.gprNo], ['Process', (l) => `${l.seqNo}. ${l.processLabel}`], ['Colour', (l) => l.color], ['Size', (l) => l.size]],
};

const party = (title, lines) => `<div class="party"><b>${esc(title)}</b>${lines.filter(Boolean).map(esc).join('<br/>')}</div>`;

/** Opens the vendor copy; false when the browser blocked the pop-up. `value` is poValue(); `org` the cached organisation. */
export const printJobWorkPo = (doc, value, org = {}) => {
  const lines = doc.lines.filter((l) => Number(l.poQty) > 0);
  const cols = LINE_COLUMNS[doc.type];
  const byUom = subtotalsByUom(lines);
  const returnTo = optionLabel(doc.type === 'CPP' ? CPP_RETURN_TO : GPO_RETURN_TO, doc.returnTo);
  const meta = [
    ['PO No.', `${doc.poNo || 'Not saved'}${doc.revisionNo ? ` · R${doc.revisionNo}` : ''}`], ['PO Date', formatDate(doc.poDate)],
    ['Status', jobWorkPoStatusLabel(doc.status)], ['Payment terms', doc.paymentTerms || '—'],
    ['Order', uniq(lines.map((l) => l.orderNo))], ['Style', uniq(lines.map((l) => l.styleNo))],
    [doc.type === 'CPP' ? 'Fabric' : 'Buyer', uniq(lines.map((l) => (doc.type === 'CPP' ? l.fabricName : l.buyer)))],
    ['Requirement', uniq(lines.map((l) => l.cprNo || l.gprNo))],
    [doc.type === 'CPP' ? 'Required delivery' : 'Expected return', formatDate(doc.type === 'CPP' ? doc.requiredDeliveryDate : doc.expectedReturnDate)],
    ['Return to', doc.returnTo === 'OTHER' ? doc.returnToOther : returnTo],
    ...(doc.type === 'CPP' ? [['Processing at', optionLabel(PROCESSING_LOCATIONS, doc.processingLocation)], ['Freight', optionLabel(FREIGHT_OPTIONS, doc.freight)]]
      : [['Planned send', formatDate(doc.plannedSendDate)], ['Delivery terms', doc.deliveryTerms || '—']]),
  ].map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v)}</div>`).join('');
  const head = `${cols.map(([t]) => `<th>${esc(t)}</th>`).join('')}<th class="num">Qty</th><th>UOM</th><th class="num">Billing qty</th><th class="num">Rate ₹</th><th class="num">Amount ₹</th>`;
  const rows = lines.map((l) => `<tr>${cols.map(([, f]) => `<td>${esc(f(l))}</td>`).join('')}<td class="num">${n(l.poQty)}</td>
    <td>${esc(jobWorkUomLabel(l.uom))}</td><td class="num">${n(billingQty(l), 3)}</td><td class="num">${money(l.rate)}</td><td class="num">${money(lineAmount(l))}</td></tr>`).join('');
  const foot = byUom.map((t) => `<tr><td colspan="${cols.length}">Subtotal — ${esc(jobWorkUomLabel(t.uom))}</td><td class="num">${n(t.poQty)}</td>
    <td></td><td class="num">${n(t.billingQty, 3)}</td><td></td><td class="num">${money(t.amount)}</td></tr>`).join('');
  const half = value.gstRatePercent / 2;
  const tax = value.igst ? `<tr><td>IGST @ ${value.gstRatePercent}% (SAC ${esc(doc.process?.sacCode)})</td><td class="num">${money(value.igstAmount)}</td></tr>`
    : `<tr><td>CGST @ ${half}% (SAC ${esc(doc.process?.sacCode)})</td><td class="num">${money(value.cgst)}</td></tr><tr><td>SGST @ ${half}%</td><td class="num">${money(value.sgst)}</td></tr>`;
  const body = `
    <div class="top"><div><h1>${esc(org.organisationName || 'Company')}</h1>${esc([org.addressLine1, org.addressLine2, org.city, org.state, org.pincode].filter(Boolean).join(', '))}<br/>GSTIN ${esc(org.gstin || '—')}</div>
      <div style="text-align:right"><h1>Job Work Purchase Order</h1>${esc(JOB_WORK_PO_TYPE_LABEL[doc.type])}</div></div>
    <div class="parties">${party('Job worker', [doc.vendor?.name, doc.vendor?.address, [doc.vendor?.city, doc.vendor?.state, doc.vendor?.pincode].filter(Boolean).join(', '), `GSTIN ${doc.vendor?.gstin || '—'}`, [doc.vendor?.contactPerson, doc.vendor?.phone].filter(Boolean).join(' · ')])}
      ${party('Deliver processed goods to', [returnTo, doc.returnToOther, doc.returnBranchName])}</div>
    <div class="grid">${meta}</div>
    <table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table>
    <table class="value"><tbody>
      <tr><td>Basic amount</td><td class="num">${money(value.basic)}</td></tr>
      ${value.discount ? `<tr><td>Discount</td><td class="num">− ${money(value.discount)}</td></tr>` : ''}
      ${value.otherCharges ? `<tr><td>Other charges</td><td class="num">${money(value.otherCharges)}</td></tr>` : ''}
      <tr><td>Taxable value</td><td class="num">${money(value.taxable)}</td></tr>${tax}
      <tr><td><b>PO value (INR)</b></td><td class="num"><b>${money(value.total)}</b></td></tr>
      <tr><td>Rounding</td><td class="num">${money(value.roundOff)}</td></tr>
      <tr><td><b>Rounded</b></td><td class="num"><b>${money(value.rounded)}</b></td></tr>
    </tbody></table>
    <p><b>Amount in words:</b> ${esc(amountInWordsIndian(value.rounded))}</p>
    <h2>Processing instructions</h2><p>${esc(doc.instructions || '—')}</p>
    <p>${esc(doc.type === 'CPP' ? 'Panels are issued against a delivery challan quoting this PO number; return every panel with the challan reference.'
      : 'Garments are sent against a delivery challan quoting this PO number; return them with the challan reference.')}</p>
    <div class="signs"><div>Prepared by<br/>${esc(doc.createdBy || '')}</div><div>Approved by<br/>${esc(doc.approvedBy || '')}</div><div>Vendor acknowledgement</div></div>`;
  const title = documentFileName({ docType: doc.type === 'CPP' ? 'CutPanelPO' : 'GarmentProcessPO', buyer: doc.vendor?.name, docNo: doc.poNo || 'draft' }).replace(/\.pdf$/, '');
  const draft = [S.DRAFT, S.SUBMITTED].includes(doc.status);
  const watermark = [S.CANCELLED, S.REJECTED].includes(doc.status) ? jobWorkPoStatusLabel(doc.status).toUpperCase() : undefined;
  return openPrintWindow(documentShell({ title, bodyCss: CSS, draft, watermark, body }));
};
