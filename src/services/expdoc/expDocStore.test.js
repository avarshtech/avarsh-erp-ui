// Node-only: the export document store against a stubbed API — load, the one-batch save,
// versions, numbering and the reload on a refusal.
//   npx vitest run src/services/expdoc/expDocStore.test.js
import {
  describe, test, expect, vi, beforeEach,
} from 'vitest';

const api = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set() }));

vi.mock('./expDocDocumentApi.js', () => ({
  DOCUMENT_KIND: {
    PACKING_LIST: 'PACKING_LIST', INVOICE: 'INVOICE', STICKER_RUN: 'STICKER_RUN', AUDIT: 'AUDIT', SETTINGS: 'SETTINGS',
  },
  listDocuments: (...a) => api.list(...a),
  saveDocuments: (...a) => api.save(...a),
}));
vi.mock('./expDocShipmentMirror.js', () => ({ mirroredShipments: () => [] }));
vi.mock('./expDocPackingMirror.js', () => ({ mirroredPackingEntries: () => [] }));
vi.mock('../../utils/permissions.js', () => ({
  hasPermission: (key, op) => perms.granted.has(`${key}:${op}`),
}));

const {
  loadDb, saveDb, syncDocuments, runWrite, clearDocuments, newDocId,
} = await import('./expDocStore.js');

const pl = (id, plNo, version, extra = {}) => ({
  key: String(id), kind: 'PACKING_LIST', version, body: { id, plNo, revision: 0, status: 'DRAFT', shipmentId: 7, version: 99, ...extra },
});
const settings = { key: 'settings', kind: 'SETTINGS', version: 0, body: { hsCodes: [{ code: '6109' }] } };

/** The API echoes what it is sent, a version on. */
const echo = ({ upserts }) => Promise.resolve(upserts.map((u) => ({
  key: u.key, kind: u.kind, version: u.version == null ? 0 : u.version + 1, body: u.body,
})));

beforeEach(() => {
  clearDocuments();
  api.list.mockReset();
  api.save.mockReset();
  perms.granted = new Set(['export-packing-list:view', 'export-invoice:view']);
});

describe('loading', () => {
  test('a record reads at the server version and the series continue from the numbers present', async () => {
    api.list.mockResolvedValue([
      pl(1, 'PKL/26-27/1004', 3),
      { key: '2', kind: 'INVOICE', version: 1, body: { id: 2, invoiceNo: 'EXP/26-27/1002-R1', version: 0 } },
      // A deleted draft's number lives on in the audit trail and is not issued again
      { key: 'a1', kind: 'AUDIT', version: 0, body: { id: 'a1', entityNo: 'PKL/26-27/1009' } },
      settings,
    ]);
    await syncDocuments();

    const db = loadDb();
    expect(db.packingLists[0].version).toBe(3);
    expect(db.docSeq).toEqual({ 'PKL/26-27': 1009, 'EXP/26-27': 1002 });
    expect(db.masters.hsCodes).toEqual([{ code: '6109' }]);
  });

  test('fresh for 30 s; forced, it reloads', async () => {
    api.list.mockResolvedValue([settings]);
    await syncDocuments();
    await syncDocuments();
    expect(api.list).toHaveBeenCalledTimes(1);
    await syncDocuments({ force: true });
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  test('someone who can read no document never asks', async () => {
    perms.granted = new Set(['export-templates:view']);
    await syncDocuments({ force: true });
    expect(api.list).not.toHaveBeenCalled();
    expect(loadDb().masters.hsCodes.length).toBeGreaterThan(0);
  });

  test('no masters on the API: the first user who may write them saves the seed, without the demo statutory references', async () => {
    api.list.mockResolvedValue([]);
    api.save.mockImplementation(echo);
    perms.granted.add('export-invoice:update');
    await syncDocuments();

    const [{ upserts }] = api.save.mock.calls[0];
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ key: 'settings', kind: 'SETTINGS', version: null });
    expect(upserts[0].body.exporterProfileExtra).not.toHaveProperty('iecNumber');
    expect(upserts[0].body.exporterProfileExtra.declarations.length).toBeGreaterThan(0);
  });

  test('anyone else reads the seed from memory and never writes it', async () => {
    api.list.mockResolvedValue([]);
    await syncDocuments();
    expect(api.save).not.toHaveBeenCalled();
    expect(loadDb().masters.hsCodes.length).toBeGreaterThan(0);
  });
});

describe('a document action', () => {
  beforeEach(() => {
    api.list.mockResolvedValue([pl(1, 'PKL/26-27/1001', 4), pl(2, 'PKL/26-27/1002', 0), settings]);
    api.save.mockImplementation(echo);
  });

  test('reloads first, then saves what changed as one batch with the versions it loaded', async () => {
    const result = await runWrite(async () => {
      const db = loadDb();
      const changed = db.packingLists.find((p) => p.id === 1);
      changed.status = 'FINAL';
      changed.version += 1;
      db.packingLists = db.packingLists.filter((p) => p.id !== 2);
      const id = newDocId();
      db.packingLists.push({ id, plNo: 'PKL/26-27/1003', status: 'DRAFT', version: 0 });
      saveDb(db);
      return { ...changed };
    });

    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.save).toHaveBeenCalledTimes(1);
    const [{ upserts, deletes }] = api.save.mock.calls[0];
    expect(upserts.map((u) => [u.key, u.version])).toEqual([['1', 4], [expect.any(String), null]]);
    expect(deletes).toEqual([{ key: '2', version: 0 }]);
    // The screen's copy carries the saved version for its next save
    expect(result.version).toBe(5);
    expect(loadDb().packingLists.find((p) => p.id === 1).version).toBe(5);
  });

  test('a document whose body lacks its own key is left alone, never deleted', async () => {
    api.list.mockResolvedValue([pl(1, 'PKL/26-27/1001', 4), { key: 'stray', kind: 'AUDIT', version: 0, body: { x: 1 } }, settings]);
    await runWrite(async () => {
      const db = loadDb();
      db.packingLists[0].status = 'FINAL';
      saveDb(db);
    });
    const [{ upserts, deletes }] = api.save.mock.calls[0];
    expect(upserts.map((u) => u.key)).toEqual(['1']);
    expect(deletes).toEqual([]);
  });

  test('nothing changed: nothing is sent', async () => {
    await runWrite(async () => loadDb().packingLists[0]);
    expect(api.save).not.toHaveBeenCalled();
  });

  test('a refusal reloads before the error reaches the screen, so nothing half-done stays', async () => {
    const conflict = Object.assign(new Error('PKL/26-27/1001 was just taken'), { code: 'CONFLICT' });
    api.save.mockRejectedValueOnce(conflict);
    await expect(runWrite(async () => {
      const db = loadDb();
      db.packingLists[0].remarks = 'mine';
      saveDb(db);
    })).rejects.toBe(conflict);

    expect(api.list).toHaveBeenCalledTimes(2);
    expect(loadDb().packingLists[0].remarks).toBeUndefined();
  });

  test('two actions at once run one after the other', async () => {
    const order = [];
    const slow = runWrite(async () => { order.push('a-start'); await new Promise((r) => { setTimeout(r, 20); }); order.push('a-end'); });
    const fast = runWrite(async () => { order.push('b'); });
    await Promise.all([slow, fast]);
    expect(order).toEqual(['a-start', 'a-end', 'b']);
  });
});

describe('ids', () => {
  test('are numbers, unique and time-ordered', () => {
    const ids = Array.from({ length: 50 }, () => newDocId());
    expect(new Set(ids).size).toBe(50);
    expect([...ids].sort((a, b) => a - b)).toEqual(ids);
    expect(ids.every(Number.isSafeInteger)).toBe(true);
  });
});
