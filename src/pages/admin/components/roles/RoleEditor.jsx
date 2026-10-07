import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form } from 'antd';
import DocumentHero from '../../../../components/DocumentHero';
import useUnsavedChanges from '../../../../hooks/useUnsavedChanges';
import { getPermissionSections, validatePermissions } from '../../../../utils/permissions';
import { buildRoleHero } from './roleHero';
import RoleBanners from './RoleBanners';
import RoleDetailsCard from './RoleDetailsCard';
import AccessCard from './AccessCard';
import RoleActionBar from './RoleActionBar';
import useRoleDraft from './useRoleDraft';
import useRoleCatalog from './useRoleCatalog';
import useAccessView from './useAccessView';
import useRoleActions from './useRoleActions';
import { changeKey, groupChanges, rightsCount, screenCount } from './accessGridModel';
import { normalName, renameBlockedReason } from './roleGuards';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The role editor page, for adding and for editing: the hero, the role's fields, the Access card —
 * sections in the nav, one section's boxes beside it — and the bar that saves. Mounted once the
 * role is loaded and keyed by it (RoleForm), so every piece of state starts from the loaded role.
 */
const RoleEditor = ({ role, source, isNew }) => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const sections = useMemo(() => getPermissionSections(), []);
  const screensAll = useMemo(() => sections.flatMap((s) => s.screens), [sections]);
  const draft = useRoleDraft(isNew ? null : role.permissions, role.permissions, screensAll);

  const initialValues = useMemo(
    () => ({ name: role.name, description: role.description ?? '', active: role.status !== 'INACTIVE' }),
    [role],
  );
  const values = Form.useWatch([], form);
  const detailsDirty = Boolean(values) && (
    (values.name ?? '') !== initialValues.name
    || (values.description ?? '') !== initialValues.description
    || (values.active ?? true) !== initialValues.active
  );
  const dirty = draft.changes.length > 0 || detailsDirty;
  const { clearDirty } = useUnsavedChanges(dirty);

  const catalog = useRoleCatalog(role.id);
  const takenNames = useMemo(() => new Set(catalog.map((r) => normalName(r.name))), [catalog]);
  const access = useAccessView(sections, draft.permissions, draft.changes);
  const changedKeys = useMemo(() => new Set(draft.changes.map((c) => changeKey(c.screen.id, c.op))), [draft.changes]);
  const groups = useMemo(() => groupChanges(draft.changes, sections), [draft.changes, sections]);

  const backTo = isNew ? '/admin/roles' : `/admin/roles?viewId=${role.id}`;
  const { saving, save } = useRoleActions({ role, isNew, form, permissions: draft.permissions, dirty, clearDirty, backTo });
  const leave = () => navigate(backTo, { replace: true });

  const screens = screenCount(draft.permissions, screensAll);
  const rights = rightsCount(draft.permissions, screensAll);
  const subtitle = source ? `Copied from ${source.name}` : 'Tick what this role can open and do';
  // A role must grant something — judged when its rights are being set, so a details-only save
  // (deactivating a role that holds nothing, say) still goes through.
  const noRights = (isNew || draft.changes.length > 0) && !validatePermissions(draft.permissions).valid;

  return (
    <div className="animate-fade-in-up">
      <DocumentHero page hero={buildRoleHero(role, { screens, subtitle, showMeta: !isNew })} onBack={leave} />
      <RoleBanners role={role} />
      <RoleDetailsCard
        form={form}
        initialValues={initialValues}
        renameReason={isNew ? null : renameBlockedReason(role)}
        takenNames={takenNames}
      />
      <AccessCard
        screensAll={screensAll}
        access={access}
        permissions={draft.permissions}
        onChange={draft.setPermissions}
        changedKeys={changedKeys}
        roles={catalog}
      />
      <RoleActionBar
        isNew={isNew}
        changes={draft.changes}
        groups={groups}
        rightsText={`${plural(rights, 'right')} on ${plural(screens.granted, 'screen')}`}
        onOpenSection={access.jumpTo}
        saving={saving}
        saveReason={noRights ? 'Tick at least one right' : null}
        onCancel={leave}
        onSave={save}
      />
    </div>
  );
};

export default RoleEditor;
