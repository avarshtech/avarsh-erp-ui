/**
 * Job workers for the Cut Panel PO / Garment Process PO specs (UI mock phase).
 *
 * The PO documents live in the localStorage mock, but their vendors are the real Vendor
 * master. This creates the job workers the seeded POs name
 * (./jobWorkSeedVendors.js), or puts them back into their seeded
 * state, matched by GSTIN: approval validity relative to today, processes, active flag.
 */
import { SEED_JOB_WORKERS, seedDay } from './jobWorkSeedVendors.js';
import { headOffice, ensureUnit } from './branch-seed.js';

/**
 * Units for the job-work POs' return unit (HR › Units), in the head office. The e2e seed has
 * only UNIT-1, with no type or address, so the delivery place would read "—".
 */
export const JOB_WORK_UNITS = {
  cut: {
    unitCode: 'E2E-JW-CUT', unitName: 'E2E Cutting Unit', unitType: 'CUTTING',
    address: '12 Mill Road', city: 'Tiruppur', state: 'Tamil Nadu', pincode: '641601',
  },
  fin: {
    unitCode: 'E2E-JW-FIN', unitName: 'E2E Finishing Unit', unitType: 'FINISHING',
    address: '4 Dye House Street', city: 'Tiruppur', state: 'Tamil Nadu', pincode: '641604',
  },
};

/** Creates the job-work units if missing (the H2 database is rebuilt on every boot); returns them keyed cut / fin. */
export async function ensureJobWorkUnits(api) {
  const office = await headOffice(api);
  const saved = {};
  for (const [key, unit] of Object.entries(JOB_WORK_UNITS)) saved[key] = await ensureUnit(api, office?.id, unit);
  return saved;
}

const payload = (w, processIds) => ({
  name: w.name, gstin: w.gstin, igstApplicable: w.igstApplicable, stateCode: w.gstin.slice(0, 2), pan: w.gstin.slice(2, 12),
  address: w.address, city: w.city, state: w.state, country: 'India', pincode: w.pincode,
  contactPerson: w.contactPerson, phone: w.phone, email: w.email, paymentTerms: w.paymentTerms,
  active: w.active, processIds, jobWorkApprovedUntil: w.approvedDays == null ? null : seedDay(w.approvedDays),
});

/** Returns the saved vendors keyed by SEED_JOB_WORKERS[].key. */
export async function ensureJobWorkers(api) {
  const processes = (await api.get('/processes')).data || [];
  const idOf = new Map(processes.map((p) => [`${p.category}|${p.processName}`, p.id]));
  const vendors = (await api.get('/vendors', { includeInactive: true })).data || [];
  const byGstin = new Map(vendors.map((v) => [v.gstin, v]));

  const saved = {};
  for (const w of SEED_JOB_WORKERS) {
    const missing = w.processes.filter((k) => !idOf.has(k));
    if (missing.length) throw new Error(`ensureJobWorkers: process master has no ${missing.join(', ')}`);
    const body = payload(w, w.processes.map((k) => idOf.get(k)));
    const current = byGstin.get(w.gstin);
    const res = current
      ? await api.put(`/vendors/${current.id}`, { ...current, ...body })
      : await api.post('/vendors', body);
    if (res.status >= 300) throw new Error(`ensureJobWorkers: ${w.name} → ${res.status} ${JSON.stringify(res.data)}`);
    saved[w.key] = res.data;
  }
  return saved;
}
