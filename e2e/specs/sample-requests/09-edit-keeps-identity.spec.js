/**
 * Editing a draft keeps the identity it was raised with.
 *
 * A per-colour sample (PP, Shipment) and a material sample (lab dip, strike off) choose their
 * colourway or fabric when they are raised - the form's multi-select becomes one request per
 * choice. Once a request exists, that colour or fabric is part of what it IS, and the edit form
 * mounts no single-value field for it. The save must still send it, from the record:
 *   - a PP sample saved from the edit form kept its colourway (it used to be nulled, which freed
 *     the colour for a duplicate and sent the request for approval with no colour);
 *   - a lab dip saved from the edit form saves at all (it used to be refused with 400, "choose
 *     which fabric it is for").
 *
 * Raised the way the form raises them (the batch endpoint), then edited through the real screen.
 */
import { test, expect } from '../../fixtures.js';
import { seedFreeSampleOrder, seedPreview, raiseSrBatch, getSr, SAMPLE_TYPE } from './helpers.js';

test.describe.configure({ mode: 'serial' });

/** Open the edit form, change the remarks, Save as Draft, and return the PUT's status. */
async function editAndSaveDraft(page, id, remarks) {
  await page.goto(`/sample-requests/edit/${id}`);
  await expect(page.getByText('Edit Sample Request').first()).toBeVisible({ timeout: 30000 });
  const remarksBox = page.locator('#remarks');
  await expect(remarksBox).toBeVisible();
  await remarksBox.fill(remarks);

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'PUT' && /\/sample-requests\/\d+$/.test(new URL(r.url()).pathname)),
    page.getByRole('button', { name: /Save as Draft/i }).click(),
  ]);
  return response;
}

test.describe('Sample Requests · editing a draft keeps its identity', () => {
  let bom;
  let preview;

  test.beforeAll(async ({ api }) => {
    bom = await seedFreeSampleOrder(api);
    preview = await seedPreview(api, bom.bomId);
  });

  test('a PP sample keeps its colourway when its draft is saved from the edit form', async ({ api, authedPage }) => {
    const colour = preview.orderColours[0];
    const [raised] = await raiseSrBatch(api, { sampleTypeId: SAMPLE_TYPE.PP, bomId: bom.bomId, colours: [colour] });
    expect(raised.colourName).toBe(colour);

    const response = await editAndSaveDraft(authedPage, raised.id, 'Edited by the e2e suite');
    expect(response.status()).toBe(200);
    expect((await response.request().postDataJSON()).colourName).toBe(colour);

    const saved = await getSr(api, raised.id);
    expect(saved.remarks).toBe('Edited by the e2e suite');
    expect(saved.colourName).toBe(colour);
  });

  test('a lab dip draft saves from the edit form and keeps its fabric', async ({ api, authedPage }) => {
    const line = preview.materials.find((m) => m.section === 'FABRIC') || preview.materials[0];
    const [raised] = await raiseSrBatch(api, { sampleTypeId: SAMPLE_TYPE.LAB_DIP, bomId: bom.bomId, bomLineIds: [line.bomLineId] });
    expect(raised.bomLineId).toBe(line.bomLineId);

    const response = await editAndSaveDraft(authedPage, raised.id, 'Lab dip edited by the e2e suite');
    expect(response.status(), await response.text()).toBe(200);

    const saved = await getSr(api, raised.id);
    expect(saved.remarks).toBe('Lab dip edited by the e2e suite');
    expect(saved.bomLineId).toBe(line.bomLineId);
    expect(saved.colourName).toBe(raised.colourName);
  });
});
