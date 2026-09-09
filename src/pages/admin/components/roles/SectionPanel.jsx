import { Checkbox, Empty, Typography } from 'antd';
import ScreenRow from './ScreenRow';
import { sectionState } from './permissionMatrixModel';

const { Text } = Typography;

/**
 * The right-hand pane: one section's screens, in aligned columns.
 *
 * Every row — the header included — is its own grid using the SAME column
 * template, so the four CRUD columns line up down the whole section without
 * relying on CSS subgrid.
 */
const SectionPanel = ({ section, screens, permissions, blockedFor, onToggleOp, onToggleScreen, onToggleSection, onJumpToParent, compact }) => {
  const { granted, total, checked, indeterminate } = sectionState(permissions, section.screens);

  return (
    <div className="perm-panel">
      <div className="perm-panel-head">
        <span>
          <Text strong>{section.label}</Text>
          <Text type="secondary" className="perm-panel-sub">
            {' '}· {section.screens.length} screen{section.screens.length === 1 ? '' : 's'} · {granted} of {total} rights
          </Text>
        </span>
        <Checkbox
          checked={checked}
          indeterminate={indeterminate}
          onChange={(e) => onToggleSection(section, e.target.checked)}
        >
          Select all
        </Checkbox>
      </div>

      {section.description && <div className="perm-panel-note">{section.description}</div>}

      {screens.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No screens match the current search or filter" />
      ) : compact ? (
        <div className="perm-cards">
          {screens.map((screen) => (
            <ScreenRow
              key={screen.id}
              compact
              screen={screen}
              permissions={permissions}
              blocked={blockedFor(screen.id)}
              onToggleOp={onToggleOp}
              onToggleScreen={onToggleScreen}
              onJumpToParent={onJumpToParent}
            />
          ))}
        </div>
      ) : (
        <div className="perm-grid" role="table">
          <div className="perm-row perm-head-row" role="row">
            <div className="perm-cell perm-head" role="columnheader">Screen</div>
            <div className="perm-cell perm-head perm-cell-c" role="columnheader">View</div>
            <div className="perm-cell perm-head perm-cell-c" role="columnheader">Add</div>
            <div className="perm-cell perm-head perm-cell-c" role="columnheader">Update</div>
            <div className="perm-cell perm-head perm-cell-c" role="columnheader">Delete</div>
            <div className="perm-cell perm-head" role="columnheader">Approvals &amp; special</div>
          </div>
          {screens.map((screen) => (
            <ScreenRow
              key={screen.id}
              screen={screen}
              permissions={permissions}
              blocked={blockedFor(screen.id)}
              onToggleOp={onToggleOp}
              onToggleScreen={onToggleScreen}
              onJumpToParent={onJumpToParent}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SectionPanel;
