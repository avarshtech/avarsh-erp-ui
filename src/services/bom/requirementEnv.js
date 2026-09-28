/**
 * Process requirement data-source switches (BOM module).
 * true → in-memory / localStorage mock (UI design phase); false → real API, once the
 * Cut Panel / Garment Process Requirement endpoints exist (after the design review).
 *
 * The masters these screens read — Processes (category 'Cut Panel' / 'Garment') and
 * Parts (with panels per garment) — are always the real API.
 */
export const USE_MOCK_CUT_PANEL_DATA = true;
export const USE_MOCK_GARMENT_PROCESS_DATA = true;
