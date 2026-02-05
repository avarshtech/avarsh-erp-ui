/**
 * RBAC Permission System
 * Defines pages, operations, and permission utilities
 */

// Define all modules/pages in the application
export const MODULES = {
  DASHBOARD: {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/',
  },
  ORDERS: {
    id: 'orders',
    name: 'Orders',
    path: '/orders',
  },
  BOM: {
    id: 'bom',
    name: 'Bill of Materials',
    path: '/bom',
  },
  PURCHASE_ORDERS: {
    id: 'purchase-orders',
    name: 'Purchase Orders',
    path: '/purchase-orders',
  },
  PO_APPROVAL: {
    id: 'po-approval',
    name: 'PO Approval',
    path: '/purchase-orders', // Actions within PO module
  },
  GRN: {
    id: 'grn',
    name: 'Goods Received',
    path: '/grn',
  },
  SUPPLIERS: {
    id: 'supplier-info',
    name: 'Suppliers',
    path: '/master/suppliers',
  },
  ITEMS: {
    id: 'items',
    name: 'Items',
    path: '/master/items',
  },
  MASTER_DATA: {
    id: 'master-data',
    name: 'Master Data',
    path: '/master',
  },
  USERS: {
    id: 'users',
    name: 'Users',
    path: '/admin/users',
  },
  ROLES: {
    id: 'roles',
    name: 'Role & Access',
    path: '/admin/roles',
  },
  SETTINGS: {
    id: 'settings',
    name: 'Settings',
    path: '/admin/settings',
  },
};

// Define operations
export const OPERATIONS = {
  VIEW: { id: 'view', name: 'View' },
  ADD: { id: 'add', name: 'Add' },
  UPDATE: { id: 'update', name: 'Update' },
  DELETE: { id: 'delete', name: 'Delete' },
  APPROVE: { id: 'approve', name: 'Approve' },
  REJECT: { id: 'reject', name: 'Reject' },
  CANCEL: { id: 'cancel', name: 'Cancel' },
  REFER_BACK: { id: 'refer_back', name: 'Refer Back' },
};

// Get all modules as array
export const getAllModules = () => Object.values(MODULES);

// Get all operations as array
export const getAllOperations = () => Object.values(OPERATIONS);

// Get modules that should appear in sidebar
export const getSidebarModules = () => 
  getAllModules().filter(m => !['settings'].includes(m.id));

// Default Admin permissions (full access)
export const getAdminPermissions = () => {
  const permissions = {};
  Object.values(MODULES).forEach((module) => {
    permissions[module.id] = {
      access: true,
      operations: {
        view: true,
        add: true,
        update: true,
        delete: true,
        approve: true,
        reject: true,
        cancel: true,
        refer_back: true,
      },
    };
  });
  return permissions;
};

// Create empty permissions structure
export const getEmptyPermissions = () => {
  const permissions = {};
  Object.values(MODULES).forEach((module) => {
    permissions[module.id] = {
      access: false,
      operations: {
        view: false,
        add: false,
        update: false,
        delete: false,
        approve: false,
        reject: false,
        cancel: false,
        refer_back: false,
      },
    };
  });
  return permissions;
};

// Helper to determine if a role is Admin
export const isAdminRole = (role) => {
  if (!role) return false;
  try {
    const normalized = String(role).toLowerCase().replace(/\s+/g, '');
    return normalized === 'admin' || normalized === 'superadmin' || normalized.includes('admin');
  } catch {
    return false;
  }
};

// Get current user from session storage
export const getCurrentUser = () => {
  const user = sessionStorage.getItem('currentUser');
  if (!user) return null;
  try {
    return JSON.parse(user);
  } catch {
    return null;
  }
};

// Set current user in session storage
export const setCurrentUser = (user) => {
  sessionStorage.setItem('currentUser', JSON.stringify(user));
};

// Get current user permissions
export const getCurrentUserPermissions = () => {
  const user = getCurrentUser();
  
  // Admin-like roles have all permissions
  if (isAdminRole(user?.role)) {
    return getAdminPermissions();
  }
  
  // For other roles, get from user permissions
  return user?.permissions || getEmptyPermissions();
};

// Check if user has access to a module
export const hasModuleAccess = (moduleId) => {
  const permissions = getCurrentUserPermissions();
  if (!permissions || !permissions[moduleId]) return false;
  return permissions[moduleId].access === true;
};

// Check if user has operation permission on a module
export const hasPermission = (moduleId, operationId) => {
  const permissions = getCurrentUserPermissions();
  if (!permissions || !permissions[moduleId]) return false;
  if (!permissions[moduleId].access) return false;
  return permissions[moduleId].operations?.[operationId] === true;
};

// Alias for backward compatibility
export const hasOperationPermission = hasPermission;

// Check multiple permissions (returns true if user has ALL)
export const hasAllPermissions = (checks) => {
  return checks.every(({ module, operation }) => hasPermission(module, operation));
};

// Check multiple permissions (returns true if user has ANY)
export const hasAnyPermission = (checks) => {
  return checks.some(({ module, operation }) => hasPermission(module, operation));
};

/**
 * PO Approval specific permission checks
 */
export const canApprovePO = () => hasPermission('po-approval', 'approve');
export const canRejectPO = () => hasPermission('po-approval', 'reject');
export const canCancelPO = () => hasPermission('po-approval', 'cancel');
export const canReferBackPO = () => hasPermission('po-approval', 'refer_back');

// Check if user can perform any approval action
export const canPerformApprovalActions = () => {
  return canApprovePO() || canRejectPO() || canCancelPO() || canReferBackPO();
};
