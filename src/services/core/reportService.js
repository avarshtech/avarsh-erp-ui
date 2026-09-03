import axiosInstance from './axiosInstance';

// Report Definitions
export const getReportDefinitions = async (module) => {
  const params = module ? { module } : {};
  const response = await axiosInstance.get('/reports/definitions', { params });
  return response.data;
};

export const getReportDefinition = async (id) => {
  const response = await axiosInstance.get(`/reports/definitions/${id}`);
  return response.data;
};

// Report Designer (admin) — blueprints carry column keys, never SQL
export const getReportCatalog = async () => {
  const response = await axiosInstance.get('/reports/catalog');
  return response.data;
};

export const createReportFromBlueprint = async (data) => {
  const response = await axiosInstance.post('/reports/definitions/from-blueprint', data);
  return response.data;
};

export const updateReportFromBlueprint = async (id, data) => {
  const response = await axiosInstance.put(`/reports/definitions/${id}/from-blueprint`, data);
  return response.data;
};

export const deleteReportDefinition = async (id) => {
  const response = await axiosInstance.delete(`/reports/definitions/${id}`);
  return response.data;
};

// Report Execution
export const executeReport = async (params) => {
  const response = await axiosInstance.post('/reports/execute', params);
  return response.data;
};

// Filter Options
export const getFilterOptions = async (reportDefId, filterCode) => {
  const response = await axiosInstance.get(`/reports/filters/${reportDefId}/${filterCode}/options`);
  return response.data;
};

// Export
export const exportReport = async (params) => {
  const response = await axiosInstance.post('/reports/export', params, { responseType: 'blob' });
  return response.data;
};

// Saved Reports
export const getSavedReports = async () => {
  const response = await axiosInstance.get('/reports/saved');
  return response.data;
};

export const saveReport = async (data) => {
  const response = await axiosInstance.post('/reports/saved', data);
  return response.data;
};

export const updateSavedReport = async (id, data) => {
  const response = await axiosInstance.put(`/reports/saved/${id}`, data);
  return response.data;
};

export const deleteSavedReport = async (id) => {
  const response = await axiosInstance.delete(`/reports/saved/${id}`);
  return response.data;
};

// AI Chat
export const aiChat = async (data) => {
  const response = await axiosInstance.post('/reports/ai/chat', data);
  return response.data;
};

// Execution Log
export const getExecutionLog = async (params) => {
  const response = await axiosInstance.get('/reports/execution-log', { params });
  return response.data;
};
