/**
 * The one Bill Passing list over both kinds of bill: supplier bills (API) and job-work vendor bills
 * (jobWorkBillService — the Stage 1 demo). Stage 2 replaces `listAllBills` with the API's union endpoint
 * (`GET /inventory/bill-passing/bills`), which returns these same rows.
 */
import { searchBills } from './billPassingService';
import { listJobWorkBills } from './jobWorkBill/jobWorkBillService';
import { BILL_SOURCE, isJobWorkSource } from '../../utils/jobWorkBillConstants';

const JOB_WORK = [BILL_SOURCE.CUT_PANEL_PO, BILL_SOURCE.GARMENT_PROCESS_PO];
const STAT_KEYS = ['pendingVerification', 'pendingApproval', 'onHoldOrQuery', 'passedThisMonth', 'totalDebitMtd', 'sentToAccountsMtd'];

/**
 * Filter values carry their side — `S:12` supplier side, `J:501` job-work side — because supplier and vendor
 * ids (and PO ids) overlap: a migrated vendor kept its supplier id.
 */
export const typedValue = (side, id) => `${side}:${id}`;
export const untype = (value) => {
  if (!value) return [null, undefined];
  const [side, id] = String(value).split(':');
  return [side, Number(id)];
};

export const supplierRowToUnion = (r) => ({
  key: `${BILL_SOURCE.SUPPLIER_PO}:${r.id}`, source: BILL_SOURCE.SUPPLIER_PO, id: r.id, number: r.bpNumber,
  partyType: 'SUPPLIER', partyId: r.supplierId, partyName: r.supplierName,
  poId: r.poId, poNumber: r.poNumber, invoiceNo: r.supplierInvoiceNo, invoiceDate: r.invoiceDate,
  challanNumbers: r.challanNumbers, summary: r.materialSummary,
  poValue: r.valueSummary?.poValue, receivedValue: r.valueSummary?.grnValue,
  invoiceValue: r.valueSummary?.invoiceValue ?? r.invoiceBasicAmount,
  debitTotal: r.debitTotal, netPayable: r.netPayable, blockerCount: r.blockerCount,
  tallyReferenceNo: r.tallyReferenceNo, status: r.status, version: r.version,
});

const sumStats = (a, b) => {
  if (!a || !b) return a || b || null;
  return Object.fromEntries(STAT_KEYS.map((k) => [k, Math.round(((a[k] || 0) + (b[k] || 0)) * 100) / 100]));
};

/**
 * One page of bills for `source` (ALL or one BILL_SOURCE). Job-work rows come after every supplier row, so the
 * server's page is the head of the page unchanged and only the tail is cut from the job-work rows. The KPI
 * block always counts every bill of the chosen source(s), whatever the filters, as the API's does.
 */
export const listAllBills = async ({ source, party, po, page, size, ...filters }) => {
  const [partySide, partyId] = untype(party);
  const [poSide, poId] = untype(po);
  const side = partySide || poSide;
  const jwSources = source === 'ALL' ? JOB_WORK : (isJobWorkSource(source) ? [source] : []);
  const withSupplier = source === 'ALL' || source === BILL_SOURCE.SUPPLIER_PO;

  const jw = jwSources.length
    ? await listJobWorkBills({
      sources: jwSources, partyId: partySide === 'J' ? partyId : undefined, poId: poSide === 'J' ? poId : undefined,
      ...filters, page: 0, size: 100000,
    })
    : null;
  const jwRows = side === 'S' ? [] : (jw?.content || []);

  let sup = null;
  if (withSupplier) {
    sup = side === 'J'
      ? await searchBills({ page: 0, size: 1 }) // only its KPI block: the filter excludes supplier rows
      : await searchBills({
        ...filters, supplierId: partySide === 'S' ? partyId : undefined, poId: poSide === 'S' ? poId : undefined, page, size,
      });
  }
  const supRows = withSupplier && side !== 'J' ? (sup.content || []).map(supplierRowToUnion) : [];
  const supTotal = withSupplier && side !== 'J' ? (sup.totalElements || 0) : 0;

  const start = page * size;
  const tail = jwRows.slice(Math.max(0, start - supTotal), Math.max(0, start + size - supTotal));
  return {
    content: [...supRows, ...tail],
    totalElements: supTotal + jwRows.length,
    stats: sumStats(sup?.stats, jw?.stats),
  };
};
