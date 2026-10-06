import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { gpoContext } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import { vendorEligibility } from '../../../utils/vendorEligibility';
import { liveVendorOf } from '../../../utils/jobWorkPoLines';

/**
 * What the Garment Process PO checks and cards need beyond the PO — requirement state
 * (V12, V15), order dates, the vendor's last rates (§14) — refetched when what it depends
 * on changes and after every save or workflow step (the version moves). Vendor
 * eligibility comes from the LIVE vendor (matched by id, then GSTIN), else from
 * the PO's snapshot.
 */
const useGpoContext = (doc, jobWorkers) => {
  const docRef = useRef(doc);
  useEffect(() => { docRef.current = doc; });
  const key = doc ? JSON.stringify([
    doc.id, doc.version, doc.status, doc.vendor?.gstin, doc.lines[0]?.processLabel ?? null,
    [...new Set(doc.lines.map((l) => l.gprId))].sort(), doc.lines.length,
  ]) : null;
  const [result, setResult] = useState({ key: null, ctx: null });

  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    gpoContext(docRef.current).then((ctx) => { if (alive) setResult({ key, ctx }); }).catch(() => {});
    return () => { alive = false; };
  }, [key]);

  const liveVendor = useMemo(() => liveVendorOf(jobWorkers, doc?.vendor), [jobWorkers, doc?.vendor]);
  const processId = doc?.process?.id ?? null;
  const processLabel = doc?.lines[0]?.processLabel ?? doc?.process?.label;
  return useMemo(() => {
    const ctx = result.key === key ? result.ctx : null;
    if (!ctx) return null;
    const eligibility = liveVendor
      ? vendorEligibility(liveVendor, { processId, processLabel, category: 'Garment', onDate: dayjs() })
      : ctx.eligibility;
    return { ...ctx, eligibility, liveVendor };
  }, [result, key, liveVendor, processId, processLabel]);
};

export default useGpoContext;
