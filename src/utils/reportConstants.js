import {
  ShoppingCartOutlined,
  ShoppingOutlined,
  DollarOutlined,
  InboxOutlined,
  AppstoreOutlined,
  SkinOutlined,
  FileTextOutlined,
  SettingOutlined,
  ScissorOutlined,
  TeamOutlined,
  SendOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';

// Keys must stay in sync with the backend ReportModuleName enum
// (com.avarsh.erp.reporting.enums.ReportModuleName) — a module missing here is
// hidden from the left nav entirely.

/** Module → Ant Design tag color */
export const MODULE_COLORS = {
  ORDER: 'blue',
  PURCHASE_ORDER: 'purple',
  COSTING: 'green',
  ADMIN: 'red',
  INVENTORY: 'orange',
  STYLE: 'magenta',
  BOM: 'geekblue',
  GRN: 'volcano',
  PRODUCTION: 'cyan',
  HR: 'gold',
  SHIPMENT: 'lime',
  FINANCE: 'green',
  APPROVAL: 'purple',
  MASTER_DATA: 'blue',
};

/** Human labels for module keys (fallback: the key with underscores spaced). */
export const MODULE_LABELS = {
  ORDER: 'Orders',
  PURCHASE_ORDER: 'Purchase Orders',
  COSTING: 'Costing',
  ADMIN: 'Administration',
  INVENTORY: 'Inventory',
  STYLE: 'Styles',
  BOM: 'BOM',
  GRN: 'GRN',
  PRODUCTION: 'Production',
  HR: 'HR',
  SHIPMENT: 'Shipment',
  FINANCE: 'Finance',
  APPROVAL: 'Approvals',
  MASTER_DATA: 'Master Data',
};

/** Module → icon component */
export const MODULE_ICONS = {
  ORDER: ShoppingCartOutlined,
  PURCHASE_ORDER: ShoppingOutlined,
  COSTING: DollarOutlined,
  ADMIN: SettingOutlined,
  INVENTORY: InboxOutlined,
  STYLE: SkinOutlined,
  BOM: FileTextOutlined,
  GRN: AppstoreOutlined,
  PRODUCTION: ScissorOutlined,
  HR: TeamOutlined,
  SHIPMENT: SendOutlined,
  FINANCE: BankOutlined,
  APPROVAL: SafetyCertificateOutlined,
  MASTER_DATA: DatabaseOutlined,
};

/** Grouped module navigation for left panel */
export const MODULE_GROUPS = [
  {
    groupKey: 'sales',
    label: 'Sales & Orders',
    accent: 'var(--info-color)',
    modules: ['ORDER', 'COSTING'],
  },
  {
    groupKey: 'procurement',
    label: 'Procurement',
    accent: 'var(--btn-duplicate-color, var(--primary-color))',
    modules: ['PURCHASE_ORDER', 'GRN', 'INVENTORY'],
  },
  {
    groupKey: 'style',
    label: 'Style & BOM',
    accent: 'var(--success-color)',
    modules: ['STYLE', 'BOM'],
  },
  {
    groupKey: 'production',
    label: 'Production & Shipment',
    accent: 'var(--warning-color)',
    modules: ['PRODUCTION', 'SHIPMENT'],
  },
  {
    groupKey: 'people',
    label: 'People & Finance',
    accent: 'var(--btn-approve-color, var(--success-color))',
    modules: ['HR', 'FINANCE'],
  },
  {
    groupKey: 'admin',
    label: 'Administration',
    accent: 'var(--error-color)',
    modules: ['ADMIN', 'APPROVAL', 'MASTER_DATA'],
  },
];

/** Modules the left nav knows how to group. */
export const GROUPED_MODULES = MODULE_GROUPS.flatMap((g) => g.modules);

/** Segmented control options for cross-page navigation */
export const REPORT_NAV_OPTIONS = [
  { label: 'All Reports', value: '/reports/list', module: 'reports' },
  { label: 'Saved', value: '/reports/saved', module: 'reports' },
  { label: 'AI Assistant', value: '/reports/ai-chat', module: 'ai-assistant' },
];

/** Filter nav options based on user's module access */
export const getFilteredReportNavOptions = (hasAccessFn) =>
  REPORT_NAV_OPTIONS.filter((opt) => !opt.module || hasAccessFn(opt.module));

export const getModuleColor = (module) => MODULE_COLORS[module] || 'default';

export const getModuleIcon = (module) => MODULE_ICONS[module] || FileTextOutlined;

export const getModuleLabel = (module) =>
  MODULE_LABELS[module] || (module || '').replace(/_/g, ' ');
