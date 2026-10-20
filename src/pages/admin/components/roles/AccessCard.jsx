import { useCallback, useMemo, useState } from 'react';
import { Empty } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import DetailCard from '../../../../components/DetailCard';
import useResponsive from '../../../../hooks/useResponsive';
import { getBlockedReason, getEmptyPermissions } from '../../../../utils/permissions';
import AccessGrid from './AccessGrid';
import AccessToolbar from './AccessToolbar';
import SectionNav from './SectionNav';
import {
  addViewEverywhere, fromStored, toggleColumn, toggleOp, toggleScreen, toggleSection,
} from './permissionMatrixModel';
import { screenCount } from './accessGridModel';

/**
 * The editor's Access card: the sections in the Master-Data-style nav, the open section's boxes
 * beside it. Owns only what it shows (the nav's fold); the rights belong to the editor.
 */
const AccessCard = ({ screensAll, access, permissions, onChange, changedKeys, roles }) => {
  const { isMobileOrTablet } = useResponsive();
  const [collapsed, setCollapsed] = useState(isMobileOrTablet);
  const { section, jumpTo } = access;

  const blockedFor = useCallback((screenId) => getBlockedReason(screenId, permissions), [permissions]);
  const on = useMemo(() => ({
    op: (screen, op, checked) => onChange(toggleOp(permissions, screen, op, checked)),
    screen: (screen, checked) => onChange(toggleScreen(permissions, screen, checked)),
    section: (checked) => onChange(toggleSection(permissions, section.screens, checked)),
    column: (op, checked) => onChange(toggleColumn(permissions, section.screens, op, checked)),
    jump: (screenId) => jumpTo(screensAll.find((s) => s.id === screenId)?.section ?? section.key),
  }), [permissions, onChange, section, jumpTo, screensAll]);

  const more = (key) => {
    if (key === 'view') onChange(addViewEverywhere(permissions, screensAll));
    if (key === 'clear') onChange(getEmptyPermissions());
    const source = roles.find((r) => key === `copy:${r.id}`);
    if (source) onChange(fromStored(source.permissions));
  };

  const count = screenCount(permissions, section.screens);

  return (
    <DetailCard
      title="Access"
      icon={<SafetyOutlined />}
      bare
      style={{ marginBottom: 16 }}
      extra={(
        <AccessToolbar
          query={access.query} onQuery={access.setQuery}
          filter={access.filter} onFilter={access.setFilter}
          roles={roles} onMore={more}
        />
      )}
    >
      <div className="ag-split">
        <SectionNav
          items={access.items}
          activeKey={section.key}
          onSelect={access.select}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
        />
        <div className="ag-panel">
          <div className="ag-panel-head">
            <span className="ag-panel-title">{section.label}</span>
            <span className="ag-panel-count">{count.granted} of {count.total} screens</span>
          </div>
          {section.description && <div className="ag-panel-note">{section.description}</div>}
          <AccessGrid
            mode="edit"
            section={section}
            rows={access.rows}
            permissions={permissions}
            changedKeys={changedKeys}
            blockedFor={blockedFor}
            on={on}
            emptyText={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing here matches" />}
          />
        </div>
      </div>
    </DetailCard>
  );
};

export default AccessCard;
