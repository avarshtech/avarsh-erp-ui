import { Button, Result, Skeleton } from 'antd';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getCurrentRoleId, isSuperuser } from '../../utils/permissions';
import RoleEditor from './components/roles/RoleEditor';
import useRoleDoc from './components/roles/useRoleDoc';
import { editBlockedReason } from './components/roles/roleGuards';

/**
 * /admin/roles/new (?from=<id> duplicates a role) and /admin/roles/edit/:id. Loads the role,
 * refuses the one the viewer holds — the API would answer 403 — and then mounts the editor keyed
 * by the role, so all of the editor's state starts from what was loaded.
 */
const RoleForm = () => {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const doc = useRoleDoc(id, id ? null : params.get('from'));
  const back = <Button onClick={() => navigate('/admin/roles')}>Back to roles</Button>;

  if (doc.loading) return <Skeleton active paragraph={{ rows: 12 }} />;
  if (doc.notFound) return <Result status="404" title="Role not found" extra={back} />;

  const blocked = id ? editBlockedReason(doc.role, { roleId: getCurrentRoleId(), superuser: isSuperuser() }) : null;
  if (blocked) {
    return <Result status="403" title={blocked} subTitle="Only a superuser can change the role they hold." extra={back} />;
  }
  return <RoleEditor key={doc.role.id ?? 'new'} role={doc.role} source={doc.source} isNew={!id} />;
};

export default RoleForm;
