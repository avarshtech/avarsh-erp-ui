/**
 * Finishing module API surface. Mock-only during the design phase; signatures
 * mirror the future real endpoints (/api/v1/finishing/…) so integration swaps
 * the delegate without touching screens.
 */
import * as mockApi from './finishingMockApi';

export const USE_MOCK_FINISHING_DATA = true;

export const getOrders = (...a) => mockApi.getOrders(...a);
export const getEmployees = (...a) => mockApi.getEmployees(...a);

export const listReceivings = (...a) => mockApi.listReceivings(...a);
export const saveReceiving = (...a) => mockApi.saveReceiving(...a);

export const getHourlySheet = (...a) => mockApi.getHourlySheet(...a);
export const saveHourlySheet = (...a) => mockApi.saveHourlySheet(...a);
export const rowTotal = mockApi.rowTotal;

export const listSpotWash = (...a) => mockApi.listSpotWash(...a);
export const saveSpotWash = (...a) => mockApi.saveSpotWash(...a);

export const listCheckings = (...a) => mockApi.listCheckings(...a);
export const getChecking = (...a) => mockApi.getChecking(...a);
export const saveChecking = (...a) => mockApi.saveChecking(...a);
export const aqlSample = mockApi.aqlSample;
export const dhuPct = mockApi.dhuPct;

export const listFinishingMeasurements = (...a) => mockApi.listFinishingMeasurements(...a);
export const getFinishingMeasurement = (...a) => mockApi.getFinishingMeasurement(...a);
export const saveFinishingMeasurement = (...a) => mockApi.saveFinishingMeasurement(...a);

export const listAlterations = (...a) => mockApi.listAlterations(...a);
export const saveAlteration = (...a) => mockApi.saveAlteration(...a);

export const listMetalDetection = (...a) => mockApi.listMetalDetection(...a);
export const saveMetalDetection = (...a) => mockApi.saveMetalDetection(...a);
export const listNeedleLog = (...a) => mockApi.listNeedleLog(...a);

export const listShadeGroups = (...a) => mockApi.listShadeGroups(...a);
export const saveShadeGroup = (...a) => mockApi.saveShadeGroup(...a);

export const getFinishingDashboard = (...a) => mockApi.getFinishingDashboard(...a);

// Cross-module: sewing spec points reused for post-iron measurement auto-fill.
export { specPoints } from './sewingMockApi';
