/**
 * Export Documentation data-source flag (mock phase).
 * Flip to false ONLY once the real /api/v1/export-docs backend exists —
 * expDocService.js throws a named error for every call until a real delegate
 * is wired in, rather than silently returning undefined.
 */
export const USE_MOCK_EXPDOC_DATA = true;
