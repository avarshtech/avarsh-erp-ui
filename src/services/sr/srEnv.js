/**
 * Sample Request module data-source flag (TNA-pattern mock phase).
 * Flip to false ONLY once the real /api/v1/sample-requests backend exists —
 * srService.js throws for every call until a real delegate is wired in.
 */
export const USE_MOCK_SR_DATA = true;
