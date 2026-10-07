import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Card, Col, Input, Row, Table } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { deleteRole, getRoles } from '../../services/admin/roleService';
import { getCurrentRoleId, getPermissionSections, isSuperuser } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import { ActionButton } from '../../components/buttons';
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { getTablePagination } from '../../utils/paginationConfig';
import RoleViewDialog from './components/roles/RoleViewDialog';
import useRoleViewer from './components/roles/useRoleViewer';
import { buildRoleColumns } from './components/roles/roleListColumns';
import { fromStored } from './components/roles/permissionMatrixModel';
import { screenCount } from './components/roles/accessGridModel';

const asList = (res) => (Array.isArray(res) ? res : (res?.content || res?.data || []));

/**
 * Role & Access: the roles register. A role opens read-only in the view dialog (the Supplier PO
 * view's design); Edit and Add go to the editor page, which comes back here with ?viewId so the
 * dialog shows what was saved. API errors are toasted by axiosInstance, never again here.
 */
const RoleAccess = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const dialog = useRoleViewer();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const viewer = useMemo(() => ({ roleId: getCurrentRoleId(), superuser: isSuperuser() }), []);
  const screensAll = useMemo(() => getPermissionSections().flatMap((s) => s.screens), []);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      setRoles(asList(await getRoles()));
    } catch {
      // axiosInstance has already shown the server's message
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const { close } = dialog;
  const handleDelete = useCallback(async (role) => {
    setDeletingId(role.id);
    try {
      await deleteRole(role.id);
      message.success('Role deleted');
      close();
      fetchRoles();
    } catch {
      // axiosInstance has already shown the server's message
    } finally {
      setDeletingId(null);
    }
  }, [fetchRoles, message, close]);

  const accessById = useMemo(
    () => new Map(roles.map((r) => [r.id, screenCount(fromStored(r.permissions), screensAll)])),
    [roles, screensAll],
  );

  const columns = useMemo(() => buildRoleColumns({
    access: (role) => accessById.get(role.id),
    viewer,
    deletingId,
    onView: dialog.view,
    onEdit: (role) => navigate(`/admin/roles/edit/${role.id}`),
    onDelete: handleDelete,
  }), [accessById, viewer, deletingId, dialog.view, navigate, handleDelete]);

  const query = searchText.trim().toLowerCase();
  const filteredRoles = query
    ? roles.filter((r) => r.name?.toLowerCase().includes(query) || r.description?.toLowerCase().includes(query))
    : roles;
  const { viewing } = dialog;

  return (
    <div>
      <Card>
        <PageHeader title="Role & Access Management" subtitle="Define roles and what each one can open and do">
          <PermissionGuard module="roles" operation="add">
            <ActionButton action="create" text="Add Role" onClick={() => navigate('/admin/roles/new')} />
          </PermissionGuard>
        </PageHeader>

        <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={20} sm={12} md={8}>
            <Input
              name="roleSearch"
              placeholder="Search by role name or description..."
              prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={4} sm={4} md={2} style={{ display: 'flex' }}>
            <ActionButton action="refresh" tooltip="Refresh" size="middle" onClick={fetchRoles} />
          </Col>
        </Row>

        <Table
          className="table-nowrap"
          columns={columns}
          dataSource={filteredRoles}
          rowKey="id"
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={getTablePagination(undefined, 'roles')}
          locale={{ emptyText: <EmptyState description="No roles found" /> }}
        />
      </Card>

      <RoleViewDialog
        role={viewing}
        open={dialog.open}
        onClose={close}
        afterClose={dialog.clear}
        holders={dialog.holders}
        viewer={viewer}
        deleting={viewing != null && deletingId === viewing.id}
        onDelete={() => handleDelete(viewing)}
        onEdit={() => { close(); navigate(`/admin/roles/edit/${viewing.id}`); }}
        onDuplicate={() => { close(); navigate(`/admin/roles/new?from=${viewing.id}`); }}
      />
    </div>
  );
};

export default RoleAccess;
