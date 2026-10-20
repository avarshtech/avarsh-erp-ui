import { useEffect, useState } from 'react';
import { getRoles } from '../../../../services/admin/roleService';

const asList = (res) => (Array.isArray(res) ? res : (res?.content || res?.data || []));

/** The other roles — what "Copy from another role" offers and the names a role may not take. */
const useRoleCatalog = (currentId) => {
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    let alive = true;
    getRoles()
      .then((res) => {
        if (alive) setRoles(asList(res).filter((r) => String(r.id) !== String(currentId)));
      })
      .catch(() => {}); // axiosInstance has already shown the server's message
    return () => { alive = false; };
  }, [currentId]);

  return roles;
};

export default useRoleCatalog;
