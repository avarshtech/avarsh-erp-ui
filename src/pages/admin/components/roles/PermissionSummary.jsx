import { Alert, Typography } from 'antd';
import EmptyState from '../../../../components/EmptyState';
import { OP_COLORS, opLabel, CRUD_OPS, unknownKeys } from './permissionMatrixModel';

const { Text } = Typography;

/**
 * Granted-only view. Verifying a role used to mean scrolling every section and
 * reading unticked boxes; this shows only what the role actually has, so it
 * doubles as the read-only audit view.
 */
const PermissionSummary = ({ sections, permissions, allScreens }) => {
  const withGrants = sections
    .map((section) => ({
      ...section,
      rows: section.screens
        .map((screen) => ({ screen, ops: screen.ops.filter((op) => permissions?.[screen.id]?.operations?.[op]) }))
        .filter((r) => r.ops.length > 0),
    }))
    .filter((s) => s.rows.length > 0);

  const empty = sections.filter((s) => !withGrants.some((w) => w.key === s.key));
  const orphans = unknownKeys(permissions, allScreens);

  if (withGrants.length === 0) {
    return <EmptyState description="No rights granted — this role cannot open anything." />;
  }

  return (
    <div className="perm-summary">
      {withGrants.map((section) => (
        <div key={section.key} className="perm-summary-section">
          <div className="perm-summary-head">
            <Text strong>{section.label}</Text>
            <Text type="secondary">{section.rows.length} of {section.screens.length} screens</Text>
          </div>
          {section.rows.map(({ screen, ops }) => (
            <div key={screen.id} className="perm-summary-row">
              <Text className="perm-summary-name">{screen.name}</Text>
              <span className="perm-summary-ops">
                {ops.map((op) => (
                  <span
                    key={op}
                    className="perm-summary-op"
                    style={{ color: CRUD_OPS.includes(op) ? 'var(--text-secondary)' : OP_COLORS[op] }}
                  >
                    {opLabel(screen, op)}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      ))}

      {empty.length > 0 && (
        <Alert
          type="warning"
          showIcon
          className="perm-summary-none"
          message="No access at all"
          description={empty.map((s) => s.label).join(' · ')}
        />
      )}

      {orphans.length > 0 && (
        <Alert
          type="info"
          showIcon
          className="perm-summary-none"
          message={`${orphans.length} unrecognised permission${orphans.length === 1 ? '' : 's'} preserved`}
          description={`This role carries keys this version does not know: ${orphans.join(', ')}. They are kept as they are rather than discarded on save.`}
        />
      )}
    </div>
  );
};

export default PermissionSummary;
