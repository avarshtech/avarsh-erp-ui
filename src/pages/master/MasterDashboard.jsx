import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { Menu, Breadcrumb, Spin, Button, Tooltip, message, ConfigProvider, Modal } from 'antd';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import {
  DatabaseOutlined, AppstoreOutlined, TagsOutlined, ExperimentOutlined,
  GoldOutlined, SkinOutlined, TeamOutlined, FileProtectOutlined,
  ShopOutlined, HighlightOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  CreditCardOutlined, ColumnWidthOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import CategoryMaster from './CategoryMaster';
import SubCategoryMaster from './SubCategoryMaster';
import ItemTypeMaster from './ItemTypeMaster';
import VariantMaster from './VariantMaster';
import UomMaster from './UomMaster';
import ItemMaster from './ItemMaster';
import BuyerMaster from './BuyerMaster';
import SupplierMaster from './SupplierMaster';
import TermsConditionsMaster from './TermsConditionsMaster';
import StyleMaster from './StyleMaster';
import PaymentTermsMaster from './PaymentTermsMaster';
import SizePresetMaster from './SizePresetMaster';
import { useStore } from '../../context/StoreContext';
import { useTheme } from '../../context/ThemeContext';
import { hasModuleAccess } from '../../utils/permissions';
import {
  getAllCategories,
  getAllSubCategories,
  getAllItemTypes,
  getAllAttributes,
  getAllUOMs,
} from '../../services/masterDataService';
import { getStyles } from '../../services/styleService';
import { getAllPaymentTerms } from '../../services/paymentTermsService';
import { getAllSizePresets } from '../../services/sizePresetService';

// Static navigation config — add new master data entries here
const NAV_GROUPS = [
  {
    groupKey: 'business',
    label: 'Business Partners',
    items: [
      {
        key: 'buyer',
        label: 'Buyers',
        icon: <ShopOutlined />,
        moduleId: 'buyer-info',
        Component: BuyerMaster,
        loadingKey: null,
        description: 'Brands and customers who place orders',
      },
      {
        key: 'supplier',
        label: 'Suppliers',
        icon: <TeamOutlined />,
        moduleId: 'supplier-info',
        Component: SupplierMaster,
        loadingKey: null,
        description: 'Fabric, trim and accessories vendors',
      },
    ],
  },
  {
    groupKey: 'catalog',
    label: 'Product Catalog',
    items: [
      {
        key: 'category',
        label: 'Categories',
        icon: <AppstoreOutlined />,
        moduleId: 'master-data',
        Component: CategoryMaster,
        loadingKey: 'categories',
        description: 'Top-level item classification',
      },
      {
        key: 'subcategory',
        label: 'Sub Categories',
        icon: <TagsOutlined />,
        moduleId: 'master-data',
        Component: SubCategoryMaster,
        loadingKey: 'subCategories',
        description: 'Second-level classification under categories',
      },
      {
        key: 'type',
        label: 'Item Types',
        icon: <ExperimentOutlined />,
        moduleId: 'master-data',
        Component: ItemTypeMaster,
        loadingKey: 'itemTypes',
        description: 'Specific types with linked attributes and UOMs',
      },
      {
        key: 'variant',
        label: 'Attributes',
        icon: <GoldOutlined />,
        moduleId: 'master-data',
        Component: VariantMaster,
        loadingKey: 'attributes',
        description: 'Size, colour, finish and other variants',
      },
      {
        key: 'uom',
        label: 'Unit of Measurement',
        icon: <DatabaseOutlined />,
        moduleId: 'master-data',
        Component: UomMaster,
        loadingKey: 'uoms',
        description: 'Units of measurement with decimal precision',
      },
      {
        key: 'item',
        label: 'Items',
        icon: <SkinOutlined />,
        moduleId: 'items',
        Component: ItemMaster,
        loadingKey: null,
        description: 'Fabric, trims and accessories master list',
      },
    ],
  },
  {
    groupKey: 'style',
    label: 'Style Management',
    items: [
      {
        key: 'style',
        label: 'Styles',
        icon: <HighlightOutlined />,
        moduleId: 'style-master',
        Component: StyleMaster,
        loadingKey: 'styles',
        description: 'Garment style references by buyer and season',
      },
      {
        key: 'size-presets',
        label: 'Size Presets',
        icon: <ColumnWidthOutlined />,
        moduleId: 'size-presets',
        Component: SizePresetMaster,
        loadingKey: null,
        description: 'Size run templates by garment category and regional standard',
      },
    ],
  },
  {
    groupKey: 'commercial',
    label: 'Commercial',
    items: [
      {
        key: 'payment-terms',
        label: 'Payment Terms',
        icon: <CreditCardOutlined />,
        moduleId: 'payment-terms',
        Component: PaymentTermsMaster,
        loadingKey: 'paymentTerms',
        description: 'Payment term templates for order entry',
      },
      {
        key: 'terms',
        label: 'Terms & Conditions',
        icon: <FileProtectOutlined />,
        moduleId: 'terms-conditions',
        Component: TermsConditionsMaster,
        loadingKey: null,
        description: 'Contract and terms templates for purchase orders',
      },
    ],
  },
];

// Flatten all items for quick lookup (unfiltered — used after permission filtering)
const ALL_ITEMS = NAV_GROUPS.flatMap(g => g.items.map(item => ({ ...item, groupLabel: g.label })));

// Permission-filtered nav groups — computed once per render (permissions are stable per session)
const getAccessibleGroups = () =>
  NAV_GROUPS
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasModuleAccess(item.moduleId)),
    }))
    .filter(group => group.items.length > 0);

const MasterDashboard = () => {
  const { isDarkMode } = useTheme();
  const {
    categories, subCategories, itemTypes, attributes, uoms, styles, paymentTerms, sizePresets,
    setData, setLoading, loading, isCacheValid,
  } = useStore();

  const accessibleGroups = useMemo(getAccessibleGroups, []);
  const accessibleItems  = useMemo(
    () => accessibleGroups.flatMap(g => g.items.map(item => ({ ...item, groupLabel: g.label }))),
    [accessibleGroups],
  );

  const [selectedKey, setSelectedKey] = useState(() => accessibleItems[0]?.key ?? 'buyer');
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [childIsDirty, setChildIsDirty] = useState(false);

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
      Modal.confirm({
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

  // Fetch all metadata on mount
  const fetchAllMetaData = useCallback(async () => {
    const fetchPromises = [];

    if (!isCacheValid('categories') || categories.length === 0) {
      setLoading('categories', true);
      fetchPromises.push(
        getAllCategories()
          .then(({ data }) => setData('categories', data))
          .catch(() => message.error('Failed to load categories'))
          .finally(() => setLoading('categories', false))
      );
    }

    if (!isCacheValid('subCategories') || subCategories.length === 0) {
      setLoading('subCategories', true);
      fetchPromises.push(
        getAllSubCategories()
          .then(({ data }) => setData('subCategories', data))
          .catch(() => message.error('Failed to load sub-categories'))
          .finally(() => setLoading('subCategories', false))
      );
    }

    if (!isCacheValid('itemTypes') || itemTypes.length === 0) {
      setLoading('itemTypes', true);
      fetchPromises.push(
        getAllItemTypes()
          .then(({ data }) => setData('itemTypes', data))
          .catch(() => message.error('Failed to load item types'))
          .finally(() => setLoading('itemTypes', false))
      );
    }

    if (!isCacheValid('attributes') || attributes.length === 0) {
      setLoading('attributes', true);
      fetchPromises.push(
        getAllAttributes()
          .then(({ data }) => setData('attributes', data))
          .catch(() => message.error('Failed to load attributes'))
          .finally(() => setLoading('attributes', false))
      );
    }

    if (!isCacheValid('uoms') || uoms.length === 0) {
      setLoading('uoms', true);
      fetchPromises.push(
        getAllUOMs()
          .then(({ data }) => setData('uoms', data))
          .catch(() => message.error('Failed to load UOMs'))
          .finally(() => setLoading('uoms', false))
      );
    }

    if (!isCacheValid('styles') || styles.length === 0) {
      setLoading('styles', true);
      fetchPromises.push(
        getStyles()
          .then(data => setData('styles', data))
          .catch(() => message.error('Failed to load styles'))
          .finally(() => setLoading('styles', false))
      );
    }

    if (!isCacheValid('paymentTerms') || paymentTerms.length === 0) {
      setLoading('paymentTerms', true);
      fetchPromises.push(
        getAllPaymentTerms()
          .then(({ data }) => setData('paymentTerms', data))
          .catch(() => message.error('Failed to load payment terms'))
          .finally(() => setLoading('paymentTerms', false))
      );
    }

    if (!isCacheValid('sizePresets') || sizePresets.length === 0) {
      setLoading('sizePresets', true);
      fetchPromises.push(
        getAllSizePresets()
          .then(({ data }) => setData('sizePresets', Array.isArray(data) ? data : []))
          .catch(() => message.error('Failed to load size presets'))
          .finally(() => setLoading('sizePresets', false))
      );
    }

    if (fetchPromises.length > 0) {
      await Promise.allSettled(fetchPromises);
    }
  }, [categories, subCategories, itemTypes, attributes, uoms, styles, paymentTerms, sizePresets, isCacheValid, setData, setLoading]);

  useEffect(() => {
    fetchAllMetaData();
  }, []);

  // Build Ant Design Menu items from accessible groups only
  const menuItems = useMemo(() =>
    accessibleGroups.map(group => ({
      type: 'group',
      label: (
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          color: isDarkMode ? '#64748b' : '#94a3b8',
        }}>
          {group.label}
        </span>
      ),
      children: group.items.map(item => ({
        key: item.key,
        icon: <span style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>{item.icon}</span>,
        label: <span style={{ fontSize: 13 }}>{item.label}</span>,
      })),
    }))
  , [accessibleGroups, isDarkMode]);

  // Active item lookup (from accessible items only)
  const activeItem = useMemo(() =>
    accessibleItems.find(item => item.key === selectedKey) ?? accessibleItems[0]
  , [accessibleItems, selectedKey]);

  // Breadcrumb
  const breadcrumbItems = useMemo(() => [
    { title: 'Master Data' },
    { title: activeItem.groupLabel },
    { title: activeItem.label },
  ], [activeItem]);

  // Content area — render active master component or loading spinner
  const renderContent = () => {
    const { Component, loadingKey, label } = activeItem;
    if (loadingKey && loading[loadingKey]) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <Spin size="large" tip={`Loading ${label.toLowerCase()}...`} />
        </div>
      );
    }
    return <Component onDirtyChange={setChildIsDirty} />;
  };

  const borderColor = isDarkMode ? '#334155' : '#e2e8f0';
  const navBg = isDarkMode ? '#1e293b' : '#ffffff';
  const descriptionColor = isDarkMode ? '#64748b' : '#94a3b8';

  return (
    <div className="animate-fade-in-up" style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 112px)',
      overflow: 'hidden',
    }}>
      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 20, flexShrink: 0 }}>
        <h1 style={{ marginBottom: 0 }}>Master Data Management</h1>
        <p style={{ color: descriptionColor, marginTop: 4 }}>
          Manage reference data for your garment operations
        </p>
      </div>

      {/* Two-panel layout — fills remaining height */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Left navigation panel ── */}
        <div style={{
          width: navCollapsed ? 44 : 240,
          flexShrink: 0,
          background: navBg,
          borderRadius: 12,
          border: `1px solid ${borderColor}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
          willChange: 'width',
        }}>
          {/* Panel header — pinned */}
          <div style={{
            padding: navCollapsed ? '12px 0' : '10px 16px 10px',
            borderBottom: `1px solid ${borderColor}`,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: navCollapsed ? 'center' : 'space-between',
          }}>
            {!navCollapsed && (
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                color: descriptionColor,
              }}>
                Categories
              </div>
            )}
            <Tooltip title={navCollapsed ? 'Expand menu' : 'Collapse menu'} placement="right">
              <Button
                type="text"
                size="small"
                icon={navCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setNavCollapsed(v => !v)}
                style={{ color: descriptionColor, flexShrink: 0 }}
              />
            </Tooltip>
          </div>

          {/* Navigation menu — scrollable */}
          {navCollapsed ? (
            /* Collapsed: icon-only list with tooltips */
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
              {accessibleGroups.map((group, gi) => (
                <div key={group.groupKey}>
                  {gi > 0 && (
                    <div style={{ margin: '4px 6px', borderTop: `1px solid ${borderColor}` }} />
                  )}
                  {group.items.map(item => (
                    <Tooltip key={item.key} title={item.label} placement="right">
                      <div
                        onClick={() => handleMenuSelect(item.key)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 36,
                          cursor: 'pointer',
                          borderRadius: 6,
                          margin: '2px 4px',
                          fontSize: 15,
                          backgroundColor: selectedKey === item.key
                            ? (isDarkMode ? '#312e81' : '#ede9fe')
                            : 'transparent',
                          color: selectedKey === item.key
                            ? '#6366f1'
                            : (isDarkMode ? '#94a3b8' : '#64748b'),
                          transition: 'background-color 0.15s, color 0.15s',
                        }}
                      >
                        {item.icon}
                      </div>
                    </Tooltip>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            /* Expanded: full labelled menu */
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <ConfigProvider
                theme={{
                  components: {
                    Menu: {
                      itemSelectedBg: isDarkMode ? '#312e81' : '#ede9fe',
                      itemSelectedColor: '#6366f1',
                      itemBg: 'transparent',
                      itemHoverBg: isDarkMode ? '#1e3a5f' : '#f5f3ff',
                      itemHoverColor: isDarkMode ? '#a5b4fc' : '#6366f1',
                    },
                  },
                }}
              >
                <Menu
                  mode="inline"
                  selectedKeys={[selectedKey]}
                  onClick={({ key }) => handleMenuSelect(key)}
                  items={menuItems}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: '4px 0 8px',
                  }}
                />
              </ConfigProvider>
            </div>
          )}
        </div>

        {/* ── Right content panel ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Breadcrumb + active item description — pinned */}
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 14,
            flexWrap: 'wrap',
            gap: 4,
            flexShrink: 0,
          }}>
            <Breadcrumb items={breadcrumbItems} />
            <span style={{ fontSize: 12, color: descriptionColor }}>
              {activeItem.description}
            </span>
          </div>

          {/* Active master component — fills remaining height, scrollable */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {renderContent()}
          </div>
        </div>
      </div>

    </div>
  );
};

export default MasterDashboard;
