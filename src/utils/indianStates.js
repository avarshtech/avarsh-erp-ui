/**
 * Indian State Codes (GSTIN first 2 digits) to State Name mapping
 * Based on GST state codes as per Indian Government
 */

export const INDIAN_STATE_CODES = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

/**
 * Get state name from state code
 * @param {string} stateCode - 2 digit state code
 * @returns {string} State name or empty string if not found
 */
export const getStateName = (stateCode) => {
  if (!stateCode) return '';
  const code = stateCode.toString().padStart(2, '0');
  return INDIAN_STATE_CODES[code] || '';
};

/**
 * Get state code from GSTIN (first 2 characters)
 * @param {string} gstin - GSTIN number
 * @returns {string} 2 digit state code or empty string
 */
export const getStateCodeFromGstin = (gstin) => {
  if (!gstin || gstin.length < 2) return '';
  return gstin.substring(0, 2);
};

/**
 * Get state name from GSTIN
 * @param {string} gstin - GSTIN number
 * @returns {string} State name or empty string
 */
export const getStateNameFromGstin = (gstin) => {
  const stateCode = getStateCodeFromGstin(gstin);
  return getStateName(stateCode);
};

export default INDIAN_STATE_CODES;
