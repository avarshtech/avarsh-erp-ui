import { Tag } from 'antd';
import { TeamOutlined } from '@ant-design/icons';
import StatusBadge from '../../../../components/StatusBadge';
import { statusAccent } from '../../../../utils/statusAccent';
import { usersLabel } from './roleGuards';

const ROLE_STATUS = { ACTIVE: { color: 'success' }, INACTIVE: { color: 'default' } };

/**
 * The DocumentHero object for a role, shared by the view dialog and the editor page: the accent
 * in the status colour, the name with its status and Superuser tag, the user count, and the
 * screens the role can open in the highlight. `screens` = { granted, total }.
 */
export const buildRoleHero = (role, { screens, subtitle, showMeta = true }) => {
  const active = role.status !== 'INACTIVE';
  return {
    title: role.name || 'New role',
    accentColor: statusAccent(ROLE_STATUS, active ? 'ACTIVE' : 'INACTIVE'),
    status: <StatusBadge status={active ? 'active' : 'inactive'} />,
    tags: role.isSuperuser ? [<Tag key="superuser" color="purple" style={{ borderRadius: 20 }}>Superuser</Tag>] : [],
    subtitle,
    meta: showMeta && role.userCount != null ? [{ icon: <TeamOutlined />, text: usersLabel(role.userCount) }] : [],
    highlight: { label: 'Screens with access', value: `${screens.granted} of ${screens.total}` },
  };
};
