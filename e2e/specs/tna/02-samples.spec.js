/**
 * T&A 02 — sample milestones taken from the sampling module, on the newest production-flow order
 * (run it after production-flow/01 and before 02, while the order's fabric is still in stock for the
 * garment samples' material issue). The lab dip is rejected by the buyer and re-made: the plan must add
 * the second cycle itself, keep the rejected cycle in history and close the rejection when cycle 2 is
 * approved. Fit and PP samples complete their dispatch and approval milestones. Nothing is typed on T&A.
 */
import { test, expect } from '../../fixtures.js';
import {
  SAMPLE_TYPE, seedPreview, raiseSr, raiseSrBatch, submitSr, getSr, issueFabric, issueCommercialInvoice,
} from '../sample-requests/helpers.js';
import {
  ok, today, newestFlowOrder, planOf, act,
} from './helpers.js';

/** Dispatched to the order's own buyer: a draft dispatch, its commercial invoice, then marked dispatched. */
const ship = async (api, buyerId, srIds) => {
  const couriers = ok(await api.get('/sample-requests/masters/couriers'), 'couriers');
  const courier = couriers.find((c) => !c.isLocal) || couriers[0];
  const dispatch = ok(await api.post('/sample-dispatches', {
    buyerId, srIds, deliveryMethod: 'COURIER', dispatchedDate: today(), courierId: courier.id,
    trackingNo: `AWB-TNA-${Date.now()}`, dispatchMode: 'AIR', packages: 1, courierCost: 900,
  }), 'create dispatch');
  await issueCommercialInvoice(api, dispatch);
  ok(await api.post(`/sample-dispatches/${dispatch.id}/mark-dispatched`, { version: dispatch.version }), 'mark dispatched');
  return dispatch;
};

const verdict = async (api, srId, decision) => {
  const sr = await getSr(api, srId);
  return ok(await api.put(`/sample-requests/${srId}/feedback`, {
    date: today(), from: 'Buyer QA (e2e)', decision, rejectionReasonCodes: [],
    comments: { fabricShade: decision === 'REJECTED' ? 'Shade off-standard — re-make' : 'Approved' }, version: sr.version,
  }), `feedback ${decision}`);
};

test.describe.serial('T&A — sample milestones from Sampling', () => {
  let order;
  let bomId;
  let preview;
  let sizes;

  test.beforeAll(async ({ api }) => {
    order = await newestFlowOrder(api);
    const boms = ok(await api.get('/sample-requests/bom-preview', { orderNo: order.orderNo }), 'bom preview');
    bomId = boms.header.bomId;
    preview = await seedPreview(api, bomId);
    sizes = Object.keys(order.orderLines[0].colorRows[0].quantities).slice(0, 2);
    // A commitment shorter than the template's lead time leaves the plan infeasible and its baseline
    // open; the merchandiser accepts the compressed plan, which freezes the baseline (D-06).
    const plan = await planOf(api, order.id);
    if (plan.header.status === 'INFEASIBLE') {
      ok(await api.post(`/tna/plans/${plan.header.id}/acknowledge-infeasible`, { reason: 'E2E: buyer date accepted, plan compressed' }), 'acknowledge');
      const now = await planOf(api, order.id);
      expect(now.header.status).toBe('ACTIVE');
      expect(now.header.baselineFrozen).toBe(true);
    }
  });

  test('a rejected lab dip opens cycle 2 on the plan; the approval of cycle 2 closes the rejection', async ({ api }) => {
    test.setTimeout(180000);
    const [labDip] = await raiseSrBatch(api, {
      sampleTypeId: SAMPLE_TYPE.LAB_DIP, bomId, bomLineIds: [preview.materials[0].bomLineId],
    });
    await submitSr(api, labDip);
    await ship(api, order.buyerId, [labDip.id]);
    await verdict(api, labDip.id, 'REJECTED');

    let plan = await planOf(api, order.id);
    expect(act(plan, 'A03').actualDate, 'lab dip dispatch from the dispatch date').toBe(today());
    expect(act(plan, 'A03').postBaseline, 'raised after the plan was generated: an addendum').toBe(true);
    expect(act(plan, 'A04').outcome).toBe('REJECTED');
    expect(act(plan, 'A03-2').actualDate, 'cycle 2 is planned, not done').toBeNull();
    const rejection = plan.exceptions.find((x) => x.type === 'QUALITY_REJECTION' && x.activityCode === 'A04');
    expect(rejection?.status).toBe('OPEN');

    const raised = ok(await api.post(`/sample-requests/${labDip.id}/revisions`), 'raise revision');
    // A re-make gets its own timeline: the merchandiser dates it before submitting
    const remake = ok(await api.put(`/sample-requests/${raised.id}`, {
      ...raised, inHandDate: today(), dispatchDeadline: today(), buyerApprovalDeadline: today(),
    }), 'date the re-make');
    await submitSr(api, remake);
    await ship(api, order.buyerId, [remake.id]);
    await verdict(api, remake.id, 'APPROVED');

    plan = await planOf(api, order.id);
    expect(act(plan, 'A03-2').actualDate).toBe(today());
    expect(act(plan, 'A04-2').actualDate).toBe(today());
    expect(act(plan, 'A04-2').outcome).toBe('COMPLETED');
    expect(act(plan, 'A04').outcome, 'the rejected cycle stays in history').toBe('REJECTED');
    expect(plan.exceptions.find((x) => x.id === rejection.id).status).toBe('RESOLVED');
    // Fabric PO waits on the final lab dip approval once the lab dip is on the plan
    expect(act(plan, 'A07').predecessors).toContain('A04-2');
  });

  test('fit and PP samples complete their dispatch and buyer-approval milestones', async ({ api }) => {
    test.setTimeout(240000);
    const fit = await raiseSr(api, { sampleTypeId: SAMPLE_TYPE.FIT, bomId, sizes, sampleQty: 1 });
    await submitSr(api, fit);
    await issueFabric(api, fit.id);
    await ship(api, order.buyerId, [fit.id]);
    await verdict(api, fit.id, 'APPROVED');

    const pps = await raiseSrBatch(api, { sampleTypeId: SAMPLE_TYPE.PP, bomId, colours: preview.orderColours, sizes, sampleQty: 1 });
    for (const pp of pps) {
      await submitSr(api, pp);
      await issueFabric(api, pp.id);
    }
    await ship(api, order.buyerId, pps.map((p) => p.id));
    for (const pp of pps) await verdict(api, pp.id, 'APPROVED');

    const plan = await planOf(api, order.id);
    for (const code of ['A05', 'A06', 'A10', 'A11']) {
      expect(act(plan, code).actualDate, `${code} completed from the sampling records`).toBe(today());
      expect(act(plan, code).evidence?.sourceModule).toBe('Sampling');
    }
    expect(act(plan, 'A11').sourceRecord, 'every PP request of the order counts').toContain(pps[0].srNo);
    const versions = ok(await api.get(`/tna/plans/${plan.header.id}/versions`), 'versions');
    expect(versions.some((v) => v.triggerEvent === 'sample.approved')).toBe(true);
  });
});
