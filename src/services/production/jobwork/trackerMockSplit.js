/**
 * Mock of GET /api/v1/job-work/orders/{id}/split (plan 1e "Split card"): who makes how much of an
 * order, per colour — each garment-making vendor job, and in-house as one maker.
 */
import { DOC_TYPE, STAGE_LABEL } from '../../../utils/jobWorkTracker/constants';
import { orderSplit } from '../../../utils/jobWorkTracker/splitFigures';
import { clone, latency, loadTrackerDb, mockError, todayIso } from './jobWorkTrackerStore';
import { jobContext } from './trackerMockContext';

/** A job makes the garment when it has a Work Order (sewing). Cutting-only, process and finishing-only jobs are processes. */
const makesGarments = (ctx) => ctx.docs.some((d) => d.docType === DOC_TYPE.WORK_ORDER);

export const listSplitOrders = () => {
  const db = loadTrackerDb();
  return latency(db.orders.map((o) => {
    const jobs = db.jobs.filter((j) => j.orderId === o.id);
    return {
      id: o.id, orderNo: o.orderNo, buyer: o.buyer, styleNo: o.styleNo, styleName: o.styleName, shipDate: o.shipDate,
      vendorJobs: jobs.length, hasInhouse: Boolean(db.inhouse?.[o.id]),
    };
  }));
};

export const getOrderSplit = (orderId) => {
  const db = loadTrackerDb();
  const today = todayIso();
  const order = db.orders.find((o) => o.id === Number(orderId));
  if (!order) return Promise.reject(mockError('Order not found.', { code: 'NOT_FOUND', status: 404 }));
  const jobs = db.jobs.filter((j) => j.orderId === order.id).map((job) => {
    const ctx = jobContext(db, job, today);
    const s = ctx.snapshot;
    return {
      jobId: job.id,
      jobNo: job.jobNo,
      status: job.status,
      vendorName: ctx.vendor.name,
      maker: makesGarments(ctx),
      stages: ctx.stages,
      stageLabels: ctx.stages.map((st) => STAGE_LABEL[st]),
      share: ctx.share,
      withdrawn: ctx.withdrawn,
      cells: s.cells,
      finalReceived: s.finalReceived,
      projectedDate: s.projectedDate,
      risk: s.risk,
      totals: s.totals,
      planTotals: s.planTotals,
      processName: ctx.docs.map((d) => d.processName).filter(Boolean).join(', ') || null,
    };
  });
  const split = orderSplit({ order, jobs, inhouse: db.inhouse?.[order.id] || {}, today });
  return latency(clone({
    order: { id: order.id, orderNo: order.orderNo, buyer: order.buyer, styleNo: order.styleNo, styleName: order.styleName, shipDate: order.shipDate },
    ...split,
  }));
};
