import { dayOf, num, text } from '../util.js';

export const PRODUCTION_ORDER_KINDS = {
  CUTTING_PO: { label: 'Cutting PO', zone: 'cutting' },
  WORK_ORDER: { label: 'Work Order', zone: 'sewing' },
  FINISHING_PO: { label: 'Finishing PO', zone: 'finishing' },
};

const common = (raw, kind, no) => ({
  key: `${kind}-${raw.id}`,
  id: raw.id,
  kind,
  no: text(no),
  orderNo: text(raw.orderNo),
  style: text(raw.styleNo),
  buyer: text(raw.buyer),
  orderQty: num(raw.totalOrderQty),
  plannedQty: num(raw.totalPlannedQty),
  status: text(raw.status),
  unit: text(raw.processingUnitName),
  approvedAt: text(raw.approvedDate),
  updatedAt: text(raw.updatedAt),
});

/** Cutting POs, Work Orders and Finishing POs: the planning documents behind the floor's work. */
export const adaptProductionOrders = ({ cuttingPos, workOrders, finishingPos }) => [
  ...(cuttingPos?.content || []).map((raw) => ({
    ...common(raw, 'CUTTING_PO', raw.cuttingPoNo),
    inHouse: raw.processingUnitType !== 'VENDOR',
    start: dayOf(raw.plannedCutDate),
    end: dayOf(raw.plannedDeliveryDate),
  })),
  ...(workOrders?.content || []).map((raw) => ({
    ...common(raw, 'WORK_ORDER', raw.workOrderNo),
    inHouse: raw.processingUnitType !== 'VENDOR',
    line: text(raw.sewingLineId),
    targetPerDay: num(raw.targetDailyOutput),
    start: dayOf(raw.plannedStartDate),
    end: dayOf(raw.plannedEndDate),
  })),
  ...(finishingPos?.content || []).map((raw) => ({
    ...common(raw, 'FINISHING_PO', raw.finishingPoNo),
    inHouse: !raw.isOutsourced,
    vendor: text(raw.vendorName),
    start: dayOf(raw.plannedStartDate),
    end: dayOf(raw.plannedEndDate),
  })),
].filter((po) => po.no && po.status !== 'CANCELLED' && po.status !== 'REJECTED');
