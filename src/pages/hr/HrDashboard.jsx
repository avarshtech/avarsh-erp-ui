import { useEffect, useState, useMemo } from 'react';
import { Breadcrumb, Skeleton, Button, Tooltip, App } from 'antd';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import {
  BankOutlined, ApartmentOutlined, IdcardOutlined,
  ClockCircleOutlined, CalendarOutlined, FileProtectOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import FactoryMaster from './masters/FactoryMaster';
import DepartmentMaster from './masters/DepartmentMaster';
import DesignationMaster from './masters/DesignationMaster';
import ShiftMaster from './masters/ShiftMaster';
import HolidayMaster from './masters/HolidayMaster';
import LeaveTypeMaster from './masters/LeaveTypeMaster';
import { useTheme } from '../../context/ThemeContext';
import { hasModuleAccess } from '../../utils/permissions';

// Group accent colors for left border on group headers
const GROUP_ACCENT = {
  organization: 'var(--info-color)',
  schedule: 'var(--warning-color)',
  leave: 'var(--success-color)',
};

// Static navigation config
const NAV_GROUPS = [
  {
    groupKey: 'organization',
    label: 'Organization',
    items: [
      {
        key: 'factory',
        label: 'Factories',
        icon: <BankOutlined />,
        moduleId: 'hr-masters',
        Component: FactoryMaster,
        description: 'Factory locations and addresses',
      },
      {
        key: 'department',
        label: 'Departments',
        icon: <ApartmentOutlined />,
        moduleId: 'hr-masters',
        Component: DepartmentMaster,
        description: 'Departments within each factory',
      },
      {
        key: 'designation',
        label: 'Designations',
        icon: <IdcardOutlined />,
        moduleId: 'hr-masters',
        Component: DesignationMaster,
        description: 'Job titles and employee categories',
      },
    ],
  },
  {
    groupKey: 'schedule',
    label: 'Work Schedule',
    items: [
      {
        key: 'shift',
        label: 'Shifts',
        icon: <ClockCircleOutlined />,
        moduleId: 'hr-masters',
        Component: ShiftMaster,
        description: 'Work shift timings and break schedules',
      },
      {
        key: 'holiday',
        label: 'Holidays',
        icon: <CalendarOutlined />,
        moduleId: 'hr-masters',
        Component: HolidayMaster,
        description: 'Annual holiday calendar by factory',
      },
    ],
  },
  {
    groupKey: 'leave',
    label: 'Leave Policy',
    items: [
      {
        key: 'leave-type',
        label: 'Leave Types',
        icon: <FileProtectOutlined />,
        moduleId: 'hr-masters',
        Component: LeaveTypeMaster,
        description: 'Leave categories, accrual rules and entitlements',
      },
    ],
  },
];

// Permission-filtered nav groups
const getAccessibleGroups = () =>
  NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasModuleAccess(item.moduleId)),
    }))
    .filter(group => group.items.length > 0);

/* -- Inline styles -- */

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

const navItemDefault = {
  ...navItemBase,
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

const HrDashboard = () => {
  const { modal } = App.useApp();
  const { isDarkMode } = useTheme();

  const accessibleGroups = useMemo(getAccessibleGroups, []);
  const accessibleItems = useMemo(
    () => accessibleGroups.flatMap(g => g.items.map(item => ({ ...item, groupLabel: g.label }))),
    [accessibleGroups],
  );

  const [selectedKey, setSelectedKey] = useState(() => accessibleItems[0]?.key ?? 'factory');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [childIsDirty, setChildIsDirty] = useState(false);
  const [hoveredKey, setHoveredKey] = useState(null);

  // Warn on browser tab close/refresh when a child form is dirty
  useUnsavedChanges(childIsDirty);

  // Reset dirty state whenever the active master changes
  useEffect(() => {
    setChildIsDirty(false);
  }, [selectedKey]);

  // Intercept left-nav menu clicks when child has unsaved changes
  const handleMenuSelect = (key) => {
    if (key === selectedKey) return;
    if (childIsDirty) {
      modal.confirm({
        title: 'Unsaved Changes',
        icon: <ExclamationCircleOutlined />,
        content: 'You have unsaved changes that will be lost if you leave this page. Do you want to continue?',
        okText: 'Leave',
        okType: 'danger',
        cancelText: 'Stay',
        onOk: () => {
          setSelectedKey(key);
          setChildIsDirty(false);
        },
      });
    } else {
      setSelectedKey(key);
    }
  };

  // Active item lookup
  const activeItem = useMemo(() =>
    accessibleItems.find(item => item.key === selectedKey) ?? accessibleItems[0]
  , [accessibleItems, selectedKey]);

  // Breadcrumb
  const breadcrumbItems = useMemo(() => [
    { title: 'HR Management' },
    { title: activeItem.groupLabel },
    { title: activeItem.label },
  ], [activeItem]);

  // Content area
  const renderContent = () => {
    const { Component } = activeItem;
    return <Component onDirtyChange={setChildIsDirty} />;
  };

  const descriptionColor = 'var(--text-secondary)';

  // Compute item style with hover state
  const getItemStyle = (itemKey) => {
    if (itemKey === selectedKey) return navItemSelected;
    if (itemKey === hoveredKey) {
      return {
        ...navItemDefault,
        background: 'var(--primary-light)',
        color: 'var(--primary-color)',
      };
    }
    return navItemDefault;
  };

  const getCollapsedItemStyle = (itemKey) => {
    if (itemKey === selectedKey) return collapsedItemSelected;
    if (itemKey === hoveredKey) {
      return {
        ...collapsedItemBase,
        background: 'var(--primary-light)',
        color: 'var(--primary-color)',
      };
    }
    return collapsedItemBase;
  };

  return (
    <div className="animate-fade-in-up" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 112px)',
      overflow: 'hidden',
    }}>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 20, flexShrink: 0 }}>
        <h1 style={{ marginBottom: 0 }}>HR Management</h1>
        <p style={{ color: descriptionColor, marginTop: 4 }}>
          Manage organizational structure, work schedules and leave policies
        </p>
      </div>

      {/* Two-panel layout */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* Left navigation panel */}
        <div style={{
          width: navCollapsed ? 56 : 248,
          flexShrink: 0,
          background: 'var(--card-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'width',
        }}>

          {/* Navigation items -- scrollable */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: navCollapsed ? '8px 0' : '4px 0',
          }}>
            {navCollapsed ? (
              /* Collapsed: icon grid with tooltips */
              accessibleGroups.map((group, gi) => (
                <div key={group.groupKey}>
                  {gi > 0 && (
                    <div style={{
                      margin: '6px 10px',
                      borderTop: '1px solid var(--border-color)',
                    }} />
                  )}
                  {group.items.map(item => (
                    <Tooltip key={item.key} title={item.label} placement="right">
                      <div
                        onClick={() => handleMenuSelect(item.key)}
                        onMouseEnter={() => setHoveredKey(item.key)}
                        onMouseLeave={() => setHoveredKey(null)}
                        style={getCollapsedItemStyle(item.key)}
                      >
                        {item.icon}
                      </div>
                    </Tooltip>
                  ))}
                </div>
              ))
            ) : (
              /* Expanded: grouped items with accent headers */
              accessibleGroups.map((group, gi) => (
                <div key={group.groupKey} style={{ marginTop: gi > 0 ? 4 : 0 }}>
                  {/* Group header */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0,
                    padding: '10px 16px 6px 16px',
                    marginTop: gi > 0 ? 4 : 4,
                  }}>
                    <div style={{
                      width: 2,
                      height: 12,
                      borderRadius: 1,
                      background: GROUP_ACCENT[group.groupKey] || 'var(--border-color)',
                      marginRight: 8,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {group.label}
                    </span>
                  </div>

                  {/* Group items */}
                  {group.items.map(item => (
                    <div
                      key={item.key}
                      onClick={() => handleMenuSelect(item.key)}
                      onMouseEnter={() => setHoveredKey(item.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      style={getItemStyle(item.key)}
                    >
                      <span style={{
                        fontSize: 15,
                        lineHeight: 1,
                        flexShrink: 0,
                        opacity: item.key === selectedKey || item.key === hoveredKey ? 1 : 0.7,
                        transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}>
                        {item.icon}
                      </span>
                      <span style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Collapse/Expand button at bottom */}
          <div style={{
            borderTop: '1px solid var(--border-color)',
            padding: '6px',
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Tooltip title={navCollapsed ? 'Expand menu' : 'Collapse menu'} placement="right">
              <Button
                type="text"
                size="small"
                icon={navCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setNavCollapsed(v => !v)}
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

        {/* Right content panel */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Breadcrumb + active item description */}
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            paddingBottom: 12,
            marginBottom: 12,
            borderBottom: '1px solid var(--border-color)',
            flexWrap: 'wrap',
            gap: 4,
            flexShrink: 0,
          }}>
            <Breadcrumb items={breadcrumbItems} />
            <span style={{ fontSize: 12, color: descriptionColor }}>
              {activeItem.description}
            </span>
          </div>

          {/* Active master component */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {renderContent()}
          </div>
        </div>
      </div>

    </div>
  );
};

export default HrDashboard;
