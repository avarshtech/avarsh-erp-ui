/**
 * What the GRN screens send: the request built from the form's payload. The API is replaced by a stub
 * that records each call, so this needs no browser and no backend.
 *   npx vitest run src/services/inventory/grnRequest.test.js
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

const posted = [];
vi.mock('../core/axiosInstance', () => ({
  default: {
    post: vi.fn(async (url, body) => { posted.push({ url, body }); return { data: { id: 1, lineItems: [] } }; }),
    get: vi.fn(async () => ({ data: [] })),
  },
}));

const { saveFabricGRNDraft, submitTrimsGRN } = await import('./inventoryService');

beforeEach(() => { posted.length = 0; });

describe('GRN request', () => {
  // U214: the "Received At (Branch)" choice was dropped, so the API filed the GRN at the PO's delivery branch.
  test('carries the Received At branch the user picked', async () => {
    await saveFabricGRNDraft({ poId: 7, branchId: 3, lineItems: [] }).catch(() => {});
    await submitTrimsGRN({ id: 9, version: 2, poId: 7, branchId: 4, lineItems: [] }).catch(() => {});
    expect(posted.map((p) => [p.url, p.body.branchId])).toEqual([['/grns/draft', 3], ['/grns/submit', 4]]);
  });

  test('sends no branch when the form has none, so the API keeps its own default', async () => {
    await saveFabricGRNDraft({ poId: 7, branchId: null, lineItems: [] }).catch(() => {});
    expect(posted[0].body.branchId).toBeNull();
  });
});
