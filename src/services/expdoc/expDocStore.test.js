// Node-only: the export document store against a stubbed API — load, the one-batch save,
// versions, numbering and the reload on a refusal; and the packing lists, which are the API's
// own records now (expDocPlMirror), never loaded or saved as documents.
//   npx vitest run src/services/expdoc/expDocStore.test.js
import {
  describe, test, expect, vi, beforeEach,
} from 'vitest';

const api = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set() }));
const plMirror = vi.hoisted(() => ({ lists: [] }));

vi.mock('./expDocDocumentApi.js', () => ({
  DOCUMENT_KIND: {
    INVOICE: 'INVOICE', STICKER_RUN: 'STICKER_RUN', AUDIT: 'AUDIT', SETTINGS: 'SETTINGS',
  },
  listDocuments: (...a) => api.list(...a),
  saveDocuments: (...a) => api.save(...a),
}));
vi.mock('./expDocShipmentMirror.js', () => ({ mirroredShipments: () => [] }));
vi.mock('./expDocPackingMirror.js', () => ({ mirroredPackingEntries: () => [] }));
vi.mock('./expDocPlMirror.js', () => ({ mirroredPackingLists: () => plMirror.lists.map((pl) => ({ ...pl })) }));
vi.mock('../../utils/permissions.js', () => ({
  hasPermission: (key, op) => perms.granted.has(`${key}:${op}`),
}));

const {
  loadDb, saveDb, syncDocuments, runWrite, clearDocuments, newDocId, countStickerRuns,
} = await import('./expDocStore.js');

const inv = (id, invoiceNo, version, extra = {}) => ({
  key: String(id),
  kind: 'INVOICE',
  version,
  body: { id, invoiceNo, revision: 0, status: 'DRAFT', shipmentId: 7, version: 99, ...extra },
});
const run = (id, runNo, plId) => ({ key: String(id), kind: 'STICKER_RUN', version: 0, body: { id, runNo, plId } });
const settings = { key: 'settings', kind: 'SETTINGS', version: 0, body: { hsCodes: [{ code: '6109' }] } };
/** A packing list the web app once saved as a document: archived on the server, read-only. */
const archivedPl = { key: '9', kind: 'PACKING_LIST', version: 2, body: { id: 9, plNo: 'PKL/26-27/1009', status: 'DRAFT' } };

/** The API echoes what it is sent, a version on. */
const echo = ({ upserts }) => Promise.resolve(upserts.map((u) => ({
  key: u.key, kind: u.kind, version: u.version == null ? 0 : u.version + 1, body: u.body,
})));

beforeEach(() => {
  clearDocuments();
  api.list.mockReset();
  api.save.mockReset();
  perms.granted = new Set(['export-packing-list:view', 'export-invoice:view']);
  plMirror.lists = [];
});

describe('loading', () => {
  test('a record reads at the server version and the series continue from the numbers present', async () => {
    api.list.mockResolvedValue([
      inv(1, 'EXP/26-27/1002-R1', 3),
      run(2, 'STK/26-27/1004', 5),
      // A number lives on in the audit trail and is not issued again
      { key: 'a1', kind: 'AUDIT', version: 0, body: { id: 'a1', entityNo: 'STK/26-27/1009' } },
      settings,
    ]);
    await syncDocuments();

    const db = loadDb();
    expect(db.invoices[0].version).toBe(3);
    expect(db.docSeq).toEqual({ 'EXP/26-27': 1002, 'STK/26-27': 1009 });
    expect(db.masters.hsCodes).toEqual([{ code: '6109' }]);
  });

  test('asks only for the kinds it keeps: never the archived packing lists', async () => {
    api.list.mockResolvedValue([settings]);
    await syncDocuments();
    expect(api.list.mock.calls[0][0]).toEqual(['INVOICE', 'STICKER_RUN', 'AUDIT', 'SETTINGS']);
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

  test('counts the sticker runs printed from a packing list', async () => {
    api.list.mockResolvedValue([run(2, 'STK/26-27/1004', 5), run(3, 'STK/26-27/1005', 5), run(4, 'STK/26-27/1006', 6), settings]);
    await syncDocuments();
    expect(countStickerRuns(5)).toBe(2);
    expect(countStickerRuns('6')).toBe(1);
    expect(countStickerRuns(7)).toBe(0);
  });
});

describe('the packing lists', () => {
  test('are the mirror of the API\'s, laid over every load', async () => {
    plMirror.lists = [{ id: 41, plNo: 'PKL/26-27/1041', status: 'FINAL', version: 3 }];
    api.list.mockResolvedValue([settings]);
    await syncDocuments();
    expect(loadDb().packingLists).toEqual([{ id: 41, plNo: 'PKL/26-27/1041', status: 'FINAL', version: 3 }]);
  });

  test('an archived packing list the API still returns is never tracked, so never deleted', async () => {
    api.list.mockResolvedValue([archivedPl, inv(1, null, 4), settings]);
    api.save.mockImplementation(echo);
    await runWrite(async () => {
      const db = loadDb();
      db.invoices[0].status = 'FINAL';
      saveDb(db);
    });
    const [{ upserts, deletes }] = api.save.mock.calls[0];
    expect(upserts.map((u) => u.key)).toEqual(['1']);
    expect(deletes).toEqual([]);
  });

  test('a module that changes them saves nothing of them: the mirror is the API\'s, never written here', async () => {
    plMirror.lists = [{ id: 41, plNo: 'PKL/26-27/1041', status: 'DRAFT', version: 3 }];
    api.list.mockResolvedValue([inv(1, null, 4), settings]);
    api.save.mockImplementation(echo);
    await runWrite(async () => {
      const db = loadDb();
      db.packingLists[0].status = 'FINAL';
      db.packingLists.push({ id: 42, plNo: 'PKL/26-27/1042' });
      saveDb(db);
    });
    expect(api.save).not.toHaveBeenCalled();
    expect(loadDb().packingLists).toEqual([{ id: 41, plNo: 'PKL/26-27/1041', status: 'DRAFT', version: 3 }]);
  });
});

describe('a document action', () => {
  beforeEach(() => {
    api.list.mockResolvedValue([inv(1, 'EXP/26-27/1001', 4), inv(2, null, 0), settings]);
    api.save.mockImplementation(echo);
  });

  test('reloads first, then saves what changed as one batch with the versions it loaded', async () => {
    const result = await runWrite(async () => {
      const db = loadDb();
      const changed = db.invoices.find((i) => i.id === 1);
      changed.status = 'FINAL';
      changed.version += 1;
      db.invoices = db.invoices.filter((i) => i.id !== 2);
      const id = newDocId();
      db.invoices.push({ id, invoiceNo: null, status: 'DRAFT', version: 0 });
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
    expect(loadDb().invoices.find((i) => i.id === 1).version).toBe(5);
  });

  test('a document whose body lacks its own key is left alone, never deleted', async () => {
    api.list.mockResolvedValue([inv(1, 'EXP/26-27/1001', 4), { key: 'stray', kind: 'AUDIT', version: 0, body: { x: 1 } }, settings]);
    await runWrite(async () => {
      const db = loadDb();
      db.invoices[0].status = 'FINAL';
      saveDb(db);
    });
    const [{ upserts, deletes }] = api.save.mock.calls[0];
    expect(upserts.map((u) => u.key)).toEqual(['1']);
    expect(deletes).toEqual([]);
  });

  test('nothing changed: nothing is sent', async () => {
    await runWrite(async () => loadDb().invoices[0]);
    expect(api.save).not.toHaveBeenCalled();
  });

  test('a refusal reloads before the error reaches the screen, so nothing half-done stays', async () => {
    const conflict = Object.assign(new Error('EXP/26-27/1001 was just taken'), { code: 'CONFLICT' });
    api.save.mockRejectedValueOnce(conflict);
    await expect(runWrite(async () => {
      const db = loadDb();
      db.invoices[0].remarks = 'mine';
      saveDb(db);
    })).rejects.toBe(conflict);

    expect(api.list).toHaveBeenCalledTimes(2);
    expect(loadDb().invoices[0].remarks).toBeUndefined();
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
