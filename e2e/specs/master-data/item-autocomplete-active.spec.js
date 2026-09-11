/**
 * The purchase-order item picker must not offer something that has been retired.
 *
 * `GET /items/autocomplete` is what the PO form's item AutoComplete calls, and its query
 * (`ItemRepository.searchTop10ByVariant`) filtered NEITHER `i.isActive` NOR `v.isActive` — so a
 * deactivated item, or an item whose only matching variant had been deactivated, was still offered
 * to a buyer as something to purchase. This is the first enforcement of the ERP-wide rule that only
 * ACTIVE master records may be used on a document.
 *
 * The two flags are ANDed, and both halves are tested separately, because they fail differently:
 * a parent flag alone would still offer a retired variant, and a child flag alone would still offer
 * a retired item.
 *
 * API-only, deliberately. The rule lives entirely in JPQL, and JPQL is the one thing the unit suite
 * cannot execute — `./gradlew test` excludes `**\/integration\/**`, those tests are additionally
 * `@Disabled`, and they need a Docker that is not installed. The e2e stack runs the real query,
 * which is what makes this the only place the filter can be proved at all.
 */

import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  categoryPayload, subCategoryPayload, itemPayload, uomPayload,
} from '../../helpers/test-data.js';

const S = Date.now().toString().slice(-6);

let api;
let item;
let MATCH;      // the variant name the autocomplete is searched by
let OTHER;      // a second variant on the same item, kept active throughout

test.describe.configure({ mode: 'serial' });

/** The ids the endpoint returns for a query. */
async function autocomplete(q) {
  const res = await api.get(`/items/autocomplete?q=${encodeURIComponent(q)}`);
  expect(res.status, `autocomplete failed: ${JSON.stringify(res.data)}`).toBeLessThan(300);
  return (res.data || []).map((i) => i.id);
}

test.describe('Item autocomplete — only active items and variants are offered', () => {
  test.beforeAll(async () => {
    api = await createAuthenticatedClient();

    const { data: uom } = await api.post('/unit-of-measures',
      uomPayload({ name: `E2E ActiveUom ${S}`, symbol: `x${S.slice(-3)}` }));
    const { data: attr } = await api.post('/attribute-configs',
      { attributeName: `Shade${S}`, dataType: 'string' });
    const { data: cat } = await api.post('/categories',
      categoryPayload({ name: `E2E Active Cat ${S}` }));
    const { data: sub } = await api.post('/sub-categories',
      subCategoryPayload(cat.id, { name: `E2E Active Sub ${S}` }));
    const { data: type } = await api.post('/item-types', {
      name: `E2E Active Type ${S}`,
      subCategoryId: sub.id,
      attributeIds: [attr.id],
      uomIds: [uom.id],
    });

    MATCH = `Retirable Variant ${S}`;
    OTHER = `Companion Variant ${S}`;

    // Two variants: the search matches on variant name, so the second one keeps the ITEM
    // discoverable after the first is retired. Without it, deactivating the only variant and
    // deactivating the item would be indistinguishable.
    const { data: created } = await api.post('/items', itemPayload(
      { categoryId: cat.id, subCategoryId: sub.id, itemTypeId: type.id, uomId: uom.id },
      {
        variants: [
          { variantName: MATCH, isActive: true, attributes: { [`shade${S}`]: 'Retirable' } },
          { variantName: OTHER, isActive: true, attributes: { [`shade${S}`]: 'Companion' } },
        ],
      },
    ));
    item = created;
    expect(item?.id, `seed item create failed: ${JSON.stringify(created).slice(0, 300)}`).toBeTruthy();
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test('A1 — an active item with an active variant is offered', async () => {
    expect(await autocomplete(MATCH)).toContain(item.id);
  });

  test('A2 — deactivating the MATCHED variant removes the item from that search', async () => {
    const variants = item.variants.map((v) => ({
      ...v, isActive: v.variantName === MATCH ? false : true,
    }));
    const res = await api.put(`/items/${item.id}`, { ...item, variants });
    expect(res.status, `update failed: ${JSON.stringify(res.data)}`).toBeLessThan(300);

    expect(
      await autocomplete(MATCH),
      'a retired variant must not be purchasable',
    ).not.toContain(item.id);

    // ...and this is the half a parent-only filter would get wrong: the ITEM is still active,
    // so it must still be reachable through its other, still-active variant.
    expect(
      await autocomplete(OTHER),
      'the item itself is still active, so its remaining variant stays offered',
    ).toContain(item.id);
  });

  test('A3 — reactivating the variant brings it back', async () => {
    const variants = item.variants.map((v) => ({ ...v, isActive: true }));
    const res = await api.put(`/items/${item.id}`, { ...item, variants });
    expect(res.status).toBeLessThan(300);
    expect(await autocomplete(MATCH)).toContain(item.id);
  });

  test('A4 — deactivating the ITEM removes it whichever variant is searched', async () => {
    const res = await api.put(`/items/${item.id}`, {
      ...item,
      isActive: false,
      variants: item.variants.map((v) => ({ ...v, isActive: true })),
    });
    expect(res.status, `update failed: ${JSON.stringify(res.data)}`).toBeLessThan(300);

    // Both, because this is the half a child-only filter would get wrong.
    expect(await autocomplete(MATCH), 'a retired item is not purchasable').not.toContain(item.id);
    expect(await autocomplete(OTHER), 'not through any of its variants either').not.toContain(item.id);
  });
});
