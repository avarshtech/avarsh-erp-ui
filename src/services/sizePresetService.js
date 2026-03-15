import axiosInstance from './axiosInstance';

const ENDPOINT = '/size-presets';

export const getAllSizePresets = () => axiosInstance.get(ENDPOINT);
export const getSizePresetById = (id) => axiosInstance.get(`${ENDPOINT}/${id}`);
export const createSizePreset = (data) => axiosInstance.post(ENDPOINT, data);
export const updateSizePreset = (id, data) => axiosInstance.put(`${ENDPOINT}/${id}`, data);
export const deleteSizePreset = (id) => axiosInstance.delete(`${ENDPOINT}/${id}`);
