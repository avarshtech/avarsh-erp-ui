import axiosInstance from '../core/axiosInstance';

const ENDPOINT = '/payment-terms';

export const getAllPaymentTerms = () => axiosInstance.get(ENDPOINT);
export const getPaymentTermsById = (id) => axiosInstance.get(`${ENDPOINT}/${id}`);
export const createPaymentTerms = (data) => axiosInstance.post(ENDPOINT, data);
export const updatePaymentTerms = (id, data) => axiosInstance.put(`${ENDPOINT}/${id}`, data);
export const deletePaymentTerms = (id) => axiosInstance.delete(`${ENDPOINT}/${id}`);
