/**
 * Production PO data-source switch.
 * false → real Spring Boot API (erp-purchase); true → in-memory mock (offline demo).
 * The mock implementation lives in mockApi.js + productionMockData.js.
 */
export const USE_MOCK_PRODUCTION_DATA = false;
