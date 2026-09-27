/**
 * Job-work PO data-source switches. true → the localStorage mock (UI mock phase); false →
 * the real API, once the job-work PO endpoints exist (after the design review). The masters
 * these screens read — Suppliers, Processes, Payment Terms, Branches — are always the API.
 */
export const USE_MOCK_CUT_PANEL_PO = true;
export const USE_MOCK_GARMENT_PROCESS_PO = true;
