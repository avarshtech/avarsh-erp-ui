import { fabricColour } from '../colours.js';
import { dayOf, num, sum, text, unique } from '../util.js';

/** One decorated packing entry (/packing/entries, through utils/packingEntryIssues.decorateEntry). */
export const adaptPackingEntry = (raw) => {
  const groups = raw.groups || [];
  const destinations = unique(groups.map((g) => text(g.destination)));
  const colours = unique(groups.map((g) => text(g.colorName)));
  return {
    id: raw.id,
    no: text(raw.packingNo),
    orderId: raw.orderId ?? null,
    orderNo: text(raw.orderNo),
    buyer: text(raw.buyerName),
    style: text(raw.styleNo),
    garment: text(raw.garmentName),
    date: dayOf(raw.packingDate),
    status: text(raw.status),
    cartons: num(raw.distinctCartons) || sum(groups, (g) => g.cartonCount),
    pieces: sum(groups, (g) => g.totalPieces),
    destination: destinations.join(', '),
    destinations,
    colours,
    hex: fabricColour(colours[0]),
    buyerPos: unique(groups.map((g) => text(g.buyerPoNo))),
  };
};

export const adaptPacking = ({ entries, dailySummary }, today) => {
  const list = (entries || []).map(adaptPackingEntry).filter((e) => e.no);
  const todayRows = dailySummary || [];
  const todayFromEntries = list.filter((e) => e.date === today);
  return {
    open: list.filter((e) => e.status === 'OPEN'),
    completed: list.filter((e) => e.status === 'COMPLETED'),
    today: {
      cartons: todayRows.length ? sum(todayRows, (r) => r.cartons) : sum(todayFromEntries, (e) => e.cartons),
      pieces: todayRows.length ? sum(todayRows, (r) => r.pieces) : sum(todayFromEntries, (e) => e.pieces),
    },
    byOrder: list.reduce((map, e) => map.set(e.orderNo, (map.get(e.orderNo) || 0) + e.pieces), new Map()),
  };
};

/**
 * Finished goods waiting to ship: completed packing whose order is still open. The ERP has no
 * carton-to-shipment link yet, so an order's cartons leave the racks when the order completes.
 */
export const finishedGoods = (packing, orders) => {
  const closed = new Set(orders.filter((o) => o.status === 'COMPLETED' || o.status === 'CANCELLED').map((o) => o.no));
  const waiting = packing.completed.filter((e) => !closed.has(e.orderNo));
  const byDestination = new Map();
  waiting.forEach((e) => {
    const key = e.destinations[0] || 'Destination not set';
    byDestination.set(key, (byDestination.get(key) || 0) + e.cartons);
  });
  return {
    entries: waiting,
    cartons: sum(waiting, (e) => e.cartons),
    pieces: sum(waiting, (e) => e.pieces),
    byDestination: [...byDestination.entries()].map(([destination, cartons]) => ({ destination, cartons }))
      .sort((a, b) => b.cartons - a.cartons),
  };
};
