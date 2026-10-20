import axiosInstance from '../core/axiosInstance';

const ENDPOINT = '/couriers';

// includeInactive=true is for the master screen, which must still show a
// retired carrier so it can be reactivated; every dropdown takes the default.
export const getAllCouriers = (includeInactive = true) => axiosInstance.get(ENDPOINT, { params: { includeInactive } });
export const getCourierById = (id) => axiosInstance.get(`${ENDPOINT}/${id}`);
export const createCourier = (data) => axiosInstance.post(ENDPOINT, data);
export const updateCourier = (id, data) => axiosInstance.put(`${ENDPOINT}/${id}`, data);
export const deleteCourier = (id) => axiosInstance.delete(`${ENDPOINT}/${id}`);
