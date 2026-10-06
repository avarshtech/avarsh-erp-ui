import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { cppContext } from '../../../services/po/cutPanelPo/cutPanelPoService';
import { vendorEligibility } from '../../../utils/vendorEligibility';
import { liveVendorOf } from '../../../utils/jobWorkPoLines';

/**
 * What the Cut Panel PO checks need beyond the PO itself — requirement state (VR-03/20),
 * order dates (VR-08), last rates (VR-12), duplicates (VR-14) — refetched only when what
 * it depends on changes, and after every save or workflow step (the version moves), since
 * those move the ledger. Vendor eligibility (VR-13) comes from the LIVE vendor (matched by id,
 * then by GSTIN for a seeded snapshot without one), else from the PO's snapshot.
 */
const useCppContext = (doc, jobWorkers) => {
  const docRef = useRef(doc);
  useEffect(() => { docRef.current = doc; });
  const key = doc?.process ? JSON.stringify([
    doc.id, doc.version, doc.status, doc.pendingRevision?.status, doc.vendor?.gstin, doc.process.label ?? doc.process.name, doc.poDate,
    [...new Set(doc.lines.map((l) => l.cprId))].sort(), doc.lines.length,
  ]) : null;
  const [result, setResult] = useState({ key: null, ctx: null });

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    cppContext(docRef.current).then((ctx) => { if (alive) setResult({ key, ctx }); }).catch(() => {});
    return () => { alive = false; };
  }, [key]);

  const liveVendor = useMemo(() => liveVendorOf(jobWorkers, doc?.vendor), [jobWorkers, doc?.vendor]);
  const process = doc?.process;
  return useMemo(() => {
    const ctx = result.key === key ? result.ctx : null;
    if (!ctx) return null;
    const eligibility = liveVendor
      ? vendorEligibility(liveVendor, {
        processId: process?.id ?? null, processLabel: process?.label ?? process?.name, category: 'Cut Panel', onDate: dayjs(),
      })
      : ctx.eligibility;
    return { ...ctx, eligibility, liveVendor };
  }, [result, key, liveVendor, process]);
};

export default useCppContext;
