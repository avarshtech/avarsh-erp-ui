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
  ContainerOutlined,
  DollarOutlined,
  TagsOutlined,
  BuildOutlined,
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
  // Export Documentation (PRD §11.1). Registered so the feed renders these events
  // with their own label, colour and deep link the moment the backend emits them —
  // without a key they would all arrive as an unroutable "Activity".
  PACKING_ENTRY: {
    label: 'Carton Packing',
    color: '#0e7490',
    bg: 'rgba(14, 116, 144, 0.08)',
    icon: BuildOutlined,
    route: (id) => `/export-docs/packing/edit/${id}`,
  },
  SHIPMENT: {
    label: 'Shipment',
    color: '#0369a1',
    bg: 'rgba(3, 105, 161, 0.08)',
    icon: ContainerOutlined,
    route: (id) => `/export-docs/shipments/edit/${id}`,
  },
  PACKING_LIST: {
    label: 'Packing List',
    color: '#15803d',
    bg: 'rgba(21, 128, 61, 0.08)',
    icon: ProfileOutlined,
    route: (id) => `/export-docs/packing-lists/edit/${id}`,
  },
  EXPORT_INVOICE: {
    label: 'Export Invoice',
    color: '#b45309',
    bg: 'rgba(180, 83, 9, 0.08)',
    icon: DollarOutlined,
    route: (id) => `/export-docs/invoices/edit/${id}`,
  },
  STICKER_RUN: {
    label: 'Carton Stickers',
    color: '#7e22ce',
    bg: 'rgba(126, 34, 206, 0.08)',
    icon: TagsOutlined,
    // The sticker workspace is addressed by PACKING LIST, not by run — a run id
    // cannot open it, so the console is where this deep link can honestly land.
    route: () => '/export-docs/stickers',
  },
  DOC_TEMPLATE: {
    label: 'Buyer Template',
    color: '#be123c',
    bg: 'rgba(190, 18, 60, 0.08)',
    icon: FileTextOutlined,
    route: (id) => `/export-docs/templates/edit/${id}`,
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
