/**
 * Lookups both job-work PO types share (mock): the vendor's last rates and duplicate-PO
 * detection. Read-only over the PO store.
 */
import { loadJobWorkDb } from './jobWorkMockStore';
import { JW_PO_STATUS as S, allocatingStatuses } from '../../../utils/jobWorkPoStatus';

const issued = (doc) => allocatingStatuses(doc.type).includes(doc.status) && doc.status !== S.SUBMITTED;
const byNewest = (a, b) => String(b.approvedOn || b.poDate).localeCompare(String(a.approvedOn || a.poDate));

/**
 * The vendor's last rates for a process (CPP FR-14 / §20, GPO §14): per style × size
 * (CPP) or per UOM (GPO) from its latest approved PO, and its last three rates overall.
 * Vendors are matched by GSTIN, as seeded POs carry no live vendor id.
 */
export const lastRates = async ({ type, gstin, processLabel }) => {
  const docs = loadJobWorkDb().docs
    .filter((d) => d.type === type && issued(d) && d.vendor?.gstin === gstin && (d.lines[0]?.processLabel ?? d.process?.name) === processLabel)
    .sort(byNewest);
  const byKey = {};
  const recent = [];
  docs.forEach((d) => d.lines.forEach((l) => {
    if (l.rate == null) return;
    const key = type === 'CPP' ? `${l.styleNo}|${l.size}` : l.uom;
    if (byKey[key] === undefined) byKey[key] = Number(l.rate);
  }));
  docs.slice(0, 3).forEach((d) => recent.push({
    poNo: d.poNo, date: d.approvedOn || d.poDate, rate: d.lines.find((l) => l.rate != null)?.rate ?? null,
  }));
  return { byKey, recent };
};

/**
 * Another live PO to the same vendor, for the same process and requirement, dated the
 * same day (CPP BR-21 / VR-14): warns with its number; proceeding needs a reason.
 */
export const duplicatePos = async ({ type, gstin, processLabel, reqIds, poDate, exceptId }) => {
  const reqKey = type === 'CPP' ? 'cprId' : 'gprId';
  const wanted = new Set(reqIds);
  return loadJobWorkDb().docs
    .filter((d) => d.type === type && d.id !== exceptId && ![S.CANCELLED, S.REJECTED].includes(d.status)
      && d.vendor?.gstin === gstin && d.poDate === poDate
      && d.lines.some((l) => l.processLabel === processLabel && wanted.has(l[reqKey])))
    .map((d) => d.poNo);
};
