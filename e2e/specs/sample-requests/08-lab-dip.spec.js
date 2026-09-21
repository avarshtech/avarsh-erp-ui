/**
 * A lab dip is a shorter document than a garment sample.
 *
 * It approves ONE fabric in one shade - and because different fabrics take dye
 * differently, the same shade on the body fabric and on the lining are two
 * separate submissions. Nothing is cut or sewn for it: the mill dyes the
 * swatches and sends them in, so it never passes through production, never
 * draws a roll off the rack, and has no size run to be made in.
 *
 * Each of those is a place the garment lifecycle would otherwise trap it, so
 * each is pinned here. Without them the feature reads as finished and a lab dip
 * sits at Submitted for ever, undispatchable.
 *
 * One seeded order carries the whole file: the key is (bom, type, colour,
 * material), so the BOM's four materials give four slots for Lab Dip and four
 * more for Strike Off.
 */
import { test, expect } from '@playwright/test';
import { createAuthenticatedClient } from '../../helpers/api-client.js';
import {
  seedFreeSampleOrder, seedPreview, raiseSrBatch, tryRaiseSrBatch, submitSr, getSr,
  createDispatch, SAMPLE_TYPE,
} from './helpers.js';

test.describe.configure({ mode: 'serial' });

test.describe('Sample Requests · lab dips', () => {
  let api;
  let bom;
  let lines;
  let colours;

  test.beforeAll(async () => {
    api = await createAuthenticatedClient();
    bom = await seedFreeSampleOrder(api);
    const preview = await seedPreview(api, bom.bomId);
    lines = preview.materials;
    colours = preview.orderColours;
    expect(lines.length,
      'the seeded BOM must carry four materials for this file to have room').toBeGreaterThan(3);
  });
  test.afterAll(async () => { await api?.dispose(); });

  test('one request per material, each carrying only its own fabric', async () => {
    const raised = await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.LAB_DIP,
      bomId: bom.bomId,
      bomLineIds: [lines[0].bomLineId, lines[1].bomLineId],
    });
    expect(raised).toHaveLength(2);

    // A swatch of one fabric lists that fabric and nothing else - carrying the
    // other BOM lines would say the submission is something it is not.
    for (const sr of raised) {
      const full = await getSr(api, sr.id);
      expect(full.materials).toHaveLength(1);
      expect(full.bomLineId).toBeTruthy();
    }
    expect(new Set(raised.map((r) => r.bomLineId)).size).toBe(2);
  });

  test('the colour comes off the BOM line, not from the caller', async () => {
    const [raised] = await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.LAB_DIP, bomId: bom.bomId, bomLineIds: [lines[2].bomLineId],
    });
    expect(raised.colourName).toBe(lines[2].colourDesign);
  });

  test('the same fabric twice is refused; a different fabric is a separate approval', async () => {
    await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.LAB_DIP, bomId: bom.bomId, bomLineIds: [lines[3].bomLineId],
    });

    const repeat = await tryRaiseSrBatch(api, {
      request: { bomId: bom.bomId, sampleTypeId: SAMPLE_TYPE.LAB_DIP, sampleQty: 1, sizes: [] },
      bomLineIds: [lines[3].bomLineId],
    });
    expect(repeat.status).toBe(409);
    expect(JSON.stringify(repeat.data)).toContain('fabric');

    // A different fabric is its own submission even where the shade matches,
    // because dye behaves differently on a different fabrication.
    const other = await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.STRIKE_OFF, bomId: bom.bomId, bomLineIds: [lines[0].bomLineId],
    });
    expect(other).toHaveLength(1);
  });

  test('it submits with no sizes, and ships the swatch count rather than zero', async () => {
    const [raised] = await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.STRIKE_OFF, bomId: bom.bomId,
      bomLineIds: [lines[1].bomLineId], sampleQty: 4,
    });
    expect(raised.sizes || []).toHaveLength(0);

    // The submit gate asks every garment sample for its size run. A swatch card
    // has none, so demanding one would make the merchandiser invent sizes.
    await submitSr(api, raised);
    expect((await getSr(api, raised.id)).status).toBe('SUBMITTED');

    // quantity used to be qty x size count, which is zero without sizes - the
    // figure a dispatch note and an invoice line would both have shown.
    const dispatchable = (await api.get('/sample-dispatches/dispatchable-srs')).data || [];
    const row = dispatchable.find((r) => r.id === raised.id);
    expect(row, 'a submitted material submission must be dispatchable').toBeTruthy();
    expect(row.quantity).toBe(4);
  });

  test('it never appears in the material issue picker', async () => {
    const [raised] = await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.STRIKE_OFF, bomId: bom.bomId, bomLineIds: [lines[2].bomLineId],
    });
    await submitSr(api, raised);

    // Submitted is exactly the status the picker offers, so this is the one
    // place a lab dip would slip in and ask the store to issue fabric for it.
    const issuable = (await api.get('/sample-issues/issuable-srs')).data || [];
    expect(issuable.map((s) => s.id)).not.toContain(raised.id);
  });

  test('it dispatches straight from submitted, with no production step', async () => {
    const [raised] = await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.STRIKE_OFF, bomId: bom.bomId, bomLineIds: [lines[3].bomLineId],
    });
    await submitSr(api, raised);

    // In Production is reachable only through a completed material issue, and a
    // lab dip never has one - so requiring it would strand every lab dip.
    const dispatch = await createDispatch(api, [raised.id]);
    expect(dispatch.id).toBeTruthy();
  });

  test('a garment sample still may not skip production', async () => {
    const [pp] = await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.PP, bomId: bom.bomId, colours: [colours[0]],
    });
    await submitSr(api, pp);

    // The shorter lifecycle is for material submissions only: widening the
    // transition table must not have let a garment sample ship unmade.
    const dispatchable = (await api.get('/sample-dispatches/dispatchable-srs')).data || [];
    expect(dispatchable.map((r) => r.id)).not.toContain(pp.id);
  });
});
