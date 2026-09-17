import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/statutory';

/**
 * Monthly PF/ESI figures for a unit, read from the payroll run.
 * Nothing is recalculated server side - these are the payslip figures.
 */
export const getPfSummary = async (unitId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/pf/summary`, {
    params: { unitId, month, year },
  });
  return response.data;
};

export const getEsiSummary = async (unitId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/esi/summary`, {
    params: { unitId, month, year },
  });
  return response.data;
};

/** EPFO ECR text file for upload to the member portal. */
export const downloadEcrFile = async (unitId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/pf/ecr`, {
    params: { unitId, month, year },
    responseType: 'blob',
  });
  return response.data;
};

/** ESIC monthly contribution file. */
export const downloadEsiFile = async (unitId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/esi/contribution-file`, {
    params: { unitId, month, year },
    responseType: 'blob',
  });
  return response.data;
};

/**
 * The same return as a readable workbook.
 *
 * The ECR and the ESI file are the formats those portals accept, not formats
 * meant for a person to read. This is the one to open when checking a return
 * before submitting it, or answering a question about it afterwards.
 *
 * Not guarded the way the upload files are: a return that cannot be filed is
 * exactly when someone needs to see what is in it.
 */
export const downloadContributionStatement = async (type, unitId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/${type}/statement`, {
    params: { unitId, month, year },
    responseType: 'blob',
  });
  return response.data;
};
