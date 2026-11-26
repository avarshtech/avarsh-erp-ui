/**
 * Customs export rates REST client (/api/v1/export-docs/customs-rates): the CBIC-notified rates an
 * export invoice converts with, kept from the Export Invoices screen under its key.
 */
import axiosInstance from '../core/axiosInstance';

const BASE = '/export-docs/customs-rates';

/** Screens read `e.message`; axiosInstance puts the backend's text on `errorMessage`. */
const call = (request) => request.then((res) => res.data).catch((e) => {
  e.message = e.errorMessage || e.message;
  throw e;
});

export const listCustomsRates = () => call(axiosInstance.get(BASE));

export const createCustomsRate = (rate) => call(axiosInstance.post(BASE, rate));

export const updateCustomsRate = (id, rate) => call(axiosInstance.put(`${BASE}/${id}`, rate));

export const deleteCustomsRate = (id) => call(axiosInstance.delete(`${BASE}/${id}`));

/**
 * The rate of `currency` in force on `date` (YYYY-MM-DD), or null when no notification precedes it
 * (404): the invoice then asks for a rate. Any other failure is thrown with a plain sentence, so a
 * network blip never passes for "no rate" and blanks a rate the invoice already had.
 */
export const customsRateInForce = (currency, date) =>
  axiosInstance.get(`${BASE}/in-force`, { params: { currency, date }, silent: true, timeout: 10000 })
    .then((res) => res.data)
    .catch((e) => {
      if (e.response?.status === 404) return null;
      throw new Error('The customs exchange rate could not be read just now. Nothing was changed; try again.');
    });
