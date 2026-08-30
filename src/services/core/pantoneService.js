import axios from 'axios';

/**
 * Pantone Color API Service
 * Handles Pantone color lookups and swatch URL construction
 */

const PANTONE_API_URL =
  import.meta.env.VITE_PANTONE_API_URL ||
  'https://i8k09r4vbf.execute-api.us-east-1.amazonaws.com/prod/Pantone_PantoneColorFinder';

const PANTONE_SWATCH_BASE_URL =
  import.meta.env.VITE_PANTONE_SWATCH_BASE_URL ||
  'https://www.pantone.com/media/color-finder/img/chips';

// Standalone axios instance for external Pantone API (no auth token needed)
const pantoneAxios = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Search Pantone colors by color code (fuzzy search)
 * @param {string} searchTerm - Color code like "18-1662"
 * @returns {Promise<Array>} Array of { code, name, bookId } objects
 */
export const searchPantoneColors = async (searchTerm) => {
  const response = await pantoneAxios.post(PANTONE_API_URL, {
    searchType: 'fuzzy',
    searchTerm,
  });

  const data = response.data;
  if (data?.message !== 'Success' || !data?.pantone?.connect) {
    return [];
  }

  // Flatten all results from all books
  const results = [];
  for (const book of data.pantone.connect) {
    for (const color of book.colors || []) {
      results.push({
        code: color.code,
        name: color.name,
        bookId: book.bookId,
      });
    }
  }
  return results;
};

/**
 * Construct the Pantone swatch image URL from a color code
 * Example: "18-1662 TCX" → "pantone-color-chip-18-1662-tcx.webp"
 * @param {string} code - Full Pantone color code (e.g. "18-1662 TCX")
 * @returns {string} Full URL to swatch image
 */
export const getPantoneSwatchUrl = (code) => {
  if (!code) return '';
  // Convert "18-1662 TCX" → "18-1662-tcx"
  const slug = code.toLowerCase().replace(/\s+/g, '-');
  return `${PANTONE_SWATCH_BASE_URL}/pantone-color-chip-${slug}.webp`;
};

/**
 * Check if a value looks like a Pantone color code
 * Pantone codes stored as "code / name" e.g. "18-1662 TCX / Flame Scarlet"
 * @param {string} value - Attribute value to check
 * @returns {boolean}
 */
export const isPantoneCode = (value) => {
  if (!value || typeof value !== 'string') return false;
  // Matches patterns like "18-1662 TCX / Flame Scarlet" or just "18-1662 TCX"
  return /\d{2}-\d{4}\s+T[CG]X/i.test(value);
};

/**
 * Extract the color code from a stored Pantone value (e.g. "18-1662 TCX / Flame Scarlet" → "18-1662 TCX")
 * @param {string} value - Stored value
 * @returns {string} Just the code part
 */
export const extractPantoneCode = (value) => {
  if (!value) return '';
  const match = value.match(/(\d{2}-\d{4}\s+T[CG]X)/i);
  return match ? match[1] : '';
};
