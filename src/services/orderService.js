/**
 * Order Service (In-Memory)
 * Promise-based API for CRUD operations on orders.
 * Uses the same response shape as the real backend API so switching later is trivial.
 */

import { ORDER_STATUS } from '../utils/orderConstants';

// ==================== SEED DATA ====================

let nextId = 3;

const orders = [
  {
    id: 1,
    orderNo: 'SG/25-26/1001',
    status: ORDER_STATUS.CONFIRMED,
    buyerId: 7,
    buyerName: 'Van Gennip Textiles B.V.',
    entryDate: '2025-07-07',
    orderDate: '2025-07-07',
    shipDate: '2025-10-15',
    leadTime: 100,
    styleNo: 'N58070-1LU',
    garmentType: 'Blouses',
    currency: 'USD',
    shipmentMode: 'Sea',
    deliveryTerms: 'FOB',
    allowance: '2%',
    paymentTerms: 'Days Nett',
    paymentDays: 60,
    remarks: 'SR / FOB first order',
    totalOrderQty: 3000,
    totalOrderValue: 8040.0,
    orderLines: [
      {
        key: 'line_1',
        buyerPoNo: '3351',
        styleNo: 'N58070-1LU',
        description: 'Blouse ss',
        itemGroup: 'Blouses',
        destination: 'Van Gennip Textiles, Celsiusstraat 2, 6003 DG Weert, Nederland',
        basePrice: 2.3,
        dispatchDate: '2025-10-15',
        fabric: '100% Cotton',
        material: 'Woven',
        gsm: 110,
        season: 'Spring/Summer 2026',
        brand: 'Private Label',
        collection: 'SS/26',
        sizePreset: 'KIDS_NUMERIC',
        sizes: ['2/3Y', '3/4Y', '5/6Y', '7/8Y'],
        sizePrices: { '2/3Y': 2.3, '3/4Y': 2.3, '5/6Y': 2.3, '7/8Y': 2.3 },
        colorRows: [
          {
            key: 'c1',
            colorName: '50x LULU 2/3-7/8 GI',
            quantities: { '2/3Y': 50, '3/4Y': 150, '5/6Y': 200, '7/8Y': 200 },
            total: 600,
            rowValue: 1380.0,
          },
        ],
        lineQty: 600,
        lineTotal: 1380.0,
      },
      {
        key: 'line_2',
        buyerPoNo: '3351',
        styleNo: 'N58115-1LU',
        description: 'Dress ss',
        itemGroup: 'Dresses',
        destination: 'Van Gennip Textiles, Celsiusstraat 2, 6003 DG Weert, Nederland',
        basePrice: 2.85,
        dispatchDate: '2025-10-15',
        fabric: '100% Cotton',
        material: 'Woven',
        gsm: 150,
        season: 'Spring/Summer 2026',
        brand: 'Private Label',
        collection: 'SS/26',
        sizePreset: 'KIDS_NUMERIC',
        sizes: ['2/3Y', '3/4Y', '5/6Y', '7/8Y'],
        sizePrices: { '2/3Y': 2.85, '3/4Y': 2.85, '5/6Y': 2.85, '7/8Y': 2.85 },
        colorRows: [
          {
            key: 'c2',
            colorName: '50x LULU 2/3-7/8 GI',
            quantities: { '2/3Y': 50, '3/4Y': 150, '5/6Y': 200, '7/8Y': 200 },
            total: 600,
            rowValue: 1710.0,
          },
        ],
        lineQty: 600,
        lineTotal: 1710.0,
      },
      {
        key: 'line_3',
        buyerPoNo: '3351',
        styleNo: 'N58120-1LU',
        description: '2-pc Set ss',
        itemGroup: '2-pcs/Sets',
        destination: 'Van Gennip Textiles, Celsiusstraat 2, 6003 DG Weert, Nederland',
        basePrice: 3.1,
        dispatchDate: '2025-10-15',
        fabric: '100% Cotton',
        material: 'Woven',
        gsm: 130,
        season: 'Spring/Summer 2026',
        brand: 'Private Label',
        collection: 'SS/26',
        sizePreset: 'KIDS_NUMERIC',
        sizes: ['2/3Y', '3/4Y', '5/6Y', '7/8Y'],
        sizePrices: { '2/3Y': 3.1, '3/4Y': 3.1, '5/6Y': 3.1, '7/8Y': 3.1 },
        colorRows: [
          {
            key: 'c3',
            colorName: '50x LULU 2/3-7/8 GI',
            quantities: { '2/3Y': 50, '3/4Y': 150, '5/6Y': 200, '7/8Y': 200 },
            total: 600,
            rowValue: 1860.0,
          },
        ],
        lineQty: 600,
        lineTotal: 1860.0,
      },
      {
        key: 'line_4',
        buyerPoNo: '3351',
        styleNo: 'N58130-1LU',
        description: 'Trousers ss',
        itemGroup: 'Trousers',
        destination: 'Van Gennip Textiles, Celsiusstraat 2, 6003 DG Weert, Nederland',
        basePrice: 2.15,
        dispatchDate: '2025-10-15',
        fabric: '100% Cotton',
        material: 'Woven',
        gsm: 140,
        season: 'Spring/Summer 2026',
        brand: 'Private Label',
        collection: 'SS/26',
        sizePreset: 'KIDS_NUMERIC',
        sizes: ['2/3Y', '3/4Y', '5/6Y', '7/8Y'],
        sizePrices: { '2/3Y': 2.15, '3/4Y': 2.15, '5/6Y': 2.15, '7/8Y': 2.15 },
        colorRows: [
          {
            key: 'c4',
            colorName: '50x LULU 2/3-7/8 GI',
            quantities: { '2/3Y': 50, '3/4Y': 150, '5/6Y': 200, '7/8Y': 200 },
            total: 600,
            rowValue: 1290.0,
          },
        ],
        lineQty: 600,
        lineTotal: 1290.0,
      },
      {
        key: 'line_5',
        buyerPoNo: '3351',
        styleNo: 'N58140-1LU',
        description: 'Dress print ss',
        itemGroup: 'Dresses',
        destination: 'Van Gennip Textiles, Celsiusstraat 2, 6003 DG Weert, Nederland',
        basePrice: 3.0,
        dispatchDate: '2025-10-15',
        fabric: '100% Cotton',
        material: 'Woven',
        gsm: 120,
        season: 'Spring/Summer 2026',
        brand: 'Private Label',
        collection: 'SS/26',
        sizePreset: 'KIDS_NUMERIC',
        sizes: ['2/3Y', '3/4Y', '5/6Y', '7/8Y'],
        sizePrices: { '2/3Y': 3.0, '3/4Y': 3.0, '5/6Y': 3.0, '7/8Y': 3.0 },
        colorRows: [
          {
            key: 'c5',
            colorName: '50x LULU 2/3-7/8 GI',
            quantities: { '2/3Y': 50, '3/4Y': 150, '5/6Y': 200, '7/8Y': 200 },
            total: 600,
            rowValue: 1800.0,
          },
        ],
        lineQty: 600,
        lineTotal: 1800.0,
      },
    ],
    createdAt: '2025-07-07T10:00:00Z',
  },
  {
    id: 2,
    orderNo: 'SG/25-26/1002',
    status: ORDER_STATUS.DRAFT,
    buyerId: 1,
    buyerName: 'H&M',
    entryDate: '2025-08-15',
    orderDate: '2025-08-15',
    shipDate: '2025-12-01',
    leadTime: 108,
    currency: 'EUR',
    shipmentMode: 'Sea',
    deliveryTerms: 'FOB',
    allowance: '3%',
    paymentTerms: 'LC',
    paymentDays: 90,
    remarks: 'Spring collection - priority shipment',
    totalOrderQty: 1800,
    totalOrderValue: 7740.0,
    orderLines: [
      {
        key: 'line_1',
        buyerPoNo: 'HM-2025-4521',
        styleNo: 'HM-BL-001',
        description: 'Basic T-Shirt',
        itemGroup: 'T-Shirts',
        destination: 'H&M Warehouse, Hamburg, Germany',
        basePrice: 3.5,
        dispatchDate: '2025-12-01',
        fabric: '100% Cotton',
        material: 'Knit',
        gsm: 160,
        season: 'Spring/Summer 2026',
        brand: 'H&M Basics',
        collection: 'SS/26',
        sizePreset: 'ALPHA',
        sizes: ['S', 'M', 'L', 'XL'],
        sizePrices: { S: 3.5, M: 3.5, L: 3.5, XL: 3.5 },
        colorRows: [
          {
            key: 'c1',
            colorName: 'White',
            quantities: { S: 100, M: 150, L: 150, XL: 100 },
            total: 500,
            rowValue: 1750.0,
          },
          {
            key: 'c2',
            colorName: 'Black',
            quantities: { S: 100, M: 150, L: 150, XL: 100 },
            total: 500,
            rowValue: 1750.0,
          },
        ],
        lineQty: 1000,
        lineTotal: 3500.0,
      },
      {
        key: 'line_2',
        buyerPoNo: 'HM-2025-4521',
        styleNo: 'HM-PL-002',
        description: 'Polo Shirt',
        itemGroup: 'Polo',
        destination: 'H&M Distribution Center, Rotterdam, Netherlands',
        basePrice: 5.3,
        dispatchDate: '2025-12-01',
        fabric: 'Cotton/Polyester Blend',
        material: 'Knit',
        gsm: 200,
        season: 'Spring/Summer 2026',
        brand: 'H&M Premium',
        collection: 'SS/26',
        sizePreset: 'ALPHA',
        sizes: ['S', 'M', 'L', 'XL'],
        sizePrices: { S: 5.3, M: 5.3, L: 5.3, XL: 5.3 },
        colorRows: [
          {
            key: 'c3',
            colorName: 'Navy Blue',
            quantities: { S: 80, M: 120, L: 120, XL: 80 },
            total: 400,
            rowValue: 2120.0,
          },
          {
            key: 'c4',
            colorName: 'Forest Green',
            quantities: { S: 80, M: 120, L: 120, XL: 80 },
            total: 400,
            rowValue: 2120.0,
          },
        ],
        lineQty: 800,
        lineTotal: 4240.0,
      },
    ],
    createdAt: '2025-08-15T09:30:00Z',
  },
];

// ==================== HELPERS ====================

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== CRUD OPERATIONS ====================

/**
 * Search orders with filters
 * @param {Object} params
 * @returns {Promise<Object>} Paginated response { content, totalElements, totalPages, size, number }
 */
export const searchOrders = async (params = {}) => {
  await delay();

  let filtered = [...orders];

  // Text search
  if (params.search) {
    const term = params.search.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.orderNo?.toLowerCase().includes(term) ||
        o.buyerName?.toLowerCase().includes(term) ||
        o.orderLines?.some(
          (l) =>
            l.styleNo?.toLowerCase().includes(term) ||
            l.buyerPoNo?.toLowerCase().includes(term)
        )
    );
  }

  // Status filter
  if (params.status) {
    filtered = filtered.filter((o) => o.status === params.status);
  }

  // Order date range
  if (params.orderDateStart) {
    filtered = filtered.filter((o) => o.orderDate >= params.orderDateStart);
  }
  if (params.orderDateEnd) {
    filtered = filtered.filter((o) => o.orderDate <= params.orderDateEnd);
  }

  // Sort
  const sortField = params.sort || 'id';
  const sortDir = params.direction === 'asc' ? 1 : -1;
  filtered.sort((a, b) => {
    const av = a[sortField];
    const bv = b[sortField];
    if (av < bv) return -1 * sortDir;
    if (av > bv) return 1 * sortDir;
    return 0;
  });

  // Pagination
  const page = params.page || 0;
  const size = params.size || 10;
  const start = page * size;
  const content = filtered.slice(start, start + size);

  return {
    content,
    totalElements: filtered.length,
    totalPages: Math.ceil(filtered.length / size),
    size,
    number: page,
  };
};

/**
 * Get order by ID
 */
export const getOrderById = async (id) => {
  await delay();
  const order = orders.find((o) => o.id === Number(id));
  if (!order) throw new Error(`Order with id ${id} not found`);
  return { ...order };
};

/**
 * Create a new order
 */
export const createOrder = async (data) => {
  await delay();
  const newOrder = {
    ...data,
    id: nextId++,
    createdAt: new Date().toISOString(),
  };
  orders.unshift(newOrder);
  return { ...newOrder };
};

/**
 * Update an existing order
 */
export const updateOrder = async (id, data) => {
  await delay();
  const index = orders.findIndex((o) => o.id === Number(id));
  if (index === -1) throw new Error(`Order with id ${id} not found`);
  orders[index] = { ...orders[index], ...data, updatedAt: new Date().toISOString() };
  return { ...orders[index] };
};

/**
 * Delete an order
 */
export const deleteOrder = async (id) => {
  await delay();
  const index = orders.findIndex((o) => o.id === Number(id));
  if (index === -1) throw new Error(`Order with id ${id} not found`);
  orders.splice(index, 1);
};

export default {
  searchOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
};
