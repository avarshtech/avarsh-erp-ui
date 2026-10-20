import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getRoleById } from '../../../../services/admin/roleService';
import { getUsers } from '../../../../services/admin/userService';
import { hasPermission } from '../../../../utils/permissions';

const asList = (res) => (Array.isArray(res) ? res : (res?.content || res?.data || []));
const holderName = (u) => `${u.name || u.username}${u.isActive === false ? ' (inactive)' : ''}`;

/**
 * The view dialog's state on the roles list: the role it shows, opened from a row or from
 * ?viewId=<id> (the editor returning to the dialog it was opened from, or a shared link) — read once and
 * removed, as OrderList's deep link is. Who holds the role: names when the viewer may read users,
 * fetched once; otherwise null, and the dialog shows the count.
 */
const useRoleViewer = () => {
  const [params, setParams] = useSearchParams();
  const [viewing, setViewing] = useState(null);
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState(null);

  const view = useCallback((role) => {
    setViewing(role);
    setOpen(true);
    if (users === null && hasPermission('users', 'view')) {
      // A failure leaves the names unknown (null): the dialog falls back to the count, and the next open retries
      getUsers().then((res) => setUsers(asList(res))).catch(() => {});
    }
  }, [users]);

  useEffect(() => {
    const viewId = params.get('viewId');
    if (!viewId) return;
    const next = new URLSearchParams(params);
    next.delete('viewId');
    setParams(next, { replace: true });
    getRoleById(viewId).then(view).catch(() => {}); // axiosInstance has already shown the server's message
  }, [params, setParams, view]);

  const close = useCallback(() => setOpen(false), []);
  const clear = useCallback(() => setViewing(null), []);
  const holders = viewing && users
    ? users.filter((u) => u.roleId === viewing.id).map((u) => ({ id: u.id, name: holderName(u) }))
    : null;

  return { viewing, open, holders, view, close, clear };
};

export default useRoleViewer;
