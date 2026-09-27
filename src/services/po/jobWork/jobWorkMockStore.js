/**
 * localStorage home of the job-work POs (UI mock phase): Cut Panel POs and Garment
 * Process POs, the allocation ledger and the audit trail share ONE key, so a document and
 * its ledger entries are always written together. It reseeds with the requirement stores
 * (DEMO_SEED_VERSION), because the ledger names their line keys.
 *
 *   { docs: [PO], ledger: [entry], audits: { [poId]: [row] }, issuedNos: [poNo],
 *     nextId, nextEntryId, seedVersion }
 */
import { loadMockStore, saveMockStore, DEMO_SEED_VERSION } from '../../bom/requirementMockStore';
import { buildJobWorkSeed } from './jobWorkMockSeed';

export const JOB_WORK_STORAGE_KEY = 'avarsh.po.jobWork.mockStore.v1';

export const loadJobWorkDb = () => loadMockStore(JOB_WORK_STORAGE_KEY, DEMO_SEED_VERSION, buildJobWorkSeed);

export const saveJobWorkDb = (db) => saveMockStore(JOB_WORK_STORAGE_KEY, db);
