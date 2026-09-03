/**
 * Seed data for the PO–Order Mapping mock. Bump SEED_VERSION whenever the shape
 * or content changes — the store discards the persisted copy and reseeds.
 *
 * Every General PO here has already been accepted by the supplier; some are fully
 * received, some partly, one not at all (mapping ahead of receipt is allowed).
 * Each line carries the item's category: only Fabric, Trims and Accessories lines
 * are mapped, matched case-insensitively (see MAPPABLE_ITEM_CATEGORIES), so the
 * seed deliberately mixes casing. PO/26-27/1070 is packing material only, so it
 * never appears; PO/26-27/1068 mixes labels (Trims) with poly bags (Packing), so
 * only its label lines show.
 */
export const SEED_VERSION = 3;

const SUPPLIERS = [
  { id: 1, name: 'Arvind Mills Ltd' },
  { id: 2, name: 'Coats India' },
  { id: 3, name: 'YKK India Pvt Ltd' },
  { id: 4, name: 'Vardhman Textiles' },
  { id: 5, name: 'Uflex Packaging' },
];

const ORDERS = [
  { id: 101, orderNo: 'ORD/26-27/0212', buyerName: 'H&M Hennes & Mauritz', styleNo: 'ST-2026-0441', garmentName: "Men's Oxford Shirt", season: 'SS27', status: 'CONFIRMED', orderDate: '2026-08-12', totalOrderQty: 12000 },
  { id: 102, orderNo: 'ORD/26-27/0215', buyerName: 'Zara (Inditex)', styleNo: 'ST-2026-0457', garmentName: "Women's Linen Blouse", season: 'SS27', status: 'CONFIRMED', orderDate: '2026-08-18', totalOrderQty: 8500 },
  { id: 103, orderNo: 'ORD/26-27/0209', buyerName: 'Marks & Spencer', styleNo: 'ST-2026-0432', garmentName: "Kids' Twill Shorts", season: 'AW26', status: 'IN_PRODUCTION', orderDate: '2026-07-30', totalOrderQty: 15000 },
  { id: 104, orderNo: 'ORD/26-27/0220', buyerName: 'Uniqlo', styleNo: 'ST-2026-0461', garmentName: "Men's Chino Trouser", season: 'SS27', status: 'CONFIRMED', orderDate: '2026-08-27', totalOrderQty: 6000 },
  { id: 105, orderNo: 'ORD/26-27/0204', buyerName: 'Next Retail', styleNo: 'ST-2026-0418', garmentName: "Women's Denim Jacket", season: 'AW26', status: 'IN_PRODUCTION', orderDate: '2026-07-14', totalOrderQty: 4200 },
  { id: 106, orderNo: 'ORD/26-27/0223', buyerName: 'H&M Hennes & Mauritz', styleNo: 'ST-2026-0468', garmentName: "Men's Poplin Shirt", season: 'SS27', status: 'DRAFT', orderDate: '2026-09-01', totalOrderQty: 9000 },
  { id: 107, orderNo: 'ORD/26-27/0198', buyerName: 'Primark', styleNo: 'ST-2026-0402', garmentName: 'Basic Tee', season: 'AW26', status: 'COMPLETED', orderDate: '2026-06-20', totalOrderQty: 20000 },
];

const po = (id, poNumber, poDate, supplierId, status, deliveryDate, lineItems, extra = {}) => ({
  id,
  poNumber,
  poDate,
  supplierId,
  supplierName: SUPPLIERS.find((s) => s.id === supplierId).name,
  poType: 'General',
  status,
  deliveryDate,
  stockOnly: false,
  stockOnlyRemark: '',
  lineItems,
  version: 1,
  ...extra,
});

const line = (id, category, itemCode, description, color, size, uom, qty, receivedQty, unitPrice) => ({
  id, category, itemCode, description, color, size, uom, qty, receivedQty, unitPrice,
});

const POS = [
  po(5001, 'PO/26-27/1041', '2026-07-22', 1, 'Completed', '2026-08-10', [
    line(50011, 'Fabric', 'FAB-OXF-100', '100% Cotton Oxford 140 GSM', 'White', null, 'MTR', 4500, 4500, 185),
    line(50012, 'Fabric', 'FAB-OXF-100', '100% Cotton Oxford 140 GSM', 'Sky Blue', null, 'MTR', 3200, 3200, 185),
  ]),
  po(5002, 'PO/26-27/1046', '2026-07-28', 2, 'Completed', '2026-08-08', [
    line(50021, 'Trims', 'THR-PC-402', 'Poly-core Sewing Thread 40/2', 'White', null, 'CONE', 600, 600, 92),
    line(50022, 'Trims', 'THR-PC-402', 'Poly-core Sewing Thread 40/2', 'Navy', null, 'CONE', 400, 400, 92),
    line(50023, 'Trims', 'THR-PC-402', 'Poly-core Sewing Thread 40/2', 'Sky Blue', null, 'CONE', 250, 250, 92),
  ]),
  po(5003, 'PO/26-27/1052', '2026-08-04', 3, 'Partially_Received', '2026-08-25', [
    line(50031, 'Accessories', 'ZIP-YKK-5CN', 'YKK #5 Coil Zipper 18cm', 'Black', '18 cm', 'PCS', 16000, 9000, 14.5),
    line(50032, 'ACCESSORIES', 'BTN-4H-18L', '4-Hole Polyester Button 18L', 'Black', '18L', 'PCS', 40000, 40000, 1.2),
  ]),
  po(5004, 'PO/26-27/1057', '2026-08-11', 4, 'Completed', '2026-08-30', [
    line(50041, 'fabric', 'FAB-LIN-55', 'Linen 55/45 Cotton Blend 165 GSM', 'Natural', null, 'MTR', 6000, 6000, 240),
  ]),
  po(5005, 'PO/26-27/1060', '2026-08-14', 1, 'Completed', '2026-08-31', [
    line(50051, 'Fabric', 'FAB-DEN-12', '12 oz Indigo Denim', 'Indigo', null, 'MTR', 2800, 2800, 310),
  ], { stockOnly: true, stockOnlyRemark: 'Stock lot bought at year-end discount — hold for AW27 development.' }),
  po(5006, 'PO/26-27/1063', '2026-08-19', 4, 'Partially_Received', '2026-09-05', [
    line(50061, 'Fabric', 'FAB-TWL-98', 'Cotton Twill 98/2 Elastane 220 GSM', 'Khaki', null, 'MTR', 5200, 2600, 205),
    line(50062, 'Fabric', 'FAB-TWL-98', 'Cotton Twill 98/2 Elastane 220 GSM', 'Olive', null, 'MTR', 3000, 0, 205),
  ]),
  // Mixed PO: the label lines are Trims and show; the poly bag line is Packing and is hidden.
  po(5007, 'PO/26-27/1068', '2026-08-26', 2, 'Sent_To_Supplier', '2026-09-15', [
    line(50071, 'Trims', 'LBL-WVN-MAIN', 'Woven Main Label', null, null, 'PCS', 30000, 0, 0.9),
    line(50072, 'Trims', 'LBL-CARE-PR', 'Printed Care Label', null, null, 'PCS', 30000, 0, 0.35),
    line(50073, 'Packing', 'PKG-POLY-12', 'LDPE Poly Bag 12x16 in', 'Clear', '12x16', 'PCS', 30000, 0, 0.6),
  ]),
  po(5008, 'PO/26-27/1035', '2026-07-15', 3, 'Completed', '2026-08-02', [
    line(50081, 'accessories', 'ZIP-YKK-3CN', 'YKK #3 Coil Zipper 15cm', 'White', '15 cm', 'PCS', 5000, 5000, 11),
  ]),
  // Packing-only PO: never shown in the mapping screen.
  po(5009, 'PO/26-27/1070', '2026-08-28', 5, 'Sent_To_Supplier', '2026-09-12', [
    line(50091, 'Packing', 'PKG-CTN-5PLY', '5-Ply Export Carton 60x40x40', 'Kraft', '60x40x40', 'PCS', 1200, 0, 48),
    line(50092, 'Packing', 'PKG-TAPE-48', 'BOPP Packing Tape 48mm', 'Clear', '48 mm', 'ROLL', 300, 0, 32),
  ]),
];

const ALLOCATIONS = [
  // PO/26-27/1041 — fully mapped to the H&M oxford order
  { id: 9001, poId: 5001, poLineItemId: 50011, orderId: 101, qty: 4500, remarks: 'Bulk body fabric', mappedBy: 'Priya Nair', mappedOn: '2026-08-13 10:42' },
  { id: 9002, poId: 5001, poLineItemId: 50012, orderId: 101, qty: 3200, remarks: 'Second colourway', mappedBy: 'Priya Nair', mappedOn: '2026-08-13 10:44' },
  // PO/26-27/1046 — thread split across two orders, part left as free stock
  { id: 9003, poId: 5002, poLineItemId: 50021, orderId: 101, qty: 350, remarks: '', mappedBy: 'Priya Nair', mappedOn: '2026-08-13 11:02' },
  { id: 9004, poId: 5002, poLineItemId: 50021, orderId: 102, qty: 200, remarks: '', mappedBy: 'Karthik R', mappedOn: '2026-08-20 16:15' },
  { id: 9005, poId: 5002, poLineItemId: 50023, orderId: 101, qty: 250, remarks: 'Matches sky blue oxford', mappedBy: 'Priya Nair', mappedOn: '2026-08-13 11:05' },
  // PO/26-27/1052 — only the buttons are mapped so far
  { id: 9006, poId: 5003, poLineItemId: 50032, orderId: 103, qty: 40000, remarks: '', mappedBy: 'Karthik R', mappedOn: '2026-08-28 09:30' },
];

const AUDIT = [
  { id: 1, at: '2026-08-13 10:42', by: 'Priya Nair', poId: 5001, poNumber: 'PO/26-27/1041', action: 'Mapped', details: '4,500 MTR of FAB-OXF-100 White → ORD/26-27/0212' },
  { id: 2, at: '2026-08-13 10:44', by: 'Priya Nair', poId: 5001, poNumber: 'PO/26-27/1041', action: 'Mapped', details: '3,200 MTR of FAB-OXF-100 Sky Blue → ORD/26-27/0212' },
  { id: 3, at: '2026-08-13 11:02', by: 'Priya Nair', poId: 5002, poNumber: 'PO/26-27/1046', action: 'Mapped', details: '350 CONE of THR-PC-402 White → ORD/26-27/0212' },
  { id: 4, at: '2026-08-13 11:05', by: 'Priya Nair', poId: 5002, poNumber: 'PO/26-27/1046', action: 'Mapped', details: '250 CONE of THR-PC-402 Sky Blue → ORD/26-27/0212' },
  { id: 5, at: '2026-08-20 16:15', by: 'Karthik R', poId: 5002, poNumber: 'PO/26-27/1046', action: 'Mapped', details: '200 CONE of THR-PC-402 White → ORD/26-27/0215' },
  { id: 6, at: '2026-08-28 09:30', by: 'Karthik R', poId: 5003, poNumber: 'PO/26-27/1052', action: 'Mapped', details: '40,000 PCS of BTN-4H-18L Black → ORD/26-27/0209' },
  { id: 7, at: '2026-09-01 14:10', by: 'Priya Nair', poId: 5005, poNumber: 'PO/26-27/1060', action: 'Marked Stock Only', details: 'Stock lot bought at year-end discount — hold for AW27 development.' },
];

export const buildSeedDb = () => JSON.parse(JSON.stringify({
  seedVersion: SEED_VERSION,
  suppliers: SUPPLIERS,
  orders: ORDERS,
  pos: POS,
  allocations: ALLOCATIONS,
  audit: AUDIT,
  nextId: 10000,
}));
