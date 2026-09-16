import axiosInstance from '../core/axiosInstance';

/** The order → branch split. GET returns the view; PUT replaces the whole set. */
export const getOrderAllocations = async (orderId) => {
  const response = await axiosInstance.get(`/orders/${orderId}/allocations`);
  return response.data;
};

export const saveOrderAllocations = async (orderId, rows) => {
  const response = await axiosInstance.put(`/orders/${orderId}/allocations`, { rows });
  return response.data;
};
