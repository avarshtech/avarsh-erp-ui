import dayjs from 'dayjs';
import { documentShell, esc, openPrintWindow } from './printDoc';
import { numberToWords } from './amountInWords';
import { conditionMeta } from './assetConstants';

/**
 * The delivery challan that travels with the machines (PRD section G).
 *
 * This is the document the lorry driver carries and the receiving unit signs.
 * It is deliberately NOT a tax invoice and says so on its face: moving a
 * machine between two of the company's own units is not a supply, and a
 * document that looked like an invoice would invite somebody to treat it as one.
 *
 * Printed from the transfer as it stands. A challan reprinted after receipt
 * shows the received conditions too, so the signed copy and the register agree.
 */
const CSS = `
  @page { size: A4 portrait; margin: 12mm 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10px; color: #000; margin: 0; }
  .doc { border: 1px solid #333; }
  .head { text-align: center; padding: 6px 8px; border-bottom: 1px solid #333; }
  .company { font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px; }
  .addr { font-size: 9px; color: #333; margin-top: 2px; }
  .title { font-size: 12px; font-weight: 700; margin-top: 5px; text-transform: uppercase; letter-spacing: 1px; }
  .sub { font-size: 8px; font-style: italic; color: #555; margin-top: 1px; }
  table { width: 100%; border-collapse: collapse; }
  td, th { border: 1px solid #333; padding: 3px 5px; vertical-align: top; }
  .lbl { font-size: 8px; color: #555; font-style: italic; }
  .val { font-size: 10px; font-weight: 600; white-space: pre-wrap; }
  thead th { background: #f0f0f0; font-size: 9px; text-transform: uppercase; letter-spacing: 0.2px; }
  .mid { text-align: center; }
  .items td { font-size: 9px; }
  .words { font-size: 9px; font-style: italic; }
  .sign { height: 58px; vertical-align: bottom; font-size: 9px; text-align: center; }
  .sign .who { font-weight: 700; }
  .sign .when { font-size: 8px; color: #555; }
  .foot { font-size: 8px; color: #555; padding: 4px 6px; text-align: center; }
  tr, td, th { page-break-inside: avoid; }
  thead { display: table-header-group; }
`;

const day = (v) => (v ? dayjs(v).format('DD-MM-YYYY') : '-');
const stamp = (v) => (v ? dayjs(v).format('DD-MM-YYYY HH:mm') : '-');
const EM_DASH = '&mdash;';

const cell = (label, value, colspan = 1) => `
  <td colspan="${colspan}">
    <div class="lbl">${esc(label)}</div>
    <div class="val">${esc(value) || EM_DASH}</div>
  </td>`;

/** The reason, with the typed note when there is one - "Other" alone says nothing. */
const reasonOf = (t) => [t.reasonLabel, t.reasonText].filter(Boolean).join(' - ');

const itemRows = (items, received) => items.map((item, i) => `
  <tr>
    <td class="mid">${i + 1}</td>
    <td><strong>${esc(item.assetCode)}</strong></td>
    <td>${esc(item.assetName)}</td>
    <td>${esc(item.brand) || EM_DASH}</td>
    <td>${esc(item.model) || EM_DASH}</td>
    <td>${esc(item.serialNo) || EM_DASH}</td>
    <td>${esc(item.fromLocationText) || EM_DASH}</td>
    <td class="mid">${esc(conditionMeta(item.conditionSent).label)}</td>
    ${received ? `<td class="mid">${item.conditionReceived
    ? esc(conditionMeta(item.conditionReceived).label) : EM_DASH}</td>` : ''}
    <td>${esc(item.remarks) || ''}</td>
  </tr>`).join('');

const challanHtml = (transfer, org) => {
  const items = transfer.items ?? [];
  // Once a receipt has happened the challan is the signed record of it, so the
  // condition the receiving unit recorded prints beside the one that was sent.
  const received = items.some((i) => i.conditionReceived);
  const cols = received ? 10 : 9;
  const companyAddress = [org?.addressLine1, org?.addressLine2, org?.city, org?.state, org?.pincode]
    .filter(Boolean).join(', ');
  const companyName = org?.organisationName || 'Company';

  return `
  <div class="doc">
    <div class="head">
      <div class="company">${esc(companyName)}</div>
      ${companyAddress ? `<div class="addr">${esc(companyAddress)}</div>` : ''}
      <div class="title">Delivery Challan ${EM_DASH} Asset Movement</div>
      <div class="sub">Asset movement only ${EM_DASH} not a tax invoice. No sale or supply is involved.</div>
    </div>

    <table>
      <tr>
        ${cell('Challan No.', transfer.challanNo)}
        ${cell('Challan Date', stamp(transfer.challanGeneratedAt))}
        ${cell('Transfer Request No.', transfer.transferNo)}
        ${cell('Planned Movement Date', day(transfer.plannedDate))}
      </tr>
      <tr>
        ${cell('From (Unit)', [transfer.fromUnitName, transfer.fromUnitAddress].filter(Boolean).join('\n'), 2)}
        ${cell('To (Unit)', [transfer.toUnitName, transfer.toUnitAddress].filter(Boolean).join('\n'), 2)}
      </tr>
      <tr>
        ${cell('To (Full Location)', transfer.toLocationText, 2)}
        ${cell('Receiving Custodian', transfer.toCustodianName)}
        ${cell('Movement', transfer.interUnit ? 'Between units' : 'Within the same unit')}
      </tr>
      <tr>
        ${cell('Reason for Movement', reasonOf(transfer), 2)}
        ${cell('Vehicle No.', transfer.vehicleNo)}
        ${cell('Dispatched On', stamp(transfer.dispatchedAt))}
      </tr>
    </table>

    <table class="items">
      <thead>
        <tr>
          <th style="width:22px">#</th>
          <th style="width:95px">Asset ID</th>
          <th>Asset Name</th>
          <th style="width:60px">Brand</th>
          <th style="width:65px">Model</th>
          <th style="width:70px">Serial No.</th>
          <th style="width:110px">Sent From</th>
          <th style="width:52px">Condition<br/>Sent</th>
          ${received ? '<th style="width:52px">Condition<br/>Received</th>' : ''}
          <th style="width:85px">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows(items, received)}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="${cols - 1}">
            <strong>Total assets: ${items.length}</strong>
            <span class="words">(${esc(numberToWords(items.length))} ONLY)</span>
          </td>
          <td class="mid"><strong>${items.length}</strong></td>
        </tr>
      </tfoot>
    </table>

    ${transfer.remarks ? `<table><tr>${cell('Remarks', transfer.remarks, cols)}</tr></table>` : ''}

    <table>
      <tr>
        <td class="sign">
          <div class="when">Dispatched ${esc(stamp(transfer.dispatchedAt))}</div>
          <div class="who">Sent By</div>
        </td>
        <td class="sign">
          <div class="when">Approved ${esc(stamp(transfer.approvedAt))}</div>
          <div class="who">Approved By</div>
        </td>
        <td class="sign">
          <div class="when">${transfer.receivedAt ? `Received ${esc(stamp(transfer.receivedAt))}` : 'Date:'}</div>
          <div class="who">Received By</div>
        </td>
        <td class="sign">
          <div class="when">&nbsp;</div>
          <div class="who">Security / Gate</div>
        </td>
      </tr>
    </table>

    <div class="foot">
      Computer-generated challan for the internal movement of company assets between its own premises.
      The assets listed remain the property of ${esc(companyName)} throughout.
    </div>
  </div>`;
};

/**
 * Prints the challan. Returns false when the pop-up was blocked, so the caller
 * can say so rather than appearing to do nothing.
 */
export const printAssetChallan = (transfer, org) => {
  if (!transfer?.challanNo) return false;
  return openPrintWindow(documentShell({
    title: `Challan_${String(transfer.challanNo).replace(/[^\w-]+/g, '-')}`,
    bodyCss: CSS,
    // A challan for a movement that never completed must not read as a clean
    // original - the band says which.
    watermark: transfer.status === 'CANCELLED' ? 'CANCELLED'
      : (transfer.status === 'REJECTED' ? 'REJECTED' : undefined),
    body: challanHtml(transfer, org),
  }));
};
