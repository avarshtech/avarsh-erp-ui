/**
 * Unified postal code lookup service using Zippopotam.us API.
 * Works for both international and domestic (Indian) postal codes.
 */

/**
 * Lookup city and state by country ISO2 code and postal code.
 * @param {string} countryISO2 - ISO 3166-1 alpha-2 country code (e.g., 'IN', 'NL', 'GB')
 * @param {string} postalCode - Postal/ZIP code to look up
 * @returns {Promise<{city: string, state: string} | null>} Location data or null if not found
 */
export const lookupPostalCode = async (countryISO2, postalCode) => {
  const baseUrl = import.meta.env.VITE_POSTALCODE_API_URL || 'https://api.zippopotam.us';
  const response = await fetch(`${baseUrl}/${countryISO2}/${postalCode}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const data = await response.json();
  if (data?.places?.length > 0) {
    return {
      city: data.places[0]['place name'],
      state: data.places[0].state,
    };
  }
  return null;
};
