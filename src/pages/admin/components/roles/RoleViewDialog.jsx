import { useMemo } from 'react';
import { Space } from 'antd';
import ViewDialog from '../../../../components/ViewDialog';
import PermissionGuard from '../../../../components/PermissionGuard';
import { ActionButton, DeleteConfirm } from '../../../../components/buttons';
import { getPermissionSections, hasPermission } from '../../../../utils/permissions';
import RoleBanners from './RoleBanners';
import RoleFactsRow from './RoleFactsRow';
import RoleAccessSummary from './RoleAccessSummary';
import { buildRoleHero } from './roleHero';
import { fromStored } from './permissionMatrixModel';
import { opSummary, rightsCount, screenCount } from './accessGridModel';
import { deleteBlockedReason, editBlockedReason } from './roleGuards';

/**
 * A role, read-only, in the Supplier PO view's design: the hero, the detail-cards row, then every
 * section it can open as a card of ticks — the whole role on one scroll, no section to click into.
 * The footer is POView's: Duplicate and Delete on the left, Edit and Close on the right.
 */
const RoleViewDialog = ({ role, open, onClose, afterClose, holders, viewer, deleting, onDelete, onEdit, onDuplicate }) => {
  const sections = useMemo(() => getPermissionSections(), []);
  const screensAll = useMemo(() => sections.flatMap((s) => s.screens), [sections]);
  const permissions = useMemo(() => fromStored(role?.permissions), [role]);

  if (!role) return null;
  const screens = screenCount(permissions, screensAll);
  const reach = sections
    .map((s) => ({ key: s.key, label: s.label, ...screenCount(permissions, s.screens) }))
    .filter((s) => s.granted > 0);
  const editReason = editBlockedReason(role, viewer);
  const deleteReason = deleteBlockedReason(role);
  const canEdit = hasPermission('roles', 'update') && !editReason;

  const footer = (
    <>
      <Space size="middle">
        <PermissionGuard module="roles" operation="add">
          <ActionButton action="duplicate" text="Duplicate" onClick={onDuplicate} />
        </PermissionGuard>
        <PermissionGuard module="roles" operation="delete">
          <DeleteConfirm title="Delete role" recordLabel={role.name} onConfirm={onDelete} loading={deleting} disabled={Boolean(deleteReason)}>
            <ActionButton action="delete" text="Delete" tooltip={deleteReason ?? undefined} disabled={Boolean(deleteReason)} loading={deleting} />
          </DeleteConfirm>
        </PermissionGuard>
      </Space>
      <Space>
        <PermissionGuard module="roles" operation="update">
          <ActionButton action="edit" text="Edit" tooltip={editReason ?? undefined} disabled={Boolean(editReason)} onClick={onEdit} />
        </PermissionGuard>
        <ActionButton action="close" text="Close" onClick={onClose} />
      </Space>
    </>
  );

  return (
    <ViewDialog
      open={open}
      onClose={onClose}
      afterClose={afterClose}
      hero={buildRoleHero(role, { screens, subtitle: role.description })}
      footer={footer}
    >
      <RoleBanners role={role} />
      <RoleFactsRow
        role={role}
        holders={holders}
        sections={reach}
        summary={opSummary(permissions, screensAll)}
        rights={rightsCount(permissions, screensAll)}
      />
      <RoleAccessSummary
        sections={sections}
        permissions={permissions}
        screens={screens}
        superuser={role.isSuperuser}
        onEdit={canEdit ? onEdit : undefined}
      />
    </ViewDialog>
  );
};

export default RoleViewDialog;
