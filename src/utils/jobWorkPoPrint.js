/**
 * The job-work PO vendor copy — Cut Panel PO (PRD FR-23, §18.4) and Garment Process PO
 * (§19.1 S4). One page per PO: company, job worker, order references, the lines the vendor
 * acts on, taxes, value and amount in words, instructions, delivery / return, signatures.
 * NEVER printed: required qty, previously PO'd, balance, internal remarks (OP-8).
 * Mixed UOMs show a subtotal per UOM instead of one quantity total (EC-12).
 * It wears the Supplier PO print's design (utils/print/poPrintTheme), with its own sections.
 */
import { esc, documentShell, openPrintWindow, documentFileName } from './printDoc';
import { amountInWordsIndian } from './amountInWords';
import { subtotalsByUom, lineAmount, billingQty } from './jobWorkPoCalc';
import { jobWorkUomLabel, optionLabel, CPP_RETURN_TO, GPO_RETURN_TO } from './jobWorkConstants';
import { JOB_WORK_PO_TYPE_LABEL, jobWorkPoStatusLabel, JW_PO_STATUS as S } from './jobWorkPoStatus';
import { formatDate } from './formatters';
import {
  PO_PRINT_CSS, companyWatermark, headerBand, infoCards, detailsGrid, itemsSection, totalsBox, summarySection,
  amountInWords, notesSection, noteStrip, signatures, printFooter,
} from './print/poPrintTheme';

const n = (v, dp = 0) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const money = (v) => n(v, 2);
const inr = (v) => `₹ ${money(v)}`;
const rate = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const uniq = (vals) => [...new Set(vals.filter(Boolean))].join(', ') || '—';

const LINE_COLUMNS = {
  CPP: [['Panel', (l) => l.panelName], ['Process', (l) => l.processLabel], ['Colour', (l) => l.colorName], ['Size', (l) => l.size]],
  GPO: [['GPR', (l) => l.gprNo], ['Process', (l) => `${l.seqNo}. ${l.processLabel}`], ['Colour', (l) => l.color], ['Size', (l) => l.size]],
};

/** Opens the vendor copy; false when the browser blocked the pop-up. `value` is poValue(); `org` the cached organisation. */
export const printJobWorkPo = (doc, value, org = {}) => {
  const lines = doc.lines.filter((l) => Number(l.poQty) > 0);
  const cols = LINE_COLUMNS[doc.type];
  const byUom = subtotalsByUom(lines);
  const returnTo = doc.returnTo === 'OTHER' ? doc.returnToOther : optionLabel(doc.type === 'CPP' ? CPP_RETURN_TO : GPO_RETURN_TO, doc.returnTo);
  const poNo = `${doc.poNo || 'Not saved'}${doc.revisionNo ? ` · R${doc.revisionNo}` : ''}`;
  const meta = [
    ['PO No.', poNo], ['PO Date', formatDate(doc.poDate)],
    ['Status', jobWorkPoStatusLabel(doc.status)], ['Payment terms', doc.paymentTerms || '—'],
    ['Order', uniq(lines.map((l) => l.orderNo))], ['Style', uniq(lines.map((l) => l.styleNo))],
    [doc.type === 'CPP' ? 'Fabric' : 'Buyer', uniq(lines.map((l) => (doc.type === 'CPP' ? l.fabricName : l.buyer)))],
    ['Requirement', uniq(lines.map((l) => l.cprNo || l.gprNo))],
    ['Expected delivery date', formatDate(doc.type === 'CPP' ? doc.requiredDeliveryDate : doc.expectedReturnDate)],
    ['Return to', returnTo || '—'], ['Return unit', doc.returnUnitName || '—'],
  ];
  const head = `${cols.map(([t]) => `<th class="left">${esc(t)}</th>`).join('')}<th>Qty</th><th>UOM</th>`
    + '<th>Billing qty</th><th>Rate ₹</th><th>Amount ₹</th>';
  const rows = lines.map((l) => `<tr>${cols.map(([, f]) => `<td class="left">${esc(f(l))}</td>`).join('')}
    <td class="num">${n(l.poQty)}</td><td>${esc(jobWorkUomLabel(l.uom))}</td><td class="num">${n(billingQty(l), 3)}</td>
    <td class="num">${rate(l.rate)}</td><td class="num total-col">${money(lineAmount(l))}</td></tr>`).join('');
  const foot = byUom.map((t) => `<tr><td colspan="${cols.length}" class="left">Subtotal — ${esc(jobWorkUomLabel(t.uom))}</td>
    <td class="num">${n(t.poQty)}</td><td></td><td class="num">${n(t.billingQty, 3)}</td><td></td><td class="num">${money(t.amount)}</td></tr>`).join('');
  const half = value.gstRatePercent / 2;
  const sac = doc.process?.sacCode;
  const tax = value.igst
    ? [{ label: `IGST @ ${value.gstRatePercent}% (SAC ${sac ?? '—'})`, value: inr(value.igstAmount), kind: 'tax' }]
    : [{ label: `CGST @ ${half}% (SAC ${sac ?? '—'})`, value: inr(value.cgst), kind: 'tax' },
      { label: `SGST @ ${half}%`, value: inr(value.sgst), kind: 'tax' }];
  // The Garment Process PO states a grand total, unrounded (GPO §8.4); the Cut Panel PO rounds (CPP §13.3).
  const total = doc.type === 'CPP'
    ? [{ label: 'PO value (INR)', value: inr(value.total), kind: 'subtotal' }, { label: 'Rounding', value: inr(value.roundOff) },
      { label: 'Rounded', value: inr(value.rounded), kind: 'highlight' }]
    : [{ label: 'Grand total (INR)', value: inr(value.total), kind: 'highlight' }];
  const totals = totalsBox([
    { label: doc.type === 'CPP' ? 'Basic amount' : 'Subtotal', value: inr(value.basic) },
    ...(value.otherCharges ? [{ label: 'Other charges', value: inr(value.otherCharges) }] : []),
    { label: 'Taxable value', value: inr(value.taxable), kind: 'subtotal' }, ...tax, ...total,
  ]);
  const vendor = doc.vendor || {};
  const body = `${companyWatermark(org)}<div class="page-content">
    ${headerBand({ org, docLabel: `Job Work Purchase Order · ${JOB_WORK_PO_TYPE_LABEL[doc.type]}`, docNo: poNo, status: jobWorkPoStatusLabel(doc.status) })}
    ${infoCards([
    { title: 'Job worker', name: vendor.name, gstin: vendor.gstin || '—',
      details: [vendor.address, [vendor.city, vendor.state, vendor.pincode].filter(Boolean).join(', '), [vendor.contactPerson, vendor.phone].filter(Boolean).join(' · ')] },
    { title: 'Deliver processed goods to', name: doc.returnUnitName, details: [doc.returnUnitAddress, returnTo] },
  ])}
    ${detailsGrid(meta)}
    ${itemsSection({ title: 'PO lines', head, body: rows, foot })}
    ${summarySection({ label: 'Total quantity', value: byUom.map((t) => `${n(t.poQty)} ${jobWorkUomLabel(t.uom)}`).join(' · '), totals })}
    ${amountInWords(amountInWordsIndian(doc.type === 'CPP' ? value.rounded : value.total))}
    ${notesSection('Processing instructions', doc.instructions)}
    ${noteStrip('Note', doc.type === 'CPP' ? 'Panels are issued against a delivery challan quoting this PO number; return every panel with the challan reference.'
    : 'Garments are sent against a delivery challan quoting this PO number; return them with the challan reference.')}
    ${signatures([{ name: doc.createdBy, role: 'Prepared by' }, { name: doc.approvedBy, role: 'Approved by' }, { role: 'Vendor acknowledgement' }])}
    ${printFooter(org)}
  </div>`;
  const title = documentFileName({ docType: doc.type === 'CPP' ? 'CutPanelPO' : 'GarmentProcessPO', buyer: doc.vendor?.name, docNo: doc.poNo || 'draft' }).replace(/\.pdf$/, '');
  const draft = [S.DRAFT, S.SUBMITTED].includes(doc.status);
  const watermark = [S.CANCELLED, S.REJECTED].includes(doc.status) ? jobWorkPoStatusLabel(doc.status).toUpperCase() : undefined;
  return openPrintWindow(documentShell({ title, bodyCss: PO_PRINT_CSS, draft, watermark, body }));
};
