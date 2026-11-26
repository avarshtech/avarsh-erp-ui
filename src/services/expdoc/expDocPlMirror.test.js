// Node-only: the packing-list mirror against a stubbed API — what it holds and under which names,
// its 30 s freshness, a forced reload, a failed refresh, and an action's answer never lost to a
// refresh that was already in flight.
//   npx vitest run src/services/expdoc/expDocPlMirror.test.js
import {
  describe, test, expect, vi, beforeEach, afterEach,
} from 'vitest';

const api = vi.hoisted(() => ({ mirror: vi.fn() }));
const perms = vi.hoisted(() => ({ granted: new Set() }));

vi.mock('./packingListApi.js', () => ({ getApiPlMirror: (...a) => api.mirror(...a) }));
vi.mock('../../utils/permissions.js', () => ({
  hasPermission: (key, op) => perms.granted.has(`${key}:${op}`),
}));

const {
  syncPlMirror, mirroredPackingLists, mirrorPutPl, mirrorRemovePl, clearPlMirror,
} = await import('./expDocPlMirror.js');

/** A list as GET /packing-lists/mirror returns it (PackingListDTO, blocks and revisions null there). */
const dto = (id, extra = {}) => ({
  id,
  plNo: `PKL/26-27/${1000 + id}`,
  revision: 0,
  status: 'DRAFT',
  version: 1,
  supersedesPlId: null,
  supersededByPlId: null,
  shipmentId: 7,
  shipmentNo: 'SHP/26-27/1007',
  buyerId: 4,
  buyerName: 'JOMO BV',
  orderIds: [11],
  orderNos: ['ORD/0011'],
  plDate: '2026-11-18',
  numbering: 'CONTINUE',
  firstCartonNo: 1,
  tolerancePercent: 0,
  templateId: 3,
  templateVersion: 2,
  template: { id: 3, templateCode: 'JOMO-PL', name: 'JOMO BV - AMG Packing List', version: 2, isSystem: false },
  templateOverride: null,
  sections: [{ key: 'MAIN', title: 'Main', order: 1, rows: [{ id: 'r1', cartonFrom: 1, cartonTo: 10, orderId: 11 }] }],
  sizes: ['M', 'L'],
  totals: { cartons: 10, pieces: 100 },
  cartonRangeLabel: '1–10',
  contentHash: 'a1b2c3d4',
  orderBreakdown: [{ styleNo: 'ST-11', colorName: 'NAVY', size: 'M', orderQty: 100 }],
  orderVsPacked: [],
  sourceRefs: [{ packingEntryId: 21, packingNo: 'CPK/26-27/1021', packingEntryVersion: 2, orderId: 11, poKey: null }],
  isStale: false,
  staleSources: [],
  acknowledgements: [],
  finalSnapshot: null,
  exportedAt: null,
  exportedBy: null,
  createdAt: '2026-11-18 10:05',
  createdBy: 'Priya S.',
  updatedAt: '2026-11-18 10:05',
  blocks: null,
  revisions: null,
  ...extra,
});

/** Every field the browser modules read of a packing list (design §5): the mirror must supply each. */
const OLD_BODY_FIELDS = [
  'id', 'plNo', 'revision', 'status', 'version', 'shipmentId', 'shipmentNo', 'buyerId', 'buyerName', 'buyerCode',
  'orderIds', 'orderNos', 'plDate', 'sections', 'sizes', 'orderBreakdown', 'orderVsPacked', 'totals',
  'cartonRangeLabel', 'contentHash', 'numbering', 'firstCartonNo', 'tolerancePercent', 'template', 'templateSnapshot',
  'templateId', 'templateVersion', 'templateOverride', 'acknowledgements', 'finalSnapshot', 'exportedAt',
  'exportedBy', 'createdAt', 'createdBy', 'updatedAt', 'sourceRefs', 'isStale', 'staleSources', 'supersededByPlId',
];

/** A response the test answers when it chooses. */
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

let now = 1_700_000_000_000;

beforeEach(() => {
  clearPlMirror();
  api.mirror.mockReset();
  perms.granted = new Set(['export-invoice:view']);
  now += 60 * 60 * 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('what it holds', () => {
  test('every list the API returns, quietly asked, under the names the browser modules read', async () => {
    api.mirror.mockResolvedValue([dto(1), dto(2, { status: 'FINAL', version: 4 })]);
    await syncPlMirror();

    expect(api.mirror).toHaveBeenCalledWith({ silent: true, timeout: 10000 });
    const [first, second] = mirroredPackingLists();
    OLD_BODY_FIELDS.forEach((field) => expect(first, field).toHaveProperty(field));
    // The commercial lookups' key, and the layout under the name the old record gave it
    expect(first.buyerCode).toBe('JOMO');
    expect(first.templateSnapshot).toEqual(first.template);
    expect(second).toMatchObject({ id: 2, status: 'FINAL', version: 4 });
  });

  test('without blocks or revisions, whatever an answer carried', async () => {
    api.mirror.mockResolvedValue([]);
    await syncPlMirror();
    mirrorPutPl(dto(5, { blocks: [{ orderId: 11 }], revisions: [{ id: 5 }] }));
    const [held] = mirroredPackingLists();
    expect(held).not.toHaveProperty('blocks');
    expect(held).not.toHaveProperty('revisions');
  });

  test('copies: a module that changes what it read changes nothing held', async () => {
    api.mirror.mockResolvedValue([dto(1)]);
    await syncPlMirror();
    const [read] = mirroredPackingLists();
    read.status = 'CANCELLED';
    read.sections[0].rows.length = 0;
    expect(mirroredPackingLists()[0].status).toBe('DRAFT');
    expect(mirroredPackingLists()[0].sections[0].rows).toHaveLength(1);
  });

  test('a buyer the commercial masters do not know has no code; a standard-layout list no snapshot', async () => {
    api.mirror.mockResolvedValue([dto(1, { buyerName: 'Unknown Buyer', template: null, templateId: null })]);
    await syncPlMirror();
    expect(mirroredPackingLists()[0]).toMatchObject({ buyerCode: null, templateSnapshot: null });
  });
});

describe('freshness', () => {
  test('fresh for 30 s; after that, or forced, it reloads', async () => {
    api.mirror.mockResolvedValue([dto(1)]);
    await syncPlMirror();
    await syncPlMirror();
    expect(api.mirror).toHaveBeenCalledTimes(1);

    await syncPlMirror({ force: true });
    expect(api.mirror).toHaveBeenCalledTimes(2);

    now += 31 * 1000;
    await syncPlMirror();
    expect(api.mirror).toHaveBeenCalledTimes(3);
  });

  test('concurrent syncs share one request', async () => {
    const answer = deferred();
    api.mirror.mockReturnValue(answer.promise);
    const a = syncPlMirror();
    const b = syncPlMirror();
    answer.resolve([dto(1)]);
    await Promise.all([a, b]);
    expect(api.mirror).toHaveBeenCalledTimes(1);
    expect(mirroredPackingLists()).toHaveLength(1);
  });

  test('never throws: a failed refresh keeps the last good copy and is not asked again for a few seconds', async () => {
    api.mirror.mockResolvedValueOnce([dto(1)]);
    await syncPlMirror();
    now += 31 * 1000;
    api.mirror.mockRejectedValueOnce(new Error('offline'));
    await expect(syncPlMirror()).resolves.toBeUndefined();
    expect(mirroredPackingLists().map((pl) => pl.id)).toEqual([1]);

    await syncPlMirror();
    expect(api.mirror).toHaveBeenCalledTimes(2);
    now += 6 * 1000;
    api.mirror.mockResolvedValueOnce([dto(1), dto(2)]);
    await syncPlMirror();
    expect(mirroredPackingLists().map((pl) => pl.id)).toEqual([1, 2]);
  });

  test('someone holding no export view right never asks', async () => {
    perms.granted = new Set(['production-packing:view']);
    await syncPlMirror({ force: true });
    expect(api.mirror).not.toHaveBeenCalled();
    expect(mirroredPackingLists()).toEqual([]);
  });
});

describe('an action\'s answer', () => {
  test('lands at once, and goes when deleted', async () => {
    api.mirror.mockResolvedValue([dto(1)]);
    await syncPlMirror();
    expect(mirrorPutPl(dto(1, { status: 'FINAL', version: 2 }))).toMatchObject({ id: 1, status: 'FINAL' });
    mirrorPutPl(dto(2));
    expect(mirroredPackingLists().map((pl) => [pl.id, pl.status])).toEqual([[1, 'FINAL'], [2, 'DRAFT']]);

    mirrorRemovePl('2');
    expect(mirroredPackingLists().map((pl) => pl.id)).toEqual([1]);
  });

  test('is never undone by a refresh that was in flight: newer copies kept, a deleted list stays gone', async () => {
    const answer = deferred();
    api.mirror.mockReturnValue(answer.promise);
    const refreshing = syncPlMirror();

    mirrorPutPl(dto(1, { status: 'FINAL', version: 5 }));
    mirrorPutPl(dto(3, { version: 1 }));
    mirrorRemovePl(2);
    // The refresh read the lists before those actions
    answer.resolve([dto(1, { version: 4 }), dto(2, { version: 1 })]);
    await refreshing;

    expect(mirroredPackingLists().map((pl) => [pl.id, pl.status, pl.version])).toEqual([[1, 'FINAL', 5], [3, 'DRAFT', 1]]);
  });

  test('a list another user changed after the action is read as the server has it', async () => {
    const answer = deferred();
    api.mirror.mockReturnValue(answer.promise);
    const refreshing = syncPlMirror();
    mirrorPutPl(dto(1, { version: 5 }));
    answer.resolve([dto(1, { status: 'FINAL', version: 6 })]);
    await refreshing;
    expect(mirroredPackingLists()[0]).toMatchObject({ status: 'FINAL', version: 6 });
  });
});

describe('a new session', () => {
  test('starts empty, and a refresh begun before it puts nothing back', async () => {
    api.mirror.mockResolvedValueOnce([dto(1)]);
    await syncPlMirror();
    const answer = deferred();
    api.mirror.mockReturnValueOnce(answer.promise);
    const refreshing = syncPlMirror({ force: true });
    clearPlMirror();
    expect(mirroredPackingLists()).toEqual([]);
    answer.resolve([dto(1), dto(2)]);
    await refreshing;
    expect(mirroredPackingLists()).toEqual([]);
  });
});
