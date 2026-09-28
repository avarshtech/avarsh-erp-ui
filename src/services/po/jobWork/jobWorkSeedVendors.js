/**
 * The job workers the demo POs are raised on (UI mock phase).
 *
 * Suppliers are real API data, so the seeded POs carry only a vendor snapshot and find
 * the live supplier by GSTIN when they are read. These rows are that contract: the e2e
 * helper (e2e/helpers/job-work-seed.js) creates exactly these suppliers, and anyone can
 * key them in through Master Data › Suppliers for a manual walkthrough.
 *
 * `approvedDays` is the approval's validity from today: null = not approved, negative =
 * expired. `processes` are 'Category|Process name' pairs from the process master seeds.
 * Dependency-free on purpose — Node imports it for the e2e helper.
 */
export const SEED_JOB_WORKERS = [
  {
    key: 'murugan', name: 'Sri Murugan Prints', gstin: '33AAFCS1234K1Z2', igstApplicable: false,
    address: '14 Kumaran Road', city: 'Tiruppur', state: 'Tamil Nadu', pincode: '641604',
    contactPerson: 'S Murugan', phone: '9443012345', email: 'orders@srimuruganprints.in',
    paymentTerms: 'Open Account 30 Days', approvedDays: 365, active: true,
    processes: ['Cut Panel|Panel Printing', 'Cut Panel|Foil Printing', 'Cut Panel|Flock Printing'],
  },
  {
    key: 'classic', name: 'Classic Embroidery Works', gstin: '33AAKFC5678L1Z9', igstApplicable: false,
    address: '7 Avinashi Road', city: 'Tiruppur', state: 'Tamil Nadu', pincode: '641603',
    contactPerson: 'R Karthika', phone: '9442211334', email: 'jobs@classicembroidery.in',
    paymentTerms: 'Open Account 60 Days', approvedDays: 200, active: true,
    processes: ['Cut Panel|Panel Embroidery', 'Cut Panel|Applique', 'Cut Panel|Embellishment'],
  },
  {
    key: 'bluewave', name: 'Bluewave Garment Washers', gstin: '29AABCB4321M1Z3', igstApplicable: true,
    address: '52 Peenya Industrial Area', city: 'Bengaluru', state: 'Karnataka', pincode: '560058',
    contactPerson: 'Anil Kumar', phone: '9845012345', email: 'wash@bluewave.in',
    paymentTerms: 'Open Account 30 Days', approvedDays: 300, active: true,
    processes: ['Garment|Enzyme Washing', 'Garment|Garment Washing', 'Garment|Softener Washing',
      'Garment|Bleach Washing', 'Garment|Stone Washing', 'Cut Panel|Panel Washing'],
  },
  {
    key: 'colourtex', name: 'Colourtex Dye House', gstin: '33AAICC1357E1Z8', igstApplicable: false,
    address: '3 Karaipudur Main Road', city: 'Tiruppur', state: 'Tamil Nadu', pincode: '641605',
    contactPerson: 'P Selvam', phone: '9443355667', email: 'dye@colourtex.in',
    paymentTerms: 'Open Account 30 Days', approvedDays: 180, active: true,
    processes: ['Garment|Garment Dyeing', 'Garment|Pigment Dyeing', 'Garment|Over Dyeing', 'Garment|Special Finish'],
  },
  {
    key: 'star', name: 'Star Heat Transfers', gstin: '33AAGCS8765H1Z4', igstApplicable: false,
    address: '21 College Road', city: 'Tiruppur', state: 'Tamil Nadu', pincode: '641602',
    contactPerson: 'M Raja', phone: '9443377889', email: 'star@heattransfers.in',
    paymentTerms: 'Open Account 30 Days', approvedDays: -20, active: true,
    processes: ['Cut Panel|Heat Transfer', 'Cut Panel|Panel Printing'],
  },
  {
    key: 'nova', name: 'Nova Prints', gstin: '33AAJFN9753P1Z1', igstApplicable: false,
    address: '9 Palladam Road', city: 'Tiruppur', state: 'Tamil Nadu', pincode: '641604',
    contactPerson: 'V Nandhini', phone: '9443399001', email: 'hello@novaprints.in',
    paymentTerms: 'Open Account 30 Days', approvedDays: null, active: true,
    processes: ['Cut Panel|Panel Printing', 'Cut Panel|Heat Transfer'],
  },
  {
    key: 'oldtown', name: 'Old Town Dyers', gstin: '33AAHFO2468D1Z6', igstApplicable: false,
    address: '2 Mill Street', city: 'Erode', state: 'Tamil Nadu', pincode: '638001',
    contactPerson: 'K Sundar', phone: '9443300112', email: 'oldtown@dyers.in',
    paymentTerms: 'Open Account 30 Days', approvedDays: 90, active: false,
    processes: ['Garment|Garment Dyeing', 'Garment|Enzyme Washing'],
  },
];

/** 'YYYY-MM-DD', `offset` days from today. */
export const seedDay = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * The snapshot a seeded PO carries for one of these job workers — the same shape the PO
 * screens take from a live supplier, so eligibility can be re-checked on it. Process ids
 * are unknown here (they are the live master's); a seeded PO's process has none either,
 * so the capability check is skipped for it.
 */
export const seedVendorSnapshot = (key) => {
  const v = SEED_JOB_WORKERS.find((w) => w.key === key);
  return {
    id: null, name: v.name, gstin: v.gstin, stateCode: v.gstin.slice(0, 2), igstApplicable: v.igstApplicable,
    address: v.address, city: v.city, state: v.state, pincode: v.pincode,
    contactPerson: v.contactPerson, phone: v.phone, email: v.email, paymentTerms: v.paymentTerms,
    jobWorker: true, active: v.active, processIds: [],
    jobWorkApprovedUntil: v.approvedDays == null ? null : seedDay(v.approvedDays),
  };
};
