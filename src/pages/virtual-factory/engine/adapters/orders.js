import { dayOf, first, minDay, num, sum, text, unique } from '../util.js';

/** Order statuses the factory is still working on (mirrors utils/orderConstants ORDER_STATUS). */
const OPEN_STATUSES = new Set(['CONFIRMED', 'IN_PRODUCTION', 'REFER_BACK_REQUESTED', 'CANCEL_REQUESTED']);

export const isOpenOrder = (order) => OPEN_STATUSES.has(order.status);

const adaptLine = (line) => ({
  buyerPoNo: text(line.buyerPoNo),
  destination: text(line.destination),
  originalDue: dayOf(line.dispatchDate),
  due: dayOf(line.revisedDispatchDate) || dayOf(line.dispatchDate),
  qty: num(line.lineQty),
  colours: (line.colorRows || []).map((row) => text(row.colorName)).filter(Boolean),
});

/** One OrderDTO row from /orders/search. */
export const adaptOrder = (raw) => {
  const lines = (raw.orderLines || []).map(adaptLine);
  const originalDue = minDay(lines.map((l) => l.originalDue));
  return {
    id: raw.id,
    no: text(raw.orderNo),
    status: text(raw.status),
    buyer: text(raw.buyerName),
    style: text(raw.styleNo),
    garment: text(first(raw.garmentName, raw.garmentType)),
    orderType: text(raw.orderType),
    qty: num(raw.totalOrderQty) || sum(lines, (l) => l.qty),
    value: num(raw.totalOrderValue),
    orderDate: dayOf(raw.orderDate),
    originalDue,
    due: minDay(lines.map((l) => l.due)) || originalDue,
    delayDays: num(raw.dispatchDelayDays),
    delaySource: text(raw.dispatchDelaySource),
    destination: unique(lines.map((l) => l.destination)).join(', '),
    colours: unique(lines.flatMap((l) => l.colours)),
    lines,
  };
};

export const adaptOrders = (page) => (page?.content || [])
  .map(adaptOrder)
  .filter((order) => order.no && order.orderType !== 'SAMPLE');
