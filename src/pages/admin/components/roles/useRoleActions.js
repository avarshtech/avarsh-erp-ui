import { useCallback, useState } from 'react';
import { App } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { createRole, updateRole } from '../../../../services/admin/roleService';
import { getCurrentUser, normalizePermissionsForSave, setCurrentUser } from '../../../../utils/permissions';

const LIST = '/admin/roles';

/**
 * The editor's exits and its save. Cancel and Save return where the editor was opened: the role's
 * view dialog (?viewId) when its Edit or Duplicate opened it (route state `from: 'dialog'`), else the
 * list. The back arrow always goes to the list. Every exit replaces the history entry, so Back never
 * returns to the finished editor. API errors are toasted by axiosInstance; antd shows field errors.
 */
const useRoleActions = ({ role, source, isNew, form, permissions, dirty, clearDirty }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const fromDialog = useLocation().state?.from === 'dialog';
  const [saving, setSaving] = useState(false);
  const returnTo = useCallback((id) => (fromDialog && id != null ? `${LIST}?viewId=${id}` : LIST), [fromDialog]);
  const cancel = useCallback(() => navigate(returnTo(role.id ?? source?.id), { replace: true }), [navigate, returnTo, role.id, source]);

  const save = useCallback(async () => {
    if (!isNew && !dirty) {
      cancel(); // nothing changed: just leave
      return;
    }
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // the fields show what is wrong
    }
    setSaving(true);
    try {
      const normalized = normalizePermissionsForSave(permissions);
      const payload = {
        name: values.name.trim(),
        description: values.description ?? '', // NOT NULL on the API, at most 50 characters
        status: values.active === false ? 'INACTIVE' : 'ACTIVE',
        permissions: normalized,
      };
      const saved = isNew ? await createRole(payload) : await updateRole(role.id, { ...payload, version: role.version });
      // Your own role's rights apply at once, without signing in again (only a superuser may save their own role).
      const me = getCurrentUser();
      if (!isNew && me && String(me.roleId) === String(role.id)) setCurrentUser({ ...me, permissions: normalized });
      message.success(isNew ? 'Role created' : 'Role saved');
      clearDirty();
      navigate(returnTo(saved?.id ?? role.id), { replace: true });
    } catch {
      // axiosInstance has already shown the server's message
    } finally {
      setSaving(false);
    }
  }, [isNew, dirty, cancel, form, permissions, role, message, clearDirty, navigate, returnTo]);

  return { saving, save, cancel, back: () => navigate(LIST, { replace: true }) };
};

export default useRoleActions;
