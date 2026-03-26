import {
  ShoppingCartOutlined,
  ShoppingOutlined,
  DollarOutlined,
  InboxOutlined,
  AppstoreOutlined,
  ToolOutlined,
  SkinOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';

/** Module → Ant Design tag color */
export const MODULE_COLORS = {
  ORDER: 'blue',
  PURCHASE_ORDER: 'purple',
  COSTING: 'green',
  ADMIN: 'red',
  INVENTORY: 'orange',
  PRODUCTION: 'cyan',
  STYLE: 'magenta',
  BOM: 'geekblue',
  GRN: 'volcano',
};

/** Module → icon component */
export const MODULE_ICONS = {
  ORDER: ShoppingCartOutlined,
  PURCHASE_ORDER: ShoppingOutlined,
  COSTING: DollarOutlined,
  ADMIN: SettingOutlined,
  INVENTORY: InboxOutlined,
  PRODUCTION: ToolOutlined,
  STYLE: SkinOutlined,
  BOM: FileTextOutlined,
  GRN: AppstoreOutlined,
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
    groupKey: 'production',
    label: 'Production & Style',
    accent: 'var(--success-color)',
    modules: ['PRODUCTION', 'STYLE', 'BOM'],
  },
  {
    groupKey: 'admin',
    label: 'Administration',
    accent: 'var(--error-color)',
    modules: ['ADMIN'],
  },
];

/** Segmented control options for cross-page navigation */
export const REPORT_NAV_OPTIONS = [
  { label: 'All Reports', value: '/reports/list' },
  { label: 'Saved', value: '/reports/saved' },
  { label: 'AI Assistant', value: '/reports/ai-chat' },
];

export const getModuleColor = (module) => MODULE_COLORS[module] || 'default';

export const getModuleIcon = (module) => MODULE_ICONS[module] || FileTextOutlined;
