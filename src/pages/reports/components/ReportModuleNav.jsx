import { memo, useState, useMemo } from 'react';
import { Badge, Button, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { MODULE_GROUPS, MODULE_ICONS, MODULE_COLORS, GROUPED_MODULES } from '../../../utils/reportConstants';

/* ── Inline styles (MasterDashboard pattern) ── */

const navItemBase = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 16px',
  margin: '1px 8px',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  position: 'relative',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  color: 'var(--text-secondary)',
  userSelect: 'none',
  borderLeft: '3px solid transparent',
};

const navItemSelected = {
  ...navItemBase,
  background: 'var(--primary-light)',
  color: 'var(--primary-color)',
  borderLeft: '3px solid var(--primary-color)',
  fontWeight: 600,
};

const collapsedItemBase = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  margin: '2px auto',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: 16,
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  color: 'var(--text-secondary)',
};

const collapsedItemSelected = {
  ...collapsedItemBase,
  background: 'var(--primary-light)',
  color: 'var(--primary-color)',
};

/**
 * Left navigation panel for the Reports module.
 * Modeled on MasterDashboard's collapsible grouped navigation.
 *
 * @param {Object} props
 * @param {Record<string, number>} props.moduleCounts - Map of module key → report count
 * @param {string|null} props.selectedModule - Currently selected module key, null = "All"
 * @param {function} props.onSelect - Called with module key or null
 */
const ReportModuleNav = memo(function ReportModuleNav({
  moduleCounts = {},
  selectedModule,
  onSelect,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoveredKey, setHoveredKey] = useState(null);

  // Build groups from MODULE_GROUPS, filtering out modules with 0 reports.
  // Modules the UI has no group for still get listed under "Other" — otherwise a
  // report whose module was added backend-side would be unreachable from the nav.
  const groups = useMemo(() => {
    const toItem = (mod) => ({
      key: mod,
      label: mod.replace(/_/g, ' '),
      count: moduleCounts[mod] || 0,
      Icon: MODULE_ICONS[mod] || AppstoreOutlined,
      color: MODULE_COLORS[mod] || 'default',
    });

    const known = MODULE_GROUPS
      .map((group) => ({
        ...group,
        items: group.modules.filter((mod) => (moduleCounts[mod] || 0) > 0).map(toItem),
      }))
      .filter((group) => group.items.length > 0);

    const ungrouped = Object.keys(moduleCounts)
      .filter((mod) => (moduleCounts[mod] || 0) > 0 && !GROUPED_MODULES.includes(mod))
      .map(toItem);

    return ungrouped.length
      ? [...known, {
          groupKey: 'other',
          label: 'Other',
          accent: 'var(--text-secondary)',
          items: ungrouped,
        }]
      : known;
  }, [moduleCounts]);

  const totalReports = useMemo(
    () => Object.values(moduleCounts).reduce((sum, c) => sum + c, 0),
    [moduleCounts],
  );

  const getItemStyle = (key) => {
    if (key === selectedModule) return navItemSelected;
    if (key === hoveredKey) {
      return { ...navItemBase, background: 'var(--primary-light)', color: 'var(--primary-color)' };
    }
    return navItemBase;
  };

  const getCollapsedStyle = (key) => {
    if (key === selectedModule) return collapsedItemSelected;
    if (key === hoveredKey) {
      return { ...collapsedItemBase, background: 'var(--primary-light)', color: 'var(--primary-color)' };
    }
    return collapsedItemBase;
  };

  return (
    <div
      style={{
        width: collapsed ? 56 : 248,
        flexShrink: 0,
        background: 'var(--card-bg)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
        willChange: 'width',
      }}
    >
      {/* Scrollable nav items */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: collapsed ? '8px 0' : '4px 0',
        }}
      >
        {/* "All Reports" option */}
        {collapsed ? (
          <Tooltip title={`All Reports (${totalReports})`} placement="right">
            <div
              onClick={() => onSelect(null)}
              onMouseEnter={() => setHoveredKey('__all__')}
              onMouseLeave={() => setHoveredKey(null)}
              style={selectedModule === null
                ? collapsedItemSelected
                : hoveredKey === '__all__'
                  ? { ...collapsedItemBase, background: 'var(--primary-light)', color: 'var(--primary-color)' }
                  : collapsedItemBase
              }
            >
              <AppstoreOutlined />
            </div>
          </Tooltip>
        ) : (
          <div
            onClick={() => onSelect(null)}
            onMouseEnter={() => setHoveredKey('__all__')}
            onMouseLeave={() => setHoveredKey(null)}
            style={selectedModule === null
              ? navItemSelected
              : hoveredKey === '__all__'
                ? { ...navItemBase, background: 'var(--primary-light)', color: 'var(--primary-color)' }
                : navItemBase
            }
          >
            <AppstoreOutlined style={{ fontSize: 15, flexShrink: 0 }} />
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              All Reports
            </span>
            <Badge
              count={totalReports}
              size="small"
              color="var(--text-muted)"
              style={{ fontSize: 11 }}
            />
          </div>
        )}

        {/* Separator */}
        <div style={{ margin: collapsed ? '6px 10px' : '6px 16px', borderTop: '1px solid var(--border-color)' }} />

        {/* Module groups */}
        {collapsed ? (
          groups.map((group, gi) => (
            <div key={group.groupKey}>
              {gi > 0 && (
                <div style={{ margin: '6px 10px', borderTop: '1px solid var(--border-color)' }} />
              )}
              {group.items.map((item) => (
                <Tooltip key={item.key} title={`${item.label} (${item.count})`} placement="right">
                  <div
                    onClick={() => onSelect(item.key)}
                    onMouseEnter={() => setHoveredKey(item.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                    style={getCollapsedStyle(item.key)}
                  >
                    <item.Icon />
                  </div>
                </Tooltip>
              ))}
            </div>
          ))
        ) : (
          groups.map((group, gi) => (
            <div key={group.groupKey} style={{ marginTop: gi > 0 ? 4 : 0 }}>
              {/* Group header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0,
                  padding: '10px 16px 6px 16px',
                  marginTop: gi > 0 ? 4 : 4,
                }}
              >
                <div
                  style={{
                    width: 2,
                    height: 12,
                    borderRadius: 1,
                    background: group.accent,
                    marginRight: 8,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    lineHeight: 1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {group.label}
                </span>
              </div>

              {/* Group items */}
              {group.items.map((item) => (
                <div
                  key={item.key}
                  onClick={() => onSelect(item.key)}
                  onMouseEnter={() => setHoveredKey(item.key)}
                  onMouseLeave={() => setHoveredKey(null)}
                  style={getItemStyle(item.key)}
                >
                  <span
                    style={{
                      fontSize: 15,
                      lineHeight: 1,
                      flexShrink: 0,
                      opacity: item.key === selectedModule || item.key === hoveredKey ? 1 : 0.7,
                      transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <item.Icon />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.label}
                  </span>
                  <Badge
                    count={item.count}
                    size="small"
                    color="var(--text-muted)"
                    style={{ fontSize: 11 }}
                  />
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Collapse/Expand button */}
      <div
        style={{
          borderTop: '1px solid var(--border-color)',
          padding: '6px',
          display: 'flex',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Tooltip title={collapsed ? 'Expand menu' : 'Collapse menu'} placement="right">
          <Button
            type="text"
            size="small"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed((v) => !v)}
            style={{
              color: 'var(--text-muted)',
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </Tooltip>
      </div>
    </div>
  );
});

export default ReportModuleNav;
