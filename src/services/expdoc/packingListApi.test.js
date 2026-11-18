// Node-only: the packing-list REST client against a stubbed axios — each endpoint's method, path,
// parameters and body (the API's fields only), the times stamped as the web app stamps them, and a
// refusal carrying the backend's text and code.
//   npx vitest run src/services/expdoc/packingListApi.test.js
import {
  describe, test, expect, vi, beforeEach,
} from 'vitest';

const http = vi.hoisted(() => ({
  get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(),
}));

vi.mock('../core/axiosInstance.js', () => ({ default: http }));

const plApi = await import('./packingListApi.js');

const BASE = '/export-docs/packing-lists';
const answer = (data) => Promise.resolve({ data });

beforeEach(() => {
  Object.values(http).forEach((fn) => {
    fn.mockReset();
    fn.mockImplementation(() => answer({ id: 5, version: 6 }));
  });
});

describe('reads', () => {
  test('the register sends only the filters given; each row\'s time is stamped as the web app stamps it', async () => {
    http.get.mockReturnValue(answer({
      content: [{ id: 5, plNo: 'PKL/26-27/1005', updatedAt: '2026-11-18T10:05:12.345678' }], totalElements: 1,
    }));
    const page = await plApi.searchApiPackingLists({ status: 'DRAFT', search: 'PKL', page: 1, size: 10 });

    expect(http.get).toHaveBeenCalledWith(BASE, { params: { status: 'DRAFT', search: 'PKL', page: 1, size: 10 } });
    expect(page).toMatchObject({ totalElements: 1, content: [{ id: 5, updatedAt: '2026-11-18 10:05' }] });

    await plApi.searchApiPackingLists();
    expect(http.get).toHaveBeenLastCalledWith(BASE, { params: { page: 0, size: 25 } });
  });

  test('one list: its times, its submission and return and its revisions stamped; stamped text left as it is', async () => {
    http.get.mockReturnValue(answer({
      id: 5,
      createdAt: '2026-11-18T09:00:00',
      updatedAt: '2026-11-18T10:05:59.9',
      finalisedAt: null,
      approval: { requestId: 31, submittedAt: '2026-11-18T10:06:00', submittedBy: 'Priya S.' },
      returned: { kind: 'REFERRED_BACK', by: 'Arun K.', at: '2026-11-18T11:30:00', reason: 'Wrong seal number' },
      finalSnapshot: { at: '2026-11-17 16:40', by: 'Priya S.' },
      revisions: [{ id: 4, createdAt: '2026-11-17T08:00:00', finalisedAt: '2026-11-17T16:40:00' }],
    }));
    const pl = await plApi.getApiPackingList(5);

    expect(http.get).toHaveBeenCalledWith(`${BASE}/5`);
    expect(pl).toMatchObject({
      createdAt: '2026-11-18 09:00',
      updatedAt: '2026-11-18 10:05',
      finalisedAt: null,
      approval: { requestId: 31, submittedAt: '2026-11-18 10:06' },
      returned: { kind: 'REFERRED_BACK', at: '2026-11-18 11:30' },
      finalSnapshot: { at: '2026-11-17 16:40' },
      revisions: [{ id: 4, createdAt: '2026-11-17 08:00', finalisedAt: '2026-11-17 16:40' }],
    });
  });

  test('revisions, a comparison and what a shipment could take', async () => {
    http.get.mockReturnValueOnce(answer([{ id: 4, createdAt: '2026-11-17T08:00:00' }]));
    expect(await plApi.getApiPlRevisions(5)).toEqual([{ id: 4, createdAt: '2026-11-17 08:00' }]);
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/5/revisions`);

    http.get.mockReturnValueOnce(answer({ a: { id: 4, finalisedAt: '2026-11-17T16:40:00' }, b: { id: 5, finalisedAt: null }, identical: false }));
    expect(await plApi.compareApiPackingLists(4, 5)).toMatchObject({ a: { finalisedAt: '2026-11-17 16:40' }, b: { finalisedAt: null } });
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/4/compare/5`);

    await plApi.getApiBindable(7);
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/bindable`, { params: { shipmentId: 7 } });
  });

  test('Carton Packing asks quietly: the entries as one comma list, an order\'s open plans', async () => {
    http.get.mockReturnValueOnce(answer({ 3: [{ plId: 5, plNo: 'PKL/26-27/1005', status: 'DRAFT', buyerPoNo: 'PO-1' }] }));
    const byEntry = await plApi.getApiListsOfEntries([3, 7], { silent: true, timeout: 10000 });
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/by-entries`, { params: { ids: '3,7' }, silent: true, timeout: 10000 });
    expect(byEntry[3][0].plNo).toBe('PKL/26-27/1005');

    await plApi.getApiOpenPlans(11, { silent: true });
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/open-plans`, { params: { orderId: 11 }, silent: true });
  });

  test('the mirror: every list, quietly when asked so, times stamped', async () => {
    http.get.mockReturnValueOnce(answer([{ id: 5, updatedAt: '2026-11-18T10:05:00' }]));
    expect(await plApi.getApiPlMirror({ silent: true, timeout: 10000 })).toEqual([{ id: 5, updatedAt: '2026-11-18 10:05' }]);
    expect(http.get).toHaveBeenLastCalledWith(`${BASE}/mirror`, { silent: true, timeout: 10000 });
  });

  test('the audit trail sends the trail screen\'s filters', async () => {
    http.get.mockReturnValueOnce(answer({ content: [], users: ['Priya S.'], entityTypes: ['PACKING_LIST'] }));
    const page = await plApi.searchApiExportAudit({
      entityType: 'PACKING_LIST', user: 'Priya S.', search: '1005', withReasonOnly: true, withChangesOnly: false, page: 2, size: 20,
    });
    expect(http.get).toHaveBeenLastCalledWith('/export-docs/audit', {
      params: {
        entityType: 'PACKING_LIST', user: 'Priya S.', search: '1005', withReasonOnly: true, page: 2, size: 20,
      },
    });
    expect(page.users).toEqual(['Priya S.']);
  });
});

describe('writes send the API\'s fields only, with the version', () => {
  test('create: the shipment, the template, the units; never the screen\'s own fields', async () => {
    await plApi.createApiPackingList({
      shipmentId: 7,
      templateId: 3,
      buyerName: 'JOMO BV',
      buyerCode: 'JOMO',
      units: [{ packingEntryId: 21, poKey: 'PO-1', packingNo: 'CPK/26-27/1021' }, { packingEntryId: 22 }],
    });
    expect(http.post).toHaveBeenCalledWith(BASE, {
      shipmentId: 7,
      templateId: 3,
      plDate: null,
      descriptionOfGoods: null,
      marksAndNos: null,
      numbering: null,
      firstCartonNo: null,
      tolerancePercent: null,
      units: [{ packingEntryId: 21, poKey: 'PO-1' }, { packingEntryId: 22, poKey: null }],
    });
  });

  test('the header goes whole with its version; the rest of a decorated list stays home', async () => {
    await plApi.updateApiPlHeader(5, {
      id: 5, version: 4, plDate: '2026-11-18', descriptionOfGoods: 'KNITTED GARMENTS', marksAndNos: undefined, containerNo: null,
      sealNo: 'SL-1', remarks: '', numbering: 'PER_PO', firstCartonNo: 1, tolerancePercent: 3, ownTolerancePercent: 3,
      blocks: [], resolved: { containerNo: 'MSKU1' }, panelFindings: {}, status: 'DRAFT',
    });
    expect(http.put).toHaveBeenCalledWith(`${BASE}/5`, {
      version: 4,
      plDate: '2026-11-18',
      descriptionOfGoods: 'KNITTED GARMENTS',
      marksAndNos: null,
      containerNo: null,
      sealNo: 'SL-1',
      remarks: '',
      numbering: 'PER_PO',
      firstCartonNo: 1,
      tolerancePercent: 3,
    });
  });

  test('the tolerance sent is the list\'s own: none of its own sends none, never the default it works with', async () => {
    await plApi.updateApiPlHeader(5, { version: 4, plDate: '2026-11-18', tolerancePercent: 2, ownTolerancePercent: null });
    expect(http.put.mock.calls.at(-1)[1].tolerancePercent).toBeNull();

    await plApi.updateApiPlHeader(5, { version: 4, plDate: '2026-11-18', tolerancePercent: 2, ownTolerancePercent: 1.5 });
    expect(http.put.mock.calls.at(-1)[1].tolerancePercent).toBe(1.5);
  });

  test.each([
    ['bind', () => plApi.bindApiUnits(5, 6, [{ packingEntryId: 21, poKey: 'PO-1', cartons: 4 }]), 'post', `${BASE}/5/bind`,
      { version: 6, units: [{ packingEntryId: 21, poKey: 'PO-1' }] }],
    ['unbind', () => plApi.unbindApiUnit(5, 6, { packingEntryId: 21 }), 'post', `${BASE}/5/unbind`,
      { version: 6, packingEntryId: 21, poKey: null }],
    ['move a block', () => plApi.moveApiBlock(5, 6, 11, -3), 'post', `${BASE}/5/blocks/move`, { version: 6, orderId: 11, delta: -1 }],
    ['drop a block', () => plApi.dropApiBlock(5, 6, 11), 'post', `${BASE}/5/blocks/drop`, { version: 6, orderId: 11 }],
    ['save a plan', () => plApi.saveApiPlan(5, 6, 11, [{ id: 'plan-1', cartonFrom: 21, cartonTo: 30 }]), 'put', `${BASE}/5/plans/11`,
      { version: 6, rows: [{ id: 'plan-1', cartonFrom: 21, cartonTo: 30 }] }],
    ['clear a plan', () => plApi.saveApiPlan(5, 6, 11, null), 'put', `${BASE}/5/plans/11`, { version: 6, rows: [] }],
    ['not shipping', () => plApi.markApiNotShipping(5, 6, 11, 'plan-1', 'The buyer cut the PO'), 'post',
      `${BASE}/5/plans/11/not-shipping`, { version: 6, planRowId: 'plan-1', reason: 'The buyer cut the PO' }],
    ['shipping again', () => plApi.markApiNotShipping(5, 6, 11, 'plan-1'), 'post',
      `${BASE}/5/plans/11/not-shipping`, { version: 6, planRowId: 'plan-1', reason: null }],
    ['acknowledge', () => plApi.acknowledgeApiFinding(5, 6, { code: 'V-05', targetKey: 'LINE:ST|NAVY|M', message: 'm' }, 'Buyer agreed'),
      'post', `${BASE}/5/ack`, { version: 6, code: 'V-05', targetKey: 'LINE:ST|NAVY|M', reason: 'Buyer agreed' }],
    ['refresh', () => plApi.refreshApiPackingList(5, 6), 'post', `${BASE}/5/refresh`, { version: 6 }],
    ['change the template', () => plApi.changeApiPlTemplate(5, 6, null, 'The buyer has no layout yet'), 'post',
      `${BASE}/5/template`, { version: 6, templateId: null, reason: 'The buyer has no layout yet' }],
    ['submit', () => plApi.submitApiPackingList(5, 6), 'post', `${BASE}/5/submit`, { version: 6 }],
    ['withdraw', () => plApi.withdrawApiPackingList(5, 6), 'post', `${BASE}/5/withdraw`, { version: 6 }],
    ['release', () => plApi.releaseApiPackingList(5, 6), 'post', `${BASE}/5/release`, { version: 6, detail: null }],
    ['cancel', () => plApi.cancelApiPackingList(5, 6, 'Shipment cancelled'), 'post', `${BASE}/5/cancel`,
      { version: 6, reason: 'Shipment cancelled' }],
    ['revise', () => plApi.reviseApiPackingList(5, 6, 'Seal number corrected'), 'post', `${BASE}/5/revise`,
      { version: 6, reason: 'Seal number corrected' }],
  ])('%s', async (_, send, method, url, body) => {
    const pl = await send();
    expect(http[method]).toHaveBeenCalledWith(url, body);
    // Every command answers with the list
    expect(pl).toEqual({ id: 5, version: 6 });
  });

  test('delete sends the version as a parameter', async () => {
    http.delete.mockReturnValueOnce(answer(''));
    await plApi.deleteApiPackingList(5, 4);
    expect(http.delete).toHaveBeenCalledWith(`${BASE}/5`, { params: { version: 4 } });
  });
});

describe('a refusal', () => {
  test('carries the backend\'s text as its message and its error code', async () => {
    const refused = Object.assign(new Error('Request failed with status code 409'), {
      isAxiosError: true,
      errorMessage: 'CPK/26-27/1021 is already on PKL/26-27/1004.',
      response: { status: 409, data: { error: 'CONFLICT', message: 'CPK/26-27/1021 is already on PKL/26-27/1004.' } },
    });
    http.post.mockReturnValueOnce(Promise.reject(refused));
    await expect(plApi.bindApiUnits(5, 6, [{ packingEntryId: 21 }])).rejects.toMatchObject({
      message: 'CPK/26-27/1021 is already on PKL/26-27/1004.', code: 'CONFLICT', isAxiosError: true,
    });
  });
});
