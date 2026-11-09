/**
 * Export Documentation data-source flag. The documents are the API's
 * (/api/v1/export-docs/documents, expDocStore); their rules still run in the
 * browser (expDocMock*.js). Flipping this to false makes every such call throw a
 * named error rather than silently returning undefined.
 */
export const USE_MOCK_EXPDOC_DATA = true;
