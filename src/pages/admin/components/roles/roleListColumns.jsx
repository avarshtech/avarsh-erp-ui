import { Button, Space, Tag, Typography } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import PermissionGuard from '../../../../components/PermissionGuard';
import StatusBadge from '../../../../components/StatusBadge';
import { ActionButton, DeleteConfirm } from '../../../../components/buttons';
import { formatDate } from '../../../../utils/formatters';
import { deleteBlockedReason, editBlockedReason } from './roleGuards';

const { Text } = Typography;

/**
 * The roles register, one line per role. The name opens the view dialog; Edit goes straight to
 * the editor; Edit and Delete say why when the API would refuse them. `access(role)` gives the
 * role's { granted, total } screens.
 */
export const buildRoleColumns = ({ access, viewer, deletingId, onView, onEdit, onDelete }) => [
  {
    title: 'Role',
    dataIndex: 'name',
    key: 'name',
    fixed: 'left',
    render: (name, role) => (
      <Space size={8}>
        <SafetyOutlined style={{ color: 'var(--primary-color)' }} />
        <Button type="link" style={{ padding: 0, height: 'auto', fontWeight: 600 }} onClick={() => onView(role)}>{name}</Button>
        {role.isSuperuser && <Tag color="purple" style={{ borderRadius: 20, marginInlineEnd: 0 }}>Superuser</Tag>}
      </Space>
    ),
  },
  {
    title: 'Description',
    dataIndex: 'description',
    key: 'description',
    render: (description) => <Text type="secondary">{description || '—'}</Text>,
  },
  { title: 'Users', dataIndex: 'userCount', key: 'users', align: 'center', render: (n) => n ?? '—' },
  {
    title: 'Access',
    key: 'access',
    render: (_, role) => {
      const { granted, total } = access(role);
      return `${granted} of ${total} screens`;
    },
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    align: 'center',
    render: (status) => <StatusBadge status={status === 'INACTIVE' ? 'inactive' : 'active'} />,
  },
  { title: 'Updated', key: 'updated', render: (_, role) => formatDate(role.updatedAt ?? role.createdAt, 'DD MMM YYYY') },
  {
    title: 'Actions',
    key: 'actions',
    fixed: 'right',
    align: 'center',
    render: (_, role) => {
      const editReason = editBlockedReason(role, viewer);
      const deleteReason = deleteBlockedReason(role);
      return (
        <Space size="small">
          <ActionButton action="view" onClick={() => onView(role)} />
          <PermissionGuard module="roles" operation="update">
            <ActionButton action="edit" tooltip={editReason ?? 'Edit'} disabled={Boolean(editReason)} onClick={() => onEdit(role)} />
          </PermissionGuard>
          <PermissionGuard module="roles" operation="delete">
            <DeleteConfirm
              title="Delete role"
              recordLabel={role.name}
              onConfirm={() => onDelete(role)}
              loading={deletingId === role.id}
              disabled={Boolean(deleteReason)}
            >
              <ActionButton action="delete" tooltip={deleteReason ?? 'Delete'} disabled={Boolean(deleteReason)} />
            </DeleteConfirm>
          </PermissionGuard>
        </Space>
      );
    },
  },
];
