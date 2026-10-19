import { fetchAndCacheOrganisation, getCachedOrganisation } from '../services/admin/organisationService';

/**
 * The company header for a printed document.
 *
 * Cached in memory after login, so this is normally free. It never throws -
 * with no organisation row configured it returns null and the document prints
 * with a blank header rather than refusing to print at all.
 */
export const companyForPrint = async () => getCachedOrganisation() ?? await fetchAndCacheOrganisation();
