/**
 * Mock order context for the process requirement screens (UI design phase).
 *
 * Shaped like the real production lookup (erp/production/common/dto/EligibleOrderDTO:
 * orderNo, styleNo, buyer, bomId, bomNo, allowancePercent, items[{ color, size,
 * orderQty }]) — already merged across order lines — so the API swap is mechanical.
 * Fields the live modules do NOT have yet are marked MOCK-ONLY; they are the open
 * points of the "API-phase data contract" (order allowance, BOM approval + versions,
 * colour codes, fabric → colour mapping).
 */

const matrix = (rows, sizes) =>
  Object.entries(rows).flatMap(([color, qtys]) =>
    sizes.map((size, i) => ({ color, size, orderQty: qtys[i] || 0 })));

const SINGLE_JERSEY = {
  id: 'FAB-SJ-160', code: 'FAB-SJ-160', name: 'Single Jersey',
  composition: '100% Cotton', gsm: 160, consumption: 0.215, uom: 'kg',
};

const ORDERS = [
  {
    // PRD appendix order: 2,600 pcs, 2% allowance. Black 4Y = 220 → 225 at 2%;
    // Black totals 798, which reproduces the appendix CPR (816 / 825 / 714 → 5,415).
    id: 125, orderNo: 'ORD-2026-00125', buyer: 'JOMO BV', styleNo: 'ST-4471',
    garmentDescription: 'Infant full sleeve bodysuit', season: 'SS27',
    orderDate: '2026-08-18', deliveryDate: '2026-11-20', status: 'CONFIRMED', orderLineCount: 1,
    allowancePercent: 2, // MOCK-ONLY: orders carry no allowance today
    sizes: ['2Y', '4Y', '6Y', '8Y'],
    colors: [ // MOCK-ONLY code / hex: OrderLineColor has colorName only
      { name: 'Black', code: 'BLK', hex: '#1f1f1f' },
      { name: 'Red', code: 'RED', hex: '#c62828' },
      { name: 'White', code: 'WHT', hex: '#f4f4f4' },
      { name: 'Navy', code: 'NVY', hex: '#1a237e' },
    ],
    items: matrix({
      Black: [167, 220, 167, 244], Red: [175, 175, 175, 173],
      White: [138, 138, 138, 138], Navy: [138, 138, 138, 138],
    }, ['2Y', '4Y', '6Y', '8Y']),
    bomId: 9125, bomNo: 'BOM-ORD-2026-00125',
    bomVersions: [ // MOCK-ONLY: BOM has no approval or version number today
      { version: 'V1', approved: true, fabrics: [{ ...SINGLE_JERSEY, gsm: 155, consumption: 0.22, colors: ['Black', 'Red', 'White', 'Navy'] }] },
      {
        version: 'V2', approved: true,
        fabrics: [
          { ...SINGLE_JERSEY, colors: ['Black', 'Red', 'White', 'Navy'] },
          { id: 'FAB-RIB-220', code: 'FAB-RIB-220', name: '1x1 Rib', composition: '95% Cotton 5% Elastane', gsm: 220, consumption: 0.018, uom: 'kg', colors: ['Black', 'Red', 'White', 'Navy'] },
          { id: 'FAB-INT-200', code: 'FAB-INT-200', name: 'Interlock', composition: '100% Cotton', gsm: 200, consumption: 0.05, uom: 'kg', colors: ['Black', 'Navy'] },
        ],
      },
    ],
  },
  {
    // GPR example: 10,000 pcs. Navy 5-6Y = 600, so lowering it to 450 gives 6,850.
    id: 418, orderNo: 'ORD-2026-0418', buyer: 'Northwind Kids', styleNo: 'NK-2231',
    garmentDescription: 'Kids garment-washed jogger', season: 'AW27',
    orderDate: '2026-08-02', deliveryDate: '2026-12-05', status: 'CONFIRMED', orderLineCount: 1,
    allowancePercent: 3,
    sizes: ['3-4Y', '5-6Y', '7-8Y', '9-10Y'],
    colors: [
      { name: 'Black', code: 'BLK', hex: '#1f1f1f' },
      { name: 'Navy', code: 'NVY', hex: '#1a237e' },
      { name: 'White', code: 'WHT', hex: '#f4f4f4' },
    ],
    items: matrix({
      Black: [900, 1100, 1000, 1000], Navy: [700, 600, 850, 850], White: [700, 800, 750, 750],
    }, ['3-4Y', '5-6Y', '7-8Y', '9-10Y']),
    bomId: 9418, bomNo: 'BOM-ORD-2026-0418',
    bomVersions: [
      { version: 'V1', approved: true, fabrics: [{ id: 'FAB-FT-280', code: 'FAB-FT-280', name: 'French Terry', composition: '100% Cotton', gsm: 280, consumption: 0.38, uom: 'kg', colors: ['Black', 'Navy', 'White'] }] },
    ],
  },
  {
    // Two order lines (EU, US) merged; Olive has no XL, so that cell is 0 (N/A).
    id: 502, orderNo: 'ORD-2026-0502', buyer: 'Harbor & Co', styleNo: 'HB-7710',
    garmentDescription: 'Ladies pique polo', season: 'SS27',
    orderDate: '2026-09-01', deliveryDate: '2027-01-15', status: 'IN_PRODUCTION', orderLineCount: 2,
    allowancePercent: 2.5,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: [
      { name: 'Sky Blue', code: 'SKB', hex: '#6fa8dc' },
      { name: 'Olive', code: 'OLV', hex: '#6b7b3a' },
    ],
    items: matrix({ 'Sky Blue': [300, 550, 450, 100], Olive: [200, 250, 250, 0] }, ['S', 'M', 'L', 'XL']),
    bomId: 9502, bomNo: 'BOM-ORD-2026-0502',
    bomVersions: [
      {
        version: 'V1', approved: true,
        fabrics: [
          { id: 'FAB-PQ-210', code: 'FAB-PQ-210', name: 'Pique', composition: '100% Cotton', gsm: 210, consumption: 0.29, uom: 'kg', colors: ['Sky Blue', 'Olive'] },
          { id: 'FAB-TR-240', code: 'FAB-TR-240', name: 'Tipping Rib', composition: '100% Cotton', gsm: 240, consumption: 0.03, uom: 'kg', colors: ['Sky Blue'] },
        ],
      },
    ],
  },
  {
    // Confirmed, but its BOM is not approved yet: Garment Process only (CPR needs an approved BOM).
    id: 450, orderNo: 'ORD-2026-0450', buyer: 'Harbor & Co', styleNo: 'HB-7802',
    garmentDescription: 'Men\'s oxford shirt', season: 'SS27',
    orderDate: '2026-09-10', deliveryDate: '2027-02-10', status: 'CONFIRMED', orderLineCount: 1,
    allowancePercent: 2,
    sizes: ['S', 'M', 'L'],
    colors: [{ name: 'White', code: 'WHT', hex: '#f4f4f4' }],
    items: matrix({ White: [400, 600, 500] }, ['S', 'M', 'L']),
    bomId: 9450, bomNo: 'BOM-ORD-2026-0450',
    bomVersions: [{ version: 'V1', approved: false, fabrics: [] }],
  },
  {
    id: 377, orderNo: 'ORD-2026-0377', buyer: 'JOMO BV', styleNo: 'ST-4390',
    garmentDescription: 'Infant romper', season: 'SS27',
    orderDate: '2026-07-11', deliveryDate: '2026-10-30', status: 'CANCELLED', orderLineCount: 1,
    allowancePercent: 2,
    sizes: ['2Y', '4Y'],
    colors: [{ name: 'Pink', code: 'PNK', hex: '#f48fb1' }],
    items: matrix({ Pink: [300, 300] }, ['2Y', '4Y']),
    bomId: 9377, bomNo: 'BOM-ORD-2026-0377',
    bomVersions: [{ version: 'V1', approved: true, fabrics: [{ ...SINGLE_JERSEY, colors: ['Pink'] }] }],
  },
];

const LIVE = ['CONFIRMED', 'IN_PRODUCTION'];

/** { color: { size: qty } } from the flat items list. */
const toQtyMatrix = (items) => items.reduce((acc, { color, size, orderQty }) => {
  acc[color] = { ...(acc[color] || {}), [size]: orderQty };
  return acc;
}, {});

/**
 * Everything a requirement screen shows about an order: header, colours with their
 * order qty, sizes in order sequence, the colour × size matrix, and the approved BOM
 * versions (latest last).
 */
export const buildOrderContext = (order) => {
  const qtyMatrix = toQtyMatrix(order.items);
  const colors = order.colors.map((c) => ({
    ...c,
    qty: order.sizes.reduce((s, size) => s + (qtyMatrix[c.name]?.[size] || 0), 0),
  }));
  const totalQty = colors.reduce((s, c) => s + c.qty, 0);
  const approvedBoms = order.bomVersions.filter((v) => v.approved);
  return {
    ...order,
    qtyMatrix,
    colors,
    totalQty,
    approvedBoms,
    latestBomVersion: approvedBoms[approvedBoms.length - 1]?.version || null,
  };
};

const find = (orderId) => ORDERS.find((o) => o.id === Number(orderId));

export const getMockOrderContext = (orderId) => {
  const order = find(orderId);
  return order ? buildOrderContext(order) : null;
};

const option = (o) => ({ id: o.id, orderNo: o.orderNo, styleNo: o.styleNo, buyer: o.buyer });

/** Cut Panel: live orders with at least one approved BOM version (BR-04). */
export const getMockCprEligibleOrders = () =>
  ORDERS.filter((o) => LIVE.includes(o.status) && o.bomVersions.some((v) => v.approved)).map(option);

/** Garment Process: confirmed, non-cancelled orders (the BOM is not read). */
export const getMockGprEligibleOrders = () => ORDERS.filter((o) => LIVE.includes(o.status)).map(option);
