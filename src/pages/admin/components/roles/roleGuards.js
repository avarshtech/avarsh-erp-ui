/**
 * Why Role & Access refuses an action, worded for the person — the same rules the
 * API answers with a 403 or a 409, so a button says why it is off instead of
 * letting the request fail. Used by the list, the view dialog and the editor.
 */
import { isAdminRole } from '../../../../utils/permissions';

const holders = (n) => (n === 1 ? '1 user has' : `${n} users have`);

export const usersLabel = (n) => (n === 1 ? '1 user' : `${n} users`);

/** A role name as uniqueness sees it: "Store Keeper", "store keeper" and "StoreKeeper" are one name. */
export const normalName = (name) => (name ?? '').toLowerCase().replace(/\s+/g, '');

/** The API refuses a non-superuser editing the role they hold (RoleService.guardSelfEdit). */
export const editBlockedReason = (role, viewer) =>
  role?.id != null && viewer?.roleId != null && String(role.id) === String(viewer.roleId) && !viewer.superuser
    ? "You hold this role, so you can't change it."
    : null;

/** The API refuses deleting the superuser role, or a role users still hold. */
export const deleteBlockedReason = (role) => {
  if (role?.isSuperuser) return "The superuser role can't be deleted.";
  if (role?.userCount > 0) return `${holders(role.userCount)} this role. Move them to another role first.`;
  return null;
};

/** The API refuses renaming a role users hold. */
export const renameBlockedReason = (role) =>
  (role?.userCount > 0 ? `${holders(role.userCount)} this role, so its name is fixed.` : null);

/**
 * A role the web app treats as all-powerful by its NAME, which the server does not:
 * it skips its checks only for the superuser flag. Shown only once the API has
 * reported the flag, so an older API never mislabels Super Admin.
 */
export const isNamedAdmin = (role) => Boolean(role?.name) && isAdminRole(role.name) && role.isSuperuser === false;
