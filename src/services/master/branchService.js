import axiosInstance from '../core/axiosInstance';

const BASE_URL = '/branches';

export const getAllBranches = async () => axiosInstance.get(BASE_URL);

export const getActiveBranches = async () => axiosInstance.get(`${BASE_URL}/active`);

export const getBranchById = async (id) => axiosInstance.get(`${BASE_URL}/${id}`);

export const createBranch = async (data) => axiosInstance.post(BASE_URL, data);

export const updateBranch = async (id, data) => axiosInstance.put(`${BASE_URL}/${id}`, { id, ...data });

export const deleteBranch = async (id) => axiosInstance.delete(`${BASE_URL}/${id}`);
