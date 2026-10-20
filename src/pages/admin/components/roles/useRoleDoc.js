import { useEffect, useState } from 'react';
import { getRoleById } from '../../../../services/admin/roleService';

const BLANK = { name: '', description: '', status: 'ACTIVE', permissions: {} };

/**
 * The role the editor works on. Editing (`id`): the saved role. Adding: a blank role or, with
 * `fromId` (Duplicate), the source's rights and description — never its id, version or name —
 * plus the source itself for the hero. `{ loading, role, source, notFound }`.
 */
const useRoleDoc = (id, fromId) => {
  const target = id ?? fromId;
  const [state, setState] = useState(() => (target ? { loading: true } : { loading: false, role: BLANK }));

  useEffect(() => {
    if (!target) return undefined;
    let alive = true;
    getRoleById(target)
      .then((role) => {
        if (!alive) return;
        setState(id
          ? { loading: false, role }
          : { loading: false, role: { ...BLANK, description: role.description ?? '', permissions: role.permissions }, source: role });
      })
      .catch(() => {
        if (alive) setState({ loading: false, notFound: true });
      });
    return () => { alive = false; };
  }, [id, target]);

  return state;
};

export default useRoleDoc;
