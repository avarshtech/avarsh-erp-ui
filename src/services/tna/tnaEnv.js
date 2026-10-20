/**
 * TNA module data-source flags. TRUE = in-repo mock (CR-TNA-001 Round 1). Flip to false
 * only after the real /api/v1/tna backend lands (Round 2).
 */
export const USE_MOCK_TNA_DATA = true;

/**
 * The mock's "today". 09-Oct-2026 is the CR's snapshot date, so every screen reproduces
 * §17 and wireframes WF-01..WF-08 exactly. Set to null to age the mock with the real date.
 */
export const MOCK_AS_OF = '2026-10-09';
