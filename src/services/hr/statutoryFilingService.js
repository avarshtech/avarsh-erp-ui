import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/hr/statutory';

/**
 * Monthly PF/ESI figures for a factory, read from the payroll run.
 * Nothing is recalculated server side - these are the payslip figures.
 */
export const getPfSummary = async (factoryId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/pf/summary`, {
    params: { factoryId, month, year },
  });
  return response.data;
};

export const getEsiSummary = async (factoryId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/esi/summary`, {
    params: { factoryId, month, year },
  });
  return response.data;
};

/** EPFO ECR text file for upload to the member portal. */
export const downloadEcrFile = async (factoryId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/pf/ecr`, {
    params: { factoryId, month, year },
    responseType: 'blob',
  });
  return response.data;
};

/** ESIC monthly contribution file. */
export const downloadEsiFile = async (factoryId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/esi/contribution-file`, {
    params: { factoryId, month, year },
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
export const downloadContributionStatement = async (type, factoryId, month, year) => {
  const response = await axiosInstance.get(`${BASE_URL}/${type}/statement`, {
    params: { factoryId, month, year },
    responseType: 'blob',
  });
  return response.data;
};
