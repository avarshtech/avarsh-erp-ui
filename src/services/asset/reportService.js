import axiosInstance from '../core/axiosInstance';

const REPORTS = '/asset-reports';

/** The nine fixed reports and, for each, the filter widgets it takes. */
export const getReportDefinitions = async () => (await axiosInstance.get(REPORTS)).data;

/**
 * Runs one report.
 *
 * A POST although it only reads: the filter set is too large for a query
 * string, and nine reports' worth of optional parameters on a GET would be
 * unreadable. The server annotates the handler as a read, so running a report
 * needs no right to create one.
 */
export const runReport = async (code, filter) =>
  (await axiosInstance.post(`${REPORTS}/${code}/run`, filter)).data;

/**
 * The same report as a file.
 *
 * Re-run on the server rather than formatted from what the screen is holding:
 * a download is a fresh question, and sending the browser's copy back up would
 * put the file at the mercy of a stale page.
 */
export const exportReport = async (code, filter, format) => {
  const response = await axiosInstance.post(
    `${REPORTS}/${code}/export?format=${format}`, filter, { responseType: 'blob' },
  );
  return response.data;
};
