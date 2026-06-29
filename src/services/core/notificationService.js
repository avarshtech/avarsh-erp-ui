import axiosInstance from './axiosInstance';

const BASE = '/notifications';

// ─── Push Subscription ───

export const getVapidPublicKey = () =>
  axiosInstance.get(`${BASE}/vapid-public-key`).then((res) => res.data);

export const subscribePush = (subscription) =>
  axiosInstance.post(`${BASE}/subscribe`, subscription);

export const unsubscribePush = (endpoint) =>
  axiosInstance.delete(`${BASE}/subscribe`, { data: { endpoint } });

// ─── Notifications ───

export const getNotifications = (page = 0, size = 20) =>
  axiosInstance.get(BASE, { params: { page, size } }).then((res) => res.data);

export const getUnreadCount = () =>
  axiosInstance.get(`${BASE}/unread-count`).then((res) => res.data);

export const markAsRead = (id) =>
  axiosInstance.patch(`${BASE}/${id}/read`);

export const markAsUnread = (id) =>
  axiosInstance.patch(`${BASE}/${id}/unread`);

export const markAllAsRead = () =>
  axiosInstance.patch(`${BASE}/read-all`);

export const deleteNotification = (id) =>
  axiosInstance.delete(`${BASE}/${id}`);

export const deleteAllRead = () =>
  axiosInstance.delete(`${BASE}/read`);

// ─── Preferences ───

export const getPreferences = () =>
  axiosInstance.get(`${BASE}/preferences`).then((res) => res.data);

export const updatePreferences = (preferences) =>
  axiosInstance.put(`${BASE}/preferences`, preferences);
