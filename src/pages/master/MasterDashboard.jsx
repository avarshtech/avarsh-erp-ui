import { useEffect, useCallback, useState, useMemo } from 'react';
import { Breadcrumb, Skeleton, Button, Tooltip, App } from 'antd';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import {
  DatabaseOutlined, AppstoreOutlined, TagsOutlined, ExperimentOutlined,
  GoldOutlined, SkinOutlined, TeamOutlined, FileProtectOutlined,
  ShopOutlined, HighlightOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  CreditCardOutlined, ColumnWidthOutlined, ExclamationCircleOutlined,
  ToolOutlined,
  ScissorOutlined,
  DollarOutlined,
  MinusCircleOutlined,
  PlusCircleOutlined,
  IssuesCloseOutlined,
  SlidersOutlined,
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
import ProcessMaster from './ProcessMaster';
import PartsMaster from './PartsMaster';
import OverheadMaster from './OverheadMaster';
import DefectTypeMaster from './DefectTypeMaster';
import TrimsQCCriteriaMaster from './TrimsQCCriteriaMaster';
import BpDebitTypeMaster from './BpDebitTypeMaster';
import BpChargeTypeMaster from './BpChargeTypeMaster';
import BpIssueTypeMaster from './BpIssueTypeMaster';
import BpToleranceSettings from './BpToleranceSettings';
import { useStore } from '../../context/StoreContext';
import { useTheme } from '../../context/ThemeContext';
import { hasModuleAccess } from '../../utils/permissions';
import {
  getAllCategories,
  getAllSubCategories,
  getAllItemTypes,
  getAllAttributes,
  getAllUOMs,
} from '../../services/master/masterDataService';
import { getStyles } from '../../services/master/styleService';
import { getAllPaymentTerms } from '../../services/master/paymentTermsService';
import { getAllSizePresets } from '../../services/master/sizePresetService';

// Group accent colors for left border on group headers
const GROUP_ACCENT = {
  business: 'var(--info-color)',
  catalog: 'var(--btn-duplicate-color)',
  style: 'var(--success-color)',
  commercial: 'var(--warning-color)',
  manufacturing: 'var(--error-color)',
  quality: 'var(--primary-color)',
  billPassing: 'var(--btn-print-color)',
};

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
        description: 'Fabric, trims and accessories vendors',
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
      {
        key: 'overhead',
        label: 'Overheads',
        icon: <DollarOutlined />,
        moduleId: 'overhead-master',
        Component: OverheadMaster,
        loadingKey: null,
        description: 'Overhead and markup cost categories for costing',
      },
    ],
  },
  {
    groupKey: 'manufacturing',
    label: 'Manufacturing',
    items: [
      {
        key: 'process',
        label: 'Processes',
        icon: <ToolOutlined />,
        moduleId: 'process-master',
        Component: ProcessMaster,
        loadingKey: null,
        description: 'Manufacturing processes and allowance defaults for BOM',
      },
      {
        key: 'parts',
        label: 'Parts',
        icon: <ScissorOutlined />,
        moduleId: 'parts-master',
        Component: PartsMaster,
        loadingKey: null,
        description: 'Garment part names for BOM line items',
      },
    ],
  },
  {
    groupKey: 'quality',
    label: 'Quality Control',
    items: [
      {
        key: 'defect-type',
        label: 'Defect Types',
        icon: <ExperimentOutlined />,
        moduleId: 'inventory-qc',
        Component: DefectTypeMaster,
        loadingKey: null,
        description: 'Defect types for fabric QC inspection',
      },
      {
        key: 'trims-qc-criteria',
        label: 'Trims QC Criteria',
        icon: <FileProtectOutlined />,
        moduleId: 'inventory-qc',
        Component: TrimsQCCriteriaMaster,
        loadingKey: null,
        description: 'Criteria checking master for trims QC inspection',
      },
    ],
  },
  {
    groupKey: 'billPassing',
    label: 'Bill Passing',
    items: [
      {
        key: 'bp-debit-type',
        label: 'Debit Types',
        icon: <MinusCircleOutlined />,
        moduleId: 'inventory-bill-passing',
        Component: BpDebitTypeMaster,
        loadingKey: null,
        description: 'Reasons a supplier invoice can be debited, and whether each needs a QC reference',
      },
      {
        key: 'bp-charge-type',
        label: 'Charge Types',
        icon: <PlusCircleOutlined />,
        moduleId: 'inventory-bill-passing',
        Component: BpChargeTypeMaster,
        loadingKey: null,
        description: 'Freight, insurance and other charges addable to a bill, with their default GST treatment',
      },
      {
        key: 'bp-issue-type',
        label: 'Issue Types',
        icon: <IssuesCloseOutlined />,
        moduleId: 'inventory-bill-passing',
        Component: BpIssueTypeMaster,
        loadingKey: null,
        description: 'Query and hold reasons, and which of them block a bill from reaching approval',
      },
      {
        key: 'bp-tolerance',
        label: 'Tolerance Settings',
        icon: <SlidersOutlined />,
        moduleId: 'inventory-bill-passing',
        Component: BpToleranceSettings,
        loadingKey: null,
        description: 'Quantity, rate and value variance limits used by the four-way match',
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

/* ── Inline styles ── */

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

const MasterDashboard = () => {
  const { message, modal } = App.useApp();
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
        <div style={{ padding: 24 }}>
          <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 0 }} style={{ marginBottom: 24 }} />
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      );
    }
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
        <h1 style={{ marginBottom: 0 }}>Master Data Management</h1>
        <p style={{ color: descriptionColor, marginTop: 4 }}>
          Manage reference data for your garment operations
        </p>
      </div>

      {/* Two-panel layout — fills remaining height */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Left navigation panel ── */}
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

          {/* Navigation items — scrollable */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: navCollapsed ? '8px 0' : '4px 0',
          }}>
            {navCollapsed ? (
              /* ── Collapsed: icon grid with tooltips ── */
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
              /* ── Expanded: grouped items with accent headers ── */
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

          {/* ── Collapse/Expand button at bottom ── */}
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

        {/* ── Right content panel ── */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Breadcrumb + active item description — pinned */}
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
