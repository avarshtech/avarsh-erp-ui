import axiosInstance from '../core/axiosInstance';

const URL = '/virtual-factory/rules';

/** The organisation's Factory Health rules; `rules` is empty until an admin saves them. */
export const getFactoryRules = () => axiosInstance.get(URL, { silent: true }).then((res) => res.data);

/** Replaces the rules (superusers only); `version` is null for the first save. */
export const saveFactoryRules = (rules, version) => axiosInstance.put(URL, { rules, version }).then((res) => res.data);
