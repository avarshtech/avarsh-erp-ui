import { useCallback, useState } from 'react';
import { App } from 'antd';
import { useNavigate } from 'react-router-dom';
import { createRole, updateRole } from '../../../../services/admin/roleService';
import { getCurrentUser, normalizePermissionsForSave, setCurrentUser } from '../../../../utils/permissions';

/**
 * Save or create, then back to the list with ?viewId so the view dialog shows what was saved
 * (replace: Back never returns to the finished editor). Saving with nothing changed just goes back.
 * API errors are toasted by axiosInstance; antd shows the form's own errors in place.
 */
const useRoleActions = ({ role, isNew, form, permissions, dirty, clearDirty, backTo }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const save = useCallback(async () => {
    if (!isNew && !dirty) {
      navigate(backTo, { replace: true });
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
      navigate(`/admin/roles?viewId=${saved?.id ?? role.id}`, { replace: true });
    } catch {
      // axiosInstance has already shown the server's message
    } finally {
      setSaving(false);
    }
  }, [isNew, dirty, navigate, backTo, form, permissions, role, message, clearDirty]);

  return { saving, save };
};

export default useRoleActions;
