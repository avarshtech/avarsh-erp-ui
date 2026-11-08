import axiosInstance from '../core/axiosInstance';

/**
 * Self-service calls on the signed-in user (/me). They need no permission key, unlike
 * /users/{id}, which is the Users admin screen's and answers 403 to everyone else.
 */

/** Who the caller is: { userId, name, email, role, roleId, isSuperuser, defaultBranchId }. */
export const getMe = async () => {
  const response = await axiosInstance.get('/me');
  return response.data;
};

/**
 * Change one's own password, proving the current one. A wrong current password, or a new one
 * the policy refuses, is a 400 whose `message` says why.
 */
export const changeMyPassword = async ({ currentPassword, newPassword }) => {
  const response = await axiosInstance.put('/me/password', { currentPassword, newPassword });
  return response.data;
};
