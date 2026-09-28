/**
 * Job-work suppliers for the Cut Panel PO / Garment Process PO specs (UI mock phase).
 *
 * The PO documents live in the localStorage mock, but their vendors are the real Supplier
 * master. This creates the job workers the seeded POs name
 * (src/services/po/jobWork/jobWorkSeedVendors.js), or puts them back into their seeded
 * state, matched by GSTIN: approval validity relative to today, processes, active flag.
 */
import { SEED_JOB_WORKERS, seedDay } from '../../src/services/po/jobWork/jobWorkSeedVendors.js';

const payload = (w, processIds) => ({
  name: w.name, gstin: w.gstin, igstApplicable: w.igstApplicable, stateCode: w.gstin.slice(0, 2), pan: w.gstin.slice(2, 12),
  address: w.address, city: w.city, state: w.state, country: 'India', pincode: w.pincode,
  contactPerson: w.contactPerson, phone: w.phone, email: w.email, paymentTerms: w.paymentTerms,
  suppliesFabric: false, suppliesTrims: false, active: w.active,
  jobWorker: true, processIds, jobWorkApprovedUntil: w.approvedDays == null ? null : seedDay(w.approvedDays),
});

/** Returns the saved suppliers keyed by SEED_JOB_WORKERS[].key. */
export async function ensureJobWorkers(api) {
  const processes = (await api.get('/processes')).data || [];
  const idOf = new Map(processes.map((p) => [`${p.category}|${p.processName}`, p.id]));
  const suppliers = (await api.get('/suppliers', { includeInactive: true })).data || [];
  const byGstin = new Map(suppliers.map((s) => [s.gstin, s]));

  const saved = {};
  for (const w of SEED_JOB_WORKERS) {
    const missing = w.processes.filter((k) => !idOf.has(k));
    if (missing.length) throw new Error(`ensureJobWorkers: process master has no ${missing.join(', ')}`);
    const body = payload(w, w.processes.map((k) => idOf.get(k)));
    const current = byGstin.get(w.gstin);
    const res = current
      ? await api.put(`/suppliers/${current.id}`, { ...current, ...body })
      : await api.post('/suppliers', body);
    if (res.status >= 300) throw new Error(`ensureJobWorkers: ${w.name} → ${res.status} ${JSON.stringify(res.data)}`);
    saved[w.key] = res.data;
  }
  return saved;
}
