import { twinGet } from './twinHttp';

/**
 * Export shipments for the dispatch dock (read-only): the newest 50 at the working
 * branch, newest first. The adapter reads the API record as it comes.
 */
export const fetchShipments = () => twinGet('/export-docs/shipments', { page: 0, size: 50 });
