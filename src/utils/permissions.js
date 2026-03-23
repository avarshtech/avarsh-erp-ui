/**
 * RBAC Permission System
 * Defines pages, operations, and permission utilities
 *
 * Permission JSON Structure (stored in DB & JWT token):
 * {
 *   "dashboard":        { "access": true, "operations": { "view": true } },
 *   "orders":           { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "order-actions":    { "access": true, "operations": { "refer_back": true, "cancel": true, "approve": true, "reject": true } },
 *   "bom":              { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "purchase-orders":  { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "po-approval":      { "access": true, "operations": { "approve": true, "reject": true, "cancel": true, "refer_back": true } },
 *   "grn":              { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "costing":          { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "costing-approval": { "access": true, "operations": { "approve": true } },
 *   "buyer-info":       { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "supplier-info":    { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "master-data":      { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "items":            { "access": true, "operations": { "view": true, "add": true, "update": true } },
 *   "style-master":     { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "size-presets":     { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "payment-terms":    { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "process-master":   { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "parts-master":     { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "overhead-master":  { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "users":            { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } },
 *   "roles":            { "access": true, "operations": { "view": true, "add": true, "update": true, "delete": true } }
 * }
 */

// ─── MODULE DEFINITIONS ─────────────────────────────────────────────────────────

export const MODULES = {
  DASHBOARD: {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/',
    group: 'main',
  },
  ORDERS: {
    id: 'orders',
    name: 'Orders',
    path: '/orders',
    group: 'transactions',
  },
  BOM: {
    id: 'bom',
    name: 'Bill of Materials',
    path: '/bom',
    group: 'transactions',
  },
  PURCHASE_ORDERS: {
    id: 'purchase-orders',
    name: 'Purchase Orders',
    path: '/purchase-orders',
    group: 'transactions',
  },
  ORDER_ACTIONS: {
    id: 'order-actions',
    name: 'Order Actions',
    path: '/orders', // Integrated within Orders module
    group: 'transactions',
    linkedTo: 'orders',
  },
  PO_APPROVAL: {
    id: 'po-approval',
    name: 'PO Approval',
    path: '/purchase-orders', // Integrated within PO module
    group: 'transactions',
    linkedTo: 'purchase-orders',
  },
  GRN: {
    id: 'grn',
    name: 'Goods Received',
    path: '/grn',
    group: 'transactions',
  },
  COSTING: {
    id: 'costing',
    name: 'Costing',
    path: '/costing',
    group: 'transactions',
  },
  COSTING_APPROVAL: {
    id: 'costing-approval',
    name: 'Costing Approval Actions',
    path: '/costing',
    group: 'transactions',
    linkedTo: 'costing',
  },
  BUYERS: {
    id: 'buyer-info',
    name: 'Buyers',
    path: '/master/buyers',
    group: 'master',
  },
  SUPPLIERS: {
    id: 'supplier-info',
    name: 'Suppliers',
    path: '/master/suppliers',
    group: 'master',
  },
  ITEMS: {
    id: 'items',
    name: 'Items',
    path: '/master/items',
    group: 'master',
  },
  MASTER_DATA: {
    id: 'master-data',
    name: 'Master Data',
    description: 'Categories, Sub-Categories, Item Types, UOM, Attributes',
    path: '/master',
    group: 'master',
  },
  STYLE_MASTER: {
    id: 'style-master',
    name: 'Style Master',
    path: '/master → Styles tab',
    group: 'master',
  },
  SIZE_PRESETS: {
    id: 'size-presets',
    name: 'Size Presets',
    path: '/master → Size Presets tab',
    group: 'master',
  },
  PAYMENT_TERMS_MASTER: {
    id: 'payment-terms',
    name: 'Payment Terms',
    path: '/master → Payment Terms tab',
    group: 'master',
  },
  TERMS_CONDITIONS: {
    id: 'terms-conditions',
    name: 'Terms & Conditions',
    path: '/master → Terms & Conditions tab',
    group: 'master',
  },
  PROCESS_MASTER: {
    id: 'process-master',
    name: 'Processes',
    path: '/master → Processes tab',
    group: 'master',
  },
  PARTS_MASTER: {
    id: 'parts-master',
    name: 'Parts Master',
    path: '/master → Parts tab',
    group: 'master',
  },
  OVERHEAD_MASTER: {
    id: 'overhead-master',
    name: 'Overheads',
    path: '/master → Overheads tab',
    group: 'master',
  },
  USERS: {
    id: 'users',
    name: 'Users',
    path: '/admin/users',
    group: 'admin',
  },
  ROLES: {
    id: 'roles',
    name: 'Role & Access',
    path: '/admin/roles',
    group: 'admin',
  },
};

// ─── OPERATION DEFINITIONS ─────────────────────────────────────────────────────

export const OPERATIONS = {
  VIEW: { id: 'view', name: 'View' },
  ADD: { id: 'add', name: 'Add' },
  UPDATE: { id: 'update', name: 'Update' },
  DELETE: { id: 'delete', name: 'Delete' },
  SUBMIT: { id: 'submit', name: 'Submit' },
  APPROVE: { id: 'approve', name: 'Approve' },
  REJECT: { id: 'reject', name: 'Reject' },
  CANCEL: { id: 'cancel', name: 'Cancel' },
  REFER_BACK: { id: 'refer_back', name: 'Refer Back' },
};

// Standard CRUD operations
export const STANDARD_OPERATIONS = ['view', 'add', 'update', 'delete'];

// Order Action operations
export const ORDER_ACTION_OPERATIONS = ['refer_back', 'cancel', 'approve', 'reject'];

// PO Approval operations
export const PO_APPROVAL_OPERATIONS = ['refer_back', 'cancel', 'approve', 'reject'];

// Costing Approval operations
export const COSTING_APPROVAL_OPERATIONS = ['approve'];

// Dashboard only has view
export const DASHBOARD_OPERATIONS = ['view'];

// ─── PERMISSION MATRIX GROUPED LAYOUT ──────────────────────────────────────────

export const PERMISSION_GROUPS = [
  {
    key: 'main',
    label: 'General',
    icon: 'DashboardOutlined',
    modules: [
      { id: 'dashboard', name: 'Dashboard', operations: DASHBOARD_OPERATIONS },
    ],
  },
  {
    key: 'transactions',
    label: 'Transactions',
    icon: 'ShoppingCartOutlined',
    modules: [
      { id: 'orders', name: 'Orders', operations: STANDARD_OPERATIONS, path: '/orders/list' },
      { id: 'order-actions', name: 'Order Approval Actions', operations: ORDER_ACTION_OPERATIONS, linkedTo: 'orders', path: '(within Orders)' },
      { id: 'bom', name: 'Bill of Materials', operations: STANDARD_OPERATIONS, path: '/bom/list' },
      { id: 'purchase-orders', name: 'Purchase Orders', operations: STANDARD_OPERATIONS, path: '/purchase-orders/list' },
      { id: 'po-approval', name: 'PO Approval Actions', operations: PO_APPROVAL_OPERATIONS, linkedTo: 'purchase-orders', path: '(within PO)' },
      { id: 'grn', name: 'Goods Received (GRN)', operations: STANDARD_OPERATIONS, path: '/grn/list' },
      { id: 'costing', name: 'Costing', operations: STANDARD_OPERATIONS, path: '/costing/list' },
      { id: 'costing-approval', name: 'Costing Approval Actions', operations: COSTING_APPROVAL_OPERATIONS, linkedTo: 'costing', path: '(within Costing)' },
    ],
  },
  {
    key: 'master',
    label: 'Master Data',
    icon: 'DatabaseOutlined',
    description: 'Individual access for Suppliers & Items; shared access for other master tabs',
    modules: [
      { id: 'buyer-info',      name: 'Buyers',                    description: 'Order Entry',          operations: STANDARD_OPERATIONS },
      { id: 'supplier-info',   name: 'Suppliers',                 description: 'Purchase Order',        operations: STANDARD_OPERATIONS },
      {
        id: 'master-data',
        name: 'Product Catalog',
        description: 'Item — Categories, Sub-Categories, Item Types, UOM, Attributes',
        operations: STANDARD_OPERATIONS,
      },
      { id: 'items',           name: 'Items',                     description: 'Purchase Order',        operations: ['view', 'add', 'update'] },
      { id: 'style-master',    name: 'Style Master',              description: 'Order Entry, Costing',  operations: STANDARD_OPERATIONS },
      { id: 'size-presets',    name: 'Size Presets',              description: 'Order Entry, Costing',  operations: STANDARD_OPERATIONS },
      { id: 'payment-terms',   name: 'Payment Terms',             description: 'Order Entry',           operations: STANDARD_OPERATIONS },
      { id: 'terms-conditions',name: 'Terms & Conditions',        description: 'Purchase Order',        operations: STANDARD_OPERATIONS },
      { id: 'process-master',  name: 'Processes',                  description: 'BOM, Manufacturing',    operations: STANDARD_OPERATIONS },
      { id: 'parts-master',    name: 'Parts Master',               description: 'BOM, Manufacturing',    operations: STANDARD_OPERATIONS },
      { id: 'overhead-master', name: 'Overheads',                  description: 'Costing, Shipment',     operations: STANDARD_OPERATIONS },
    ],
  },
  {
    key: 'admin',
    label: 'Administration',
    icon: 'SettingOutlined',
    modules: [
      { id: 'users', name: 'User Management', operations: STANDARD_OPERATIONS, path: '/admin/users' },
      { id: 'roles', name: 'Role & Access', operations: STANDARD_OPERATIONS, path: '/admin/roles' },
    ],
  },
];

// ─── HELPER FUNCTIONS ──────────────────────────────────────────────────────────

export const getAllModules = () => Object.values(MODULES);
export const getAllOperations = () => Object.values(OPERATIONS);
export const getSidebarModules = () =>
  getAllModules().filter((m) => !['settings'].includes(m.id));

/** Returns which operations apply to a given module ID */
export const getOperationsForModule = (moduleId) => {
  if (moduleId === 'order-actions')   return ORDER_ACTION_OPERATIONS;
  if (moduleId === 'po-approval')     return PO_APPROVAL_OPERATIONS;
  if (moduleId === 'costing-approval') return COSTING_APPROVAL_OPERATIONS;
  if (moduleId === 'dashboard')       return DASHBOARD_OPERATIONS;
  // Items do not support delete via UI — remove 'delete' from operations
  if (moduleId === 'items')           return ['view', 'add', 'update'];
  return STANDARD_OPERATIONS;
};

// ─── EMPTY / ADMIN PERMISSION GENERATORS ───────────────────────────────────────

const buildPermissions = (defaultValue) => {
  const permissions = {};
  Object.values(MODULES).forEach((module) => {
    const ops = getOperationsForModule(module.id);
    permissions[module.id] = {
      access: defaultValue,
      operations: ops.reduce((acc, op) => {
        acc[op] = defaultValue;
        return acc;
      }, {}),
    };
  });
  return permissions;
};

export const getAdminPermissions = () => buildPermissions(true);
export const getEmptyPermissions = () => buildPermissions(false);

// ─── ROLE HELPERS ──────────────────────────────────────────────────────────────

export const isAdminRole = (role) => {
  if (!role) return false;
  try {
    const normalized = String(role).toLowerCase().replace(/[\s_-]+/g, '');
    return normalized === 'admin' || normalized === 'superadmin';
  } catch {
    return false;
  }
};

// ─── SESSION HELPERS ───────────────────────────────────────────────────────────
// Delegated to sessionStore for centralized, secure session management.
// This avoids direct sessionStorage access and ensures the token field
// is never persisted in browser storage.

import { getCachedUserDisplay, cacheUserDisplay } from '../services/sessionStore';

export const getCurrentUser = () => getCachedUserDisplay();

export const setCurrentUser = (user) => cacheUserDisplay(user);

/**
 * Get current user permissions.
 * Normalizes the token's permission object against known modules
 * so any module added later has a safe fallback.
 */
export const getCurrentUserPermissions = () => {
  const user = getCurrentUser();

  if (isAdminRole(user?.role)) {
    return getAdminPermissions();
  }

  const raw = user?.permissions;
  if (!raw || typeof raw !== 'object') return getEmptyPermissions();

  // Merge raw permissions with empty template so every key exists
  const empty = getEmptyPermissions();
  const merged = { ...empty };
  Object.keys(raw).forEach((moduleId) => {
    if (merged[moduleId]) {
      merged[moduleId] = {
        access: !!raw[moduleId]?.access,
        operations: {
          ...merged[moduleId].operations,
          ...(raw[moduleId]?.operations || {}),
        },
      };
    } else {
      merged[moduleId] = raw[moduleId];
    }
  });
  return merged;
};

// ─── PERMISSION CHECK FUNCTIONS ────────────────────────────────────────────────

export const hasModuleAccess = (moduleId) => {
  const permissions = getCurrentUserPermissions();
  if (!permissions || !permissions[moduleId]) return false;
  return permissions[moduleId].access === true;
};

export const hasPermission = (moduleId, operationId) => {
  const permissions = getCurrentUserPermissions();
  if (!permissions || !permissions[moduleId]) return false;
  if (!permissions[moduleId].access) return false;
  return permissions[moduleId].operations?.[operationId] === true;
};

export const hasOperationPermission = hasPermission;

export const hasAllPermissions = (checks) => {
  return checks.every(({ module, operation }) => hasPermission(module, operation));
};

export const hasAnyPermission = (checks) => {
  return checks.some(({ module, operation }) => hasPermission(module, operation));
};

// ─── ORDER ACTION HELPERS (linked to Orders access) ────────────────────────────

// Submit = user has add OR update access on orders (no separate permission needed)
export const canSubmitOrder = () =>
  hasPermission('orders', 'add') || hasPermission('orders', 'update');

export const canReferBackOrder = () =>
  hasModuleAccess('orders') && hasPermission('order-actions', 'refer_back');

export const canCancelOrder = () =>
  hasModuleAccess('orders') && hasPermission('order-actions', 'cancel');

export const canApproveOrderAction = () =>
  hasModuleAccess('orders') && hasPermission('order-actions', 'approve');

export const canRejectOrderAction = () =>
  hasModuleAccess('orders') && hasPermission('order-actions', 'reject');

export const canPerformOrderActions = () =>
  hasModuleAccess('orders') &&
  (canReferBackOrder() || canCancelOrder());

// ─── PO APPROVAL HELPERS (linked to PO access) ────────────────────────────────

export const canApprovePO = () =>
  hasModuleAccess('purchase-orders') && hasPermission('po-approval', 'approve');

export const canRejectPO = () =>
  hasModuleAccess('purchase-orders') && hasPermission('po-approval', 'reject');

export const canCancelPO = () =>
  hasModuleAccess('purchase-orders') && hasPermission('po-approval', 'cancel');

export const canReferBackPO = () =>
  hasModuleAccess('purchase-orders') && hasPermission('po-approval', 'refer_back');

export const canPerformApprovalActions = () =>
  hasModuleAccess('purchase-orders') &&
  (canApprovePO() || canRejectPO() || canCancelPO() || canReferBackPO());

// ─── COSTING APPROVAL HELPERS (linked to Costing access) ────────────────────

export const canApproveCostSheet = () =>
  hasModuleAccess('costing') && hasPermission('costing-approval', 'approve');

// ─── FIRST ACCESSIBLE ROUTE ──────────────────────────────────────────────────

/**
 * Returns the first accessible route for the current user.
 * Used to redirect users who don't have dashboard permission.
 * Order matches the sidebar menu priority.
 */
export const getFirstAccessibleRoute = () => {
  const routeModuleMap = [
    { route: '/', moduleId: 'dashboard' },
    { route: '/orders/list', moduleId: 'orders' },
    { route: '/bom/list', moduleId: 'bom' },
    { route: '/purchase-orders/list', moduleId: 'purchase-orders' },
    { route: '/grn/list', moduleId: 'grn' },
    { route: '/costing/list', moduleId: 'costing' },
    { route: '/master', moduleId: ['master-data', 'buyer-info', 'supplier-info', 'items', 'terms-conditions', 'overhead-master'] },
    { route: '/admin/dashboard', moduleId: ['users', 'roles'] },
  ];

  for (const entry of routeModuleMap) {
    if (Array.isArray(entry.moduleId)) {
      if (entry.moduleId.some((id) => hasModuleAccess(id))) return entry.route;
    } else {
      if (hasModuleAccess(entry.moduleId)) return entry.route;
    }
  }

  return '/'; // fallback
};

// ─── PERMISSION VALIDATION ────────────────────────────────────────────────────

/**
 * Validate that at least one page permission is enabled for a role.
 * @returns {{ valid: boolean, message?: string }}
 */
export const validatePermissions = (permissions) => {
  if (!permissions || typeof permissions !== 'object') {
    return { valid: false, message: 'Permissions are required.' };
  }

  const hasAny = Object.values(permissions).some((mod) => mod.access === true);

  if (!hasAny) {
    return {
      valid: false,
      message: 'At least one page permission must be enabled for a role.',
    };
  }

  return { valid: true };
};

/**
 * Normalize permissions before saving to API.
 * Ensures only known modules with their applicable operations are saved.
 * Enforces PO-approval → PO link: if PO has no access, approval is disabled.
 */
export const normalizePermissionsForSave = (permissions) => {
  const normalized = {};

  Object.values(MODULES).forEach((module) => {
    const modulePerms = permissions[module.id];
    const ops = getOperationsForModule(module.id);

    const operations = {};
    ops.forEach((op) => {
      operations[op] = !!(modulePerms?.operations?.[op]);
    });

    const access = Object.values(operations).some(Boolean);
    normalized[module.id] = { access, operations };
  });

  // Enforce order-actions → orders link
  if (!normalized['orders']?.access) {
    normalized['order-actions'] = {
      access: false,
      operations: ORDER_ACTION_OPERATIONS.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
    };
  }

  // Enforce PO-approval → PO link
  if (!normalized['purchase-orders']?.access) {
    normalized['po-approval'] = {
      access: false,
      operations: PO_APPROVAL_OPERATIONS.reduce((acc, op) => {
        acc[op] = false;
        return acc;
      }, {}),
    };
  }

  // Enforce costing-approval → costing link (mirrors order-actions and po-approval pattern)
  if (!normalized['costing']?.access) {
    normalized['costing-approval'] = {
      access: false,
      operations: COSTING_APPROVAL_OPERATIONS.reduce((acc, op) => { acc[op] = false; return acc; }, {}),
    };
  }

  return normalized;
};
