/**
 * How colour divides a sample type into requests.
 *
 * The module used to carry one sample of each type per order. It now carries
 * one per COLOUR for the types that are made per colour, one per BOM MATERIAL
 * for a lab dip, and still exactly one for the types where colour does not come
 * into it. Four behaviours, and the differences between them are the whole
 * feature - so each is pinned here against the real server rather than inferred
 * from the one that happens to be easiest to drive.
 *
 * ONE seeded order carries the lot. That is deliberate: the key is now
 * (bom, type, colour, material), so a single BOM has room for a PP sample in
 * every colourway, a size set, a proto and a fit all at once - which is the
 * feature, and also keeps the spec from eating the thirteen-order pool a test
 * at a time.
 *
 * Driven through the API: these are rules, and the screens that show them are
 * covered by 01 and 05. The one UI test is the form switching what it asks for,
 * which is the part no API call can demonstrate.
 */
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  goTo, selectFor, seedFreeSampleOrder, seedPreview, raiseSr, raiseSrBatch, tryRaiseSrBatch,
  SAMPLE_TYPE,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

test.describe('Sample Requests · colour scopes', () => {
  let api;
  let bom;
  let colours;

  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    bom = await seedFreeSampleOrder(api);
    colours = (await seedPreview(api, bom.bomId)).orderColours;
  });
  test.afterAll(async () => { await api?.dispose(); });

  test('the seeded order names its colourways', async () => {
    // Everything below depends on this: with no colourways there is nothing to
    // raise a per-colour sample for, and the failure would look like a rule bug.
    expect(colours.length,
      'the seeded sample order must name at least two colourways').toBeGreaterThan(1);
  });

  test('a per-colour type raises one request per colour, each its own document', async () => {
    const raised = await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.PP, bomId: bom.bomId, colours,
    });

    expect(raised).toHaveLength(colours.length);
    expect(raised.map((r) => r.colourName)).toEqual(colours);
    // Separate documents, not one request mentioning two colours: distinct ids
    // and distinct SRQ numbers are what make them separately dispatchable and
    // separately approvable.
    expect(new Set(raised.map((r) => r.id)).size).toBe(colours.length);
    expect(new Set(raised.map((r) => r.srNo)).size).toBe(colours.length);
  });

  test('the same type in the same colour is refused, and the colour is named', async () => {
    await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.SMS, bomId: bom.bomId, colours: [colours[0]],
    });

    const res = await tryRaiseSrBatch(api, {
      request: { bomId: bom.bomId, sampleTypeId: SAMPLE_TYPE.SMS, sampleQty: 1, sizes: ['M'] },
      colours: [colours[0]],
    });
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.data)).toContain(colours[0]);
    // The refusal offers the way out that actually exists for this type.
    expect(JSON.stringify(res.data)).toContain('or colour');
  });

  test('a colour still free is offered even when another is taken', async () => {
    await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.PHOTOSHOOT, bomId: bom.bomId, colours: [colours[0]],
    });
    const later = await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.PHOTOSHOOT, bomId: bom.bomId, colours: [colours[1]],
    });
    expect(later[0].colourName).toBe(colours[1]);
  });

  test('the same colour twice in one batch is refused rather than silently deduplicated', async () => {
    const res = await tryRaiseSrBatch(api, {
      request: { bomId: bom.bomId, sampleTypeId: SAMPLE_TYPE.SHIPMENT, sampleQty: 1, sizes: ['M'] },
      colours: [colours[0], colours[0]],
    });
    // Asking for two and getting one with no explanation is worse than a refusal.
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.data)).toContain('twice');
  });

  test('a refused batch spends no SRQ numbers', async () => {
    const before = await raiseSr(api, { sampleTypeId: SAMPLE_TYPE.PROTO, bomId: bom.bomId });

    // Refused after the first member has already drawn its number and been
    // flushed - which is exactly the case that would leave a gap.
    await tryRaiseSrBatch(api, {
      request: { bomId: bom.bomId, sampleTypeId: SAMPLE_TYPE.SHIPMENT, sampleQty: 1, sizes: ['M'] },
      colours: [colours[0], colours[0]],
    });

    const after = await raiseSr(api, { sampleTypeId: SAMPLE_TYPE.FIT, bomId: bom.bomId });
    const seq = (srNo) => Number(srNo.split('/').pop());
    // The counter runs inside the batch's own transaction, so a rollback returns
    // the numbers it drew. One successful raise apart means one number apart.
    expect(seq(after.srNo)).toBe(seq(before.srNo) + 1);
  });

  test('a size set names its colour but is still one per order', async () => {
    const sizeSet = await raiseSr(api, {
      sampleTypeId: SAMPLE_TYPE.SIZE_SET, bomId: bom.bomId, colourName: colours[0],
    });
    expect(sizeSet.colourName).toBe(colours[0]);

    // THE rule a plausible implementation gets wrong. A size set proves grading
    // across sizes and one colourway is enough, so its colour is recorded but
    // deliberately left out of the uniqueness key - a second in a different
    // colour is the same duplicate as any other.
    const res = await api.post('/sample-requests', {
      bomId: bom.bomId, sampleTypeId: SAMPLE_TYPE.SIZE_SET, sampleQty: 1, sizes: ['M'],
      colourName: colours[1], priority: 'NORMAL', materials: [],
    });
    expect(res.status).toBe(409);
    // And it does not suggest changing the colour, because that would not help.
    expect(JSON.stringify(res.data)).not.toContain('or colour');
  });

  test('a type that names no colour behaves exactly as it always did', async () => {
    const others = await raiseSr(api, { sampleTypeId: SAMPLE_TYPE.OTHERS, bomId: bom.bomId });
    expect(others.colourName).toBeFalsy();

    const res = await api.post('/sample-requests', {
      bomId: bom.bomId, sampleTypeId: SAMPLE_TYPE.OTHERS, sampleQty: 1, sizes: ['M'],
      // Even with a colour sent, this type does not divide by one.
      colourName: colours[0], priority: 'NORMAL', materials: [],
    });
    expect(res.status).toBe(409);
  });

  test('a batch is refused for a type that raises one request', async () => {
    const res = await tryRaiseSrBatch(api, {
      request: { bomId: bom.bomId, sampleTypeId: SAMPLE_TYPE.FIT, sampleQty: 1, sizes: ['M'] },
      colours,
    });
    expect(res.status).toBe(400);
  });

  test('the form asks for what the chosen type divides by', async ({ page }) => {
    // A fresh order, because this one opens the create form and the taken types
    // on the shared BOM would be disabled before they could be clicked.
    const fresh = await seedFreeSampleOrder(api);
    await goTo(page, `/sample-requests/new?bomId=${fresh.bomId}&orderNo=${encodeURIComponent(fresh.orderNo)}`);
    await expect(page.getByText('B · Sample Details')).toBeVisible({ timeout: 25000 });

    const typeSelect = selectFor(page, 'Sample Type');
    const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');

    /**
     * Pick a sample type through the field's own search.
     *
     * The list is virtualised, so only the options around the current selection
     * are in the DOM - reopening it with PP Sample chosen renders 4, 5 and 6 and
     * nothing else, and clicking blindly for Lab Dip waits for an element that
     * was never rendered. Typing is what a user does anyway, and
     * optionFilterProp="name" is there for exactly this.
     */
    const pickType = async (name) => {
      await typeSelect.click();
      await page.keyboard.type(name);
      const option = dropdown.locator('.ant-select-item-option').filter({ hasText: name }).first();
      await option.waitFor({ state: 'visible', timeout: 15000 });
      await option.click();
      await page.waitForTimeout(500);
    };

    // Proto divides by nothing: no colour field, and the size run still asked for.
    await pickType('Proto');
    await expect(page.locator('label', { hasText: 'Colourways' })).toHaveCount(0);
    await expect(page.locator('label', { hasText: 'Sizes' }).first()).toBeVisible();

    // PP Sample divides by colour: the colourway picker appears.
    await pickType('PP Sample');
    await expect(page.locator('label', { hasText: 'Colourways' }).first()).toBeVisible();

    // A lab dip divides by material, and has no size run at all.
    await pickType('Lab Dip');
    await expect(page.locator('label', { hasText: 'Materials' }).first()).toBeVisible();
    await expect(page.locator('label', { hasText: 'Sizes' })).toHaveCount(0);
    await expect(page.locator('label', { hasText: 'Swatches' }).first()).toBeVisible();
  });
});
