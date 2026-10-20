/**
 * Demo stand-ins for the Stage 2 source endpoints (`/inventory/bill-passing/job-work/sources/...`): which vendors
 * and POs a new bill can be raised for, and the filter options of the list.
 */
import { BILLABLE_PO_STATUSES } from '../../../utils/jobWorkBillConstants';
import { loadJwbDb } from './jwbDemoStore';
import { poValueOf } from './jwbMockSnapshot';

const isLive = (b) => b.status !== 'REJECTED';

/** A PO a new bill may be raised for: its source, final (D3), something came back, and no live bill on it. */
export const isBillablePo = (db, p, source) => p.source === source
  && BILLABLE_PO_STATUSES.includes(p.status)
  && p.dcs.length > 0
  && !db.bills.some((b) => b.poId === p.id && isLive(b));

export const liveBillOn = (db, poId) => db.bills.find((b) => b.poId === poId && isLive(b));

/** Vendors with at least one PO ready to bill under `source`. */
export const mockBillableVendors = (source) => {
  const db = loadJwbDb();
  return db.vendors
    .map((v) => ({
      id: v.id, name: v.name, gstin: v.gstin, city: v.city,
      billablePoCount: db.pos.filter((p) => p.vendorId === v.id && isBillablePo(db, p, source)).length,
    }))
    .filter((v) => v.billablePoCount > 0);
};

export const mockBillablePos = ({ source, vendorId }) => {
  const db = loadJwbDb();
  const vendor = db.vendors.find((v) => v.id === vendorId);
  if (!vendor) return [];
  return db.pos
    .filter((p) => p.vendorId === vendorId && isBillablePo(db, p, source))
    .map((p) => ({
      id: p.id, poNumber: p.poNumber, processName: p.processName, status: p.status, dcCount: p.dcs.length,
      uncheckedDcCount: p.dcs.filter((dc) => !dc.check).length, poValue: poValueOf(p, vendor),
    }));
};

/** The list's party / PO filter options: whatever the demo bills of these sources carry. */
export const mockBillFilterOptions = (sources) => {
  const bills = loadJwbDb().bills.filter((b) => sources.includes(b.source));
  const uniq = (rows) => [...new Map(rows.map((r) => [r.id, r])).values()];
  return {
    parties: uniq(bills.map((b) => ({ id: b.vendorId, name: b.vendorName }))),
    pos: uniq(bills.map((b) => ({ id: b.poId, poNumber: b.poNumber, partyId: b.vendorId }))),
  };
};
