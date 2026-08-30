/**
 * Test Data Factories for E2E Tests
 *
 * Generates test payloads with timestamp-based unique names
 * to avoid conflicts between test runs.
 */

const ts = () => Date.now();

export function buyerPayload(overrides = {}) {
  return {
    name: `E2E Buyer ${ts()}`,
    contactPerson: 'E2E Test Contact',
    email: `buyer-${ts()}@e2e-test.com`,
    phone: '+1234567890',
    active: true,
    ...overrides,
  };
}

export function supplierPayload(overrides = {}) {
  return {
    name: `E2E Supplier ${ts()}`,
    address: '123 Test Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
    country: 'India',
    pincode: '400001',
    gstin: '27AABCE1234F1Z5',
    pan: 'AABCE1234F',
    email: `supplier-${ts()}@e2e-test.com`,
    phone: '+919876543210',
    contactPerson: 'E2E Supplier Contact',
    suppliesFabric: true,
    suppliesTrims: false,
    active: true,
    ...overrides,
  };
}

export function categoryPayload(overrides = {}) {
  return {
    name: `E2E Category ${ts()}`,
    description: 'Created by E2E test',
    ...overrides,
  };
}

export function subCategoryPayload(categoryId, overrides = {}) {
  return {
    categoryId,
    name: `E2E SubCategory ${ts()}`,
    description: 'Created by E2E test',
    ...overrides,
  };
}

/**
 * Item payload matching backend ItemDTO.
 * itemCode is server-generated (do NOT send/assert a client value).
 * defaultAllowance is @NotNull on the backend.
 * Pass real seeded ids: categoryId, subCategoryId, itemTypeId, uomId.
 */
export function itemPayload(ids = {}, overrides = {}) {
  return {
    itemName: `E2E Test Item ${ts()}`,
    categoryId: ids.categoryId,
    subCategoryId: ids.subCategoryId,
    itemTypeId: ids.itemTypeId,
    uomId: ids.uomId,
    hsnCode: '9999',
    defaultAllowance: 5,
    isActive: true,
    variants: [],
    ...overrides,
  };
}

export function stylePayload(buyerId, overrides = {}) {
  return {
    styleNo: `E2E-${ts()}`,
    garmentName: 'E2E Test Garment',
    buyerId,
    seasonCode: 'SS',
    seasonYear: '2026',
    description: 'Created by E2E test',
    isActive: true,
    ...overrides,
  };
}

export function processPayload(overrides = {}) {
  return {
    processName: `E2E Process ${ts()}`,
    description: 'Created by E2E test',
    category: 'Sewing',
    isActive: true,
    defaultCost: 10.00,
    ...overrides,
  };
}

export function partPayload(overrides = {}) {
  return {
    partName: `E2E Part ${ts()}`,
    description: 'Created by E2E test',
    isActive: true,
    ...overrides,
  };
}

export function overheadPayload(overrides = {}) {
  return {
    overheadName: `E2E Overhead ${ts()}`,
    description: 'Created by E2E test',
    category: 'General',
    defaultCost: 5.00,
    isActive: true,
    ...overrides,
  };
}

export function sizePresetPayload(overrides = {}) {
  return {
    name: `E2E Preset ${ts()}`,
    category: 'General',
    region: 'Global',
    sizes: ['S', 'M', 'L', 'XL'],
    active: true,
    ...overrides,
  };
}

export function paymentTermsPayload(overrides = {}) {
  return {
    name: `E2E Terms ${ts()}`,
    description: 'Created by E2E test',
    paymentDays: 30,
    advancePercentage: 0,
    active: true,
    ...overrides,
  };
}

export function termsConditionsPayload(overrides = {}) {
  return {
    name: `E2E T&C ${ts()}`,
    description: '<p>Created by E2E test</p>',
    ...overrides,
  };
}

export function uomPayload(overrides = {}) {
  return {
    name: `E2E UOM ${ts()}`,
    symbol: `e${ts() % 1000}`,
    decimalPrecision: 2,
    ...overrides,
  };
}

export function costSheetPayload(buyerId, styleId, overrides = {}) {
  return {
    status: 'Draft',
    date: new Date().toISOString().split('T')[0],
    buyerId,
    styleId,
    season: 'SS26',
    currency: 'INR',
    quoteCurrency: 'USD',
    actualRate: 83.80,
    todaysRate: 83.80,
    sizes: ['S', 'M', 'L', 'XL'],
    fabricRows: [],
    localTrims: [],
    importedTrims: [],
    manufacturingRows: [],
    overheadRows: [],
    agentCommissionPct: 5,
    profitPct: 10,
    ...overrides,
  };
}

export function orderPayload(buyerId, overrides = {}) {
  return {
    status: 'DRAFT',
    buyerId,
    orderDate: new Date().toISOString().split('T')[0],
    season: 'SS26',
    currency: 'USD',
    garmentType: 'T-Shirt',
    material: 'Knit',
    totalOrderQty: 1000,
    ...overrides,
  };
}
