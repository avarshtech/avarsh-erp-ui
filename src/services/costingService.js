/**
 * Costing Service (In-Memory Mock)
 * Promise-based API for CRUD operations on cost sheets.
 * Uses the same response shape as the real backend API so switching later is trivial.
 */

import { COSTING_STATUS, generateCostingId } from '../utils/costingConstants';

// ==================== SEED DATA ====================

let nextId = 4;

const costSheets = [
  {
    id: 1,
    costingId: 'CST/25-26/1001',
    status: COSTING_STATUS.APPROVED,
    date: '2025-12-10',
    buyerId: 7,
    buyerName: 'Van Gennip Textiles B.V.',
    styleNo: 'N58070-1LU',
    garmentName: 'Blouse SS Ladies',
    season: 'SS26',
    currency: 'INR',
    quoteCurrency: 'USD',
    actualRate: 84.50,
    todaysRate: 83.80,
    sizes: ['S', 'M', 'L', 'XL'],
    attachments: [],
    fabricRows: [
      { key: 'f1', fabricType: '100% Cotton', classification: 'Woven', description: 'Poplin 60×60', consumption: 1.45, fabricPrice: 185, fabricWidthStd: '58"', fabricWidthVendor: '58"', vendorId: 1, vendorName: 'Arvind Mills', allowancePct: 3, netCost: 276.58 },
      { key: 'f2', fabricType: 'Cotton/Polyester Blend', classification: 'Woven', description: 'Lining 80×80', consumption: 0.60, fabricPrice: 95, fabricWidthStd: '44"', fabricWidthVendor: '44"', vendorId: 2, vendorName: 'Raymond Textiles', allowancePct: 2, netCost: 58.14 },
    ],
    localTrims: [
      { key: 'lt1', item: 'Main Label', code: '4FF-ML-001', size: '', consumption: 1, cost: 3.50, price: 3.50 },
      { key: 'lt2', item: 'Size Label', code: '4FF-SL-001', size: '', consumption: 1, cost: 1.50, price: 1.50 },
      { key: 'lt3', item: 'Care Label', code: '4FF-CL-001', size: '', consumption: 1, cost: 2.00, price: 2.00 },
      { key: 'lt4', item: 'Polybag', code: 'PB-12x16', size: '12x16', consumption: 1, cost: 4.00, price: 4.00 },
      { key: 'lt5', item: 'Hangtag', code: 'HT-VG-01', size: '', consumption: 1, cost: 5.00, price: 5.00 },
    ],
    importedTrims: [
      { key: 'it1', item: 'Metal Tag', code: 'MT-BRS-01', size: '15MM', consumption: 1, costUsd: 0.15, priceUsd: 0.15 },
      { key: 'it2', item: 'Plastic Button', code: 'PB-WHT-10', size: '10MM', consumption: 6, costUsd: 0.05, priceUsd: 0.30 },
    ],
    manufacturingRows: [
      { key: 'm1', process: 'CMT', cost: 85.00, comments: 'Standard CMT rate' },
      { key: 'm2', process: 'Washing', cost: 12.00, comments: 'Enzyme wash' },
      { key: 'm3', process: 'Ironing/Packing', cost: 8.00, comments: '' },
    ],
    overheadRows: [
      { key: 'o1', description: 'Testing Charges', cost: 5.00, comments: 'AQL inspection' },
      { key: 'o2', description: 'Transport', cost: 8.00, comments: 'Factory to port' },
      { key: 'o3', description: 'Documentation', cost: 3.00, comments: '' },
    ],
    agentCommissionPct: 5,
    profitPct: 10,
    targetPrice: '',
    // Computed summary (stored for listing display)
    totalFabricCost: 334.72,
    totalLocalTrimsCost: 16.00,
    totalImportedTrimsCostUsd: 0.45,
    totalAccessoriesCost: 54.03,
    totalManufacturingCost: 105.00,
    totalMarkupCost: 16.00,
    totalMakingPrice: 509.75,
    totalOverheadCharges: 76.46,
    totalPrice: 586.21,
    finalPrice: 6.94,
    createdAt: '2025-12-10T10:00:00Z',
  },
  {
    id: 2,
    costingId: 'CST/25-26/1002',
    status: COSTING_STATUS.FINAL,
    date: '2026-01-15',
    buyerId: 1,
    buyerName: 'H&M',
    styleNo: 'HM-BL-001',
    garmentName: 'Basic T-Shirt Mens',
    season: 'SS26',
    currency: 'INR',
    quoteCurrency: 'EUR',
    actualRate: 90.20,
    todaysRate: 89.90,
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    attachments: [],
    fabricRows: [
      { key: 'f1', fabricType: '100% Cotton', classification: 'Knits', description: 'Single Jersey 160 GSM', consumption: 0.28, fabricPrice: 320, fabricWidthStd: '72"', fabricWidthVendor: '72"', vendorId: 3, vendorName: 'Tirupur Knits Ltd', allowancePct: 5, netCost: 94.08 },
    ],
    localTrims: [
      { key: 'lt1', item: 'Main Label', code: 'HM-ML-01', size: '', consumption: 1, cost: 4.00, price: 4.00 },
      { key: 'lt2', item: 'Size Label', code: 'HM-SL-01', size: '', consumption: 1, cost: 1.50, price: 1.50 },
      { key: 'lt3', item: 'Barcode', code: 'BC-HM-01', size: '', consumption: 1, cost: 1.00, price: 1.00 },
      { key: 'lt4', item: 'Polybag', code: 'PB-14x18', size: '14x18', consumption: 1, cost: 5.00, price: 5.00 },
    ],
    importedTrims: [
      { key: 'it1', item: 'Hangtag Loop', code: 'HL-CLR-01', size: '', consumption: 1, costUsd: 0.03, priceUsd: 0.03 },
    ],
    manufacturingRows: [
      { key: 'm1', process: 'CMT', cost: 55.00, comments: 'T-shirt CMT' },
      { key: 'm2', process: 'Garment Dyeing', cost: 25.00, comments: 'Reactive dye' },
      { key: 'm3', process: 'Ironing/Packing', cost: 6.00, comments: '' },
    ],
    overheadRows: [
      { key: 'o1', description: 'Sampling', cost: 4.00, comments: '' },
      { key: 'o2', description: 'Courier', cost: 3.00, comments: '' },
    ],
    agentCommissionPct: 3,
    profitPct: 12,
    targetPrice: '',
    totalFabricCost: 94.08,
    totalLocalTrimsCost: 11.50,
    totalImportedTrimsCostUsd: 0.03,
    totalAccessoriesCost: 14.21,
    totalManufacturingCost: 86.00,
    totalMarkupCost: 7.00,
    totalMakingPrice: 201.29,
    totalOverheadCharges: 30.19,
    totalPrice: 231.48,
    finalPrice: 2.57,
    createdAt: '2026-01-15T09:30:00Z',
  },
  {
    id: 3,
    costingId: 'CST/25-26/1003',
    status: COSTING_STATUS.DRAFT,
    date: '2026-02-10',
    buyerId: 3,
    buyerName: 'Primark',
    styleNo: 'PM-DR-045',
    garmentName: 'Ladies Summer Dress',
    season: 'SS26',
    currency: 'INR',
    quoteCurrency: 'USD',
    actualRate: 83.80,
    todaysRate: 83.80,
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    attachments: [],
    fabricRows: [
      { key: 'f1', fabricType: '100% Viscose', classification: 'Woven', description: 'Viscose Crepe', consumption: 2.10, fabricPrice: 210, fabricWidthStd: '54"', fabricWidthVendor: '56"', vendorId: 4, vendorName: 'Grasim Industries', allowancePct: 3, netCost: 454.23 },
    ],
    localTrims: [
      { key: 'lt1', item: 'Main Label', code: 'PM-ML-01', size: '', consumption: 1, cost: 2.50, price: 2.50 },
      { key: 'lt2', item: 'Care Label', code: 'PM-CL-01', size: '', consumption: 1, cost: 1.50, price: 1.50 },
      { key: 'lt3', item: 'Polybag', code: 'PB-16x20', size: '16x20', consumption: 1, cost: 6.00, price: 6.00 },
    ],
    importedTrims: [
      { key: 'it1', item: 'Zipper', code: 'ZP-INV-20', size: '20CM', consumption: 1, costUsd: 0.25, priceUsd: 0.25 },
    ],
    manufacturingRows: [
      { key: 'm1', process: 'CMT', cost: 95.00, comments: 'Dress CMT' },
      { key: 'm2', process: 'Panel Printing', cost: 35.00, comments: 'Digital print' },
      { key: 'm3', process: 'Ironing/Packing', cost: 10.00, comments: '' },
    ],
    overheadRows: [
      { key: 'o1', description: 'Sampling', cost: 6.00, comments: '2 samples' },
      { key: 'o2', description: 'Testing Charges', cost: 8.00, comments: 'Full test report' },
      { key: 'o3', description: 'Bank Charges', cost: 2.00, comments: '' },
    ],
    agentCommissionPct: 4,
    profitPct: 8,
    targetPrice: '',
    totalFabricCost: 454.23,
    totalLocalTrimsCost: 10.00,
    totalImportedTrimsCostUsd: 0.25,
    totalAccessoriesCost: 30.95,
    totalManufacturingCost: 140.00,
    totalMarkupCost: 16.00,
    totalMakingPrice: 641.18,
    totalOverheadCharges: 76.94,
    totalPrice: 718.12,
    finalPrice: 8.57,
    createdAt: '2026-02-10T14:00:00Z',
  },
];

// ==================== MOCK PAST PO SUGGESTIONS ====================

const pastPOSuggestions = {
  fabric: {
    '100% Cotton': [
      { price: 185, vendor: 'Arvind Mills', date: '2025-11-15', poNo: 'PO/25-26/0045' },
      { price: 190, vendor: 'Vardhman Textiles', date: '2025-10-20', poNo: 'PO/25-26/0038' },
      { price: 178, vendor: 'Arvind Mills', date: '2025-09-05', poNo: 'PO/25-26/0029' },
    ],
    '100% Viscose': [
      { price: 210, vendor: 'Grasim Industries', date: '2025-12-01', poNo: 'PO/25-26/0052' },
      { price: 205, vendor: 'Birla Cellulose', date: '2025-11-10', poNo: 'PO/25-26/0041' },
    ],
    'Cotton/Polyester Blend': [
      { price: 95, vendor: 'Raymond Textiles', date: '2025-11-25', poNo: 'PO/25-26/0048' },
      { price: 98, vendor: 'Alok Industries', date: '2025-10-15', poNo: 'PO/25-26/0035' },
    ],
  },
  trim: {
    'Main Label': [
      { price: 3.50, vendor: 'Label World', date: '2025-12-05', poNo: 'PO/25-26/0050' },
      { price: 4.00, vendor: 'Ace Labels', date: '2025-11-20', poNo: 'PO/25-26/0044' },
    ],
    'Polybag': [
      { price: 4.00, vendor: 'Pack Solutions', date: '2025-11-28', poNo: 'PO/25-26/0047' },
      { price: 5.00, vendor: 'Green Pack', date: '2025-10-10', poNo: 'PO/25-26/0033' },
    ],
  },
};

// ==================== HELPERS ====================

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

// ==================== CRUD OPERATIONS ====================

export const searchCostSheets = async (params = {}) => {
  await delay();

  let filtered = [...costSheets];

  // Text search
  if (params.search) {
    const term = params.search.toLowerCase();
    filtered = filtered.filter(
      (cs) =>
        cs.costingId?.toLowerCase().includes(term) ||
        cs.buyerName?.toLowerCase().includes(term) ||
        cs.styleNo?.toLowerCase().includes(term) ||
        cs.garmentName?.toLowerCase().includes(term)
    );
  }

  // Status filter
  if (params.status) {
    filtered = filtered.filter((cs) => cs.status === params.status);
  }

  // Buyer filter
  if (params.buyerId) {
    filtered = filtered.filter((cs) => cs.buyerId === Number(params.buyerId));
  }

  // Season filter
  if (params.season) {
    filtered = filtered.filter((cs) => cs.season === params.season);
  }

  // Date range filter
  if (params.dateFrom) {
    filtered = filtered.filter((cs) => cs.date >= params.dateFrom);
  }
  if (params.dateTo) {
    filtered = filtered.filter((cs) => cs.date <= params.dateTo);
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
  const size = params.size || 25;
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

export const getCostSheetById = async (id) => {
  await delay();
  const cs = costSheets.find((c) => c.id === Number(id));
  if (!cs) throw new Error(`Cost sheet with id ${id} not found`);
  return { ...cs };
};

export const createCostSheet = async (data) => {
  await delay();
  const newSheet = {
    ...data,
    id: nextId++,
    costingId: data.costingId || generateCostingId(),
    createdAt: new Date().toISOString(),
  };
  costSheets.unshift(newSheet);
  return { ...newSheet };
};

export const updateCostSheet = async (id, data) => {
  await delay();
  const index = costSheets.findIndex((c) => c.id === Number(id));
  if (index === -1) throw new Error(`Cost sheet with id ${id} not found`);
  costSheets[index] = { ...costSheets[index], ...data, updatedAt: new Date().toISOString() };
  return { ...costSheets[index] };
};

export const deleteCostSheet = async (id) => {
  await delay();
  const index = costSheets.findIndex((c) => c.id === Number(id));
  if (index === -1) throw new Error(`Cost sheet with id ${id} not found`);
  costSheets.splice(index, 1);
};

export const duplicateCostSheet = async (id) => {
  await delay();
  const original = costSheets.find((c) => c.id === Number(id));
  if (!original) throw new Error(`Cost sheet with id ${id} not found`);
  const duplicate = {
    ...JSON.parse(JSON.stringify(original)),
    id: nextId++,
    costingId: generateCostingId(),
    status: COSTING_STATUS.DRAFT,
    date: new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: undefined,
  };
  costSheets.unshift(duplicate);
  return { ...duplicate };
};

/**
 * Get past PO price suggestions for a given item
 */
export const getPastPOSuggestions = async (type, itemName) => {
  await delay(100);
  const category = pastPOSuggestions[type] || {};
  return category[itemName] || [];
};

/**
 * Get all cost sheets for comparison selection (minimal data)
 */
export const getAllCostSheetSummaries = async () => {
  await delay(150);
  return costSheets.map((cs) => ({
    id: cs.id,
    costingId: cs.costingId,
    styleNo: cs.styleNo,
    buyerName: cs.buyerName,
    garmentName: cs.garmentName,
    totalPrice: cs.totalPrice,
    finalPrice: cs.finalPrice,
    status: cs.status,
    currency: cs.currency,
    quoteCurrency: cs.quoteCurrency,
  }));
};

/**
 * Mock today's exchange rate
 */
export const getTodaysRate = async (fromCurrency, toCurrency) => {
  await delay(100);
  const rates = {
    'USD-INR': 83.80,
    'EUR-INR': 90.20,
    'GBP-INR': 106.50,
    'INR-USD': 1 / 83.80,
    'INR-EUR': 1 / 90.20,
    'INR-GBP': 1 / 106.50,
    'USD-EUR': 83.80 / 90.20,
    'EUR-USD': 90.20 / 83.80,
  };
  const key = `${fromCurrency}-${toCurrency}`;
  return rates[key] || 1;
};
