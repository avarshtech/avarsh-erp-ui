import {
  ShoppingCartOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  BgColorsOutlined,
  GoldOutlined,
  FileTextOutlined,
  ProfileOutlined,
  DatabaseOutlined,
  AuditOutlined,
  LoginOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

export const MODULE_CONFIG = {
  PO: {
    label: 'Supplier PO',
    color: '#4f46e5',
    bg: 'rgba(79, 70, 229, 0.08)',
    icon: ShoppingCartOutlined,
    route: (id) => `/purchase-orders/supplier-po/list?viewId=${id}`,
  },
  GRN: {
    label: 'GRN',
    color: '#0d9488',
    bg: 'rgba(13, 148, 136, 0.08)',
    icon: InboxOutlined,
    route: (id) => `/inventory/grn?viewId=${id}`,
  },
  QC: {
    label: 'Quality Check',
    color: '#d97706',
    bg: 'rgba(217, 119, 6, 0.08)',
    icon: CheckCircleOutlined,
    route: (id) => `/inventory/qc?viewId=${id}`,
  },
  FABRIC: {
    label: 'Fabric',
    color: '#db2777',
    bg: 'rgba(219, 39, 119, 0.08)',
    icon: BgColorsOutlined,
    route: () => `/inventory/issue/fabric`,
  },
  ACCESSORIES: {
    label: 'Accessories',
    color: '#9333ea',
    bg: 'rgba(147, 51, 234, 0.08)',
    icon: GoldOutlined,
    route: () => `/inventory/issue/accessories`,
  },
  ORDER: {
    label: 'Order',
    color: '#2563eb',
    bg: 'rgba(37, 99, 235, 0.08)',
    icon: FileTextOutlined,
    route: (id) => `/orders/list?viewId=${id}`,
  },
  BOM: {
    label: 'BOM',
    color: '#0891b2',
    bg: 'rgba(8, 145, 178, 0.08)',
    icon: ProfileOutlined,
    route: (id) => `/bom/list?viewId=${id}`,
  },
  COSTING: {
    label: 'Costing',
    color: '#ca8a04',
    bg: 'rgba(202, 138, 4, 0.08)',
    icon: ProfileOutlined,
    route: (id) => `/costing/list?viewId=${id}`,
  },
  STOCK: {
    label: 'Stock',
    color: '#475569',
    bg: 'rgba(71, 85, 105, 0.08)',
    icon: DatabaseOutlined,
    route: () => `/inventory/stock`,
  },
  APPROVAL: {
    label: 'Approval',
    color: '#7c3aed',
    bg: 'rgba(124, 58, 237, 0.08)',
    icon: AuditOutlined,
    route: () => `/approvals`,
  },
  AUTH: {
    label: 'Auth',
    color: '#64748b',
    bg: 'rgba(100, 116, 139, 0.08)',
    icon: LoginOutlined,
    route: null,
  },
  GENERIC: {
    label: 'Activity',
    color: '#6b7280',
    bg: 'rgba(107, 114, 128, 0.08)',
    icon: AppstoreOutlined,
    route: null,
  },
};

export const SEVERITY_ACCENT = {
  INFO: 'transparent',
  SUCCESS: '#16a34a',
  WARNING: '#d97706',
  CRITICAL: '#dc2626',
};

export const getModuleConfig = (module) => MODULE_CONFIG[module] || MODULE_CONFIG.GENERIC;

export const buildEntityRoute = (module, entityId) => {
  const cfg = getModuleConfig(module);
  if (!cfg.route || entityId == null) return null;
  try {
    return cfg.route(entityId);
  } catch {
    return null;
  }
};

export const ALL_MODULE_KEYS = Object.keys(MODULE_CONFIG);
