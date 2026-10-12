// Golden tests: the client-side permission checks as they behave today (2026-10-12).
// The signed-in user is read from localStorage 'currentUser' (sessionStore.getCachedUserDisplay),
// so that one global is stubbed with an in-memory store; nothing else is.
//   npx vitest run src/utils/permissions.test.js
import { afterEach, beforeEach, describe, test, expect, vi } from 'vitest';
import {
  STANDARD_OPERATIONS, applyDependencies, assertRegistryIntegrity, canApprovePO, canSubmitOrder,
  getCurrentUserPermissions, getFirstAccessibleRoute, getOperationsForModule, hasAllPermissions,
  hasAnyPermission, hasModuleAccess, hasPermission, isAdminRole, isSuperuser, normalizePermissionsForSave,
  validatePermissions,
} from './permissions';

const memoryStorage = () => {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: (key) => { items.delete(key); },
  };
};

let storage;
const signIn = (user) => storage.setItem('currentUser', JSON.stringify(user));

beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('hasPermission', () => {
  test('signed out, nothing is allowed', () => {
    expect(hasPermission('orders', 'view')).toBe(false);
    expect(hasModuleAccess('orders')).toBe(false);
  });

  test('an operation needs the screen\'s access and the operation itself', () => {
    signIn({ role: 'Merchandiser', permissions: { orders: { access: true, operations: { view: true, add: false } } } });
    expect(hasModuleAccess('orders')).toBe(true);
    expect(hasPermission('orders', 'view')).toBe(true);
    expect(hasPermission('orders', 'add')).toBe(false);
    // Not in the token: the empty template answers
    expect(hasPermission('orders', 'delete')).toBe(false);
    expect(hasPermission('bom', 'view')).toBe(false);
  });

  test('no access switches every operation off, whatever the operation says', () => {
    signIn({ role: 'Merchandiser', permissions: { orders: { access: false, operations: { view: true } } } });
    expect(hasPermission('orders', 'view')).toBe(false);
  });

  test('access is coerced to a boolean; an operation must be exactly true', () => {
    signIn({ role: 'Merchandiser', permissions: { orders: { access: 1, operations: { view: true, add: 'true' } } } });
    expect(hasModuleAccess('orders')).toBe(true);
    expect(hasPermission('orders', 'view')).toBe(true);
    expect(hasPermission('orders', 'add')).toBe(false);
  });

  test('a key the registry does not know is kept as the token has it', () => {
    signIn({ role: 'Merchandiser', permissions: { 'legacy-screen': { access: true, operations: { view: true } } } });
    expect(hasPermission('legacy-screen', 'view')).toBe(true);
  });

  test('an unreadable session reads as signed out', () => {
    storage.setItem('currentUser', '{not json');
    expect(hasPermission('orders', 'view')).toBe(false);
  });

  test('all / any over several checks', () => {
    signIn({ role: 'Merchandiser', permissions: { orders: { access: true, operations: { view: true } }, bom: { access: true, operations: { view: false } } } });
    const checks = [{ module: 'orders', operation: 'view' }, { module: 'bom', operation: 'view' }];
    expect(hasAllPermissions(checks)).toBe(false);
    expect(hasAnyPermission(checks)).toBe(true);
    expect(hasAllPermissions([])).toBe(true);
    expect(hasAnyPermission([])).toBe(false);
  });
});

describe('the Admin role name', () => {
  test('Admin and Super Admin are matched by name, in any case or spacing', () => {
    ['Admin', 'admin ', 'Super Admin', 'super_admin', 'SUPER-ADMIN', 'SuperAdmin'].forEach((role) => {
      expect(isAdminRole(role), role).toBe(true);
    });
    ['Administrator', 'Admin Assistant', '', null, undefined].forEach((role) => {
      expect(isAdminRole(role), String(role)).toBe(false);
    });
  });

  test('an Admin holds every registered operation, whatever its token says, and nothing unregistered', () => {
    signIn({ role: 'Admin', permissions: {} });
    expect(hasPermission('orders', 'delete')).toBe(true);
    expect(hasPermission('po-approval', 'approve')).toBe(true);
    expect(hasPermission('orders', 'approve')).toBe(false);
  });

  test('isSuperuser reads the server flag, not the role name', () => {
    signIn({ role: 'Admin' });
    expect(isSuperuser()).toBe(false);
    signIn({ role: 'Plant Head', isSuperuser: true });
    expect(isSuperuser()).toBe(true);
  });
});

describe('the action helpers', () => {
  test('submitting an order needs add or update', () => {
    signIn({ role: 'Merchandiser', permissions: { orders: { access: true, operations: { update: true } } } });
    expect(canSubmitOrder()).toBe(true);
    signIn({ role: 'Merchandiser', permissions: { orders: { access: true, operations: { view: true } } } });
    expect(canSubmitOrder()).toBe(false);
  });

  test('approving a PO needs the PO screen and the approval bundle', () => {
    const approver = { 'po-approval': { access: true, operations: { approve: true } } };
    signIn({ role: 'Approver', permissions: approver });
    expect(canApprovePO()).toBe(false);
    signIn({ role: 'Approver', permissions: { ...approver, 'purchase-orders': { access: true, operations: { view: true } } } });
    expect(canApprovePO()).toBe(true);
  });
});

describe('the registry and what is saved', () => {
  test('the registry passes its own integrity check', () => {
    expect(assertRegistryIntegrity()).toEqual([]);
  });

  test('a key the registry does not know falls back to the standard operations', () => {
    expect(getOperationsForModule('no-such-screen')).toBe(STANDARD_OPERATIONS);
    expect(getOperationsForModule('dashboard')).toEqual(['view']);
  });

  test('a saved screen is accessible when any operation is ticked, and only known operations are kept', () => {
    const saved = normalizePermissionsForSave({ orders: { access: false, operations: { view: true, fly: true } } });
    expect(saved.orders).toEqual({ access: true, operations: { view: true, add: false, update: false, delete: false } });
    expect(saved).not.toHaveProperty('no-such-screen');
  });

  test('an approval bundle is cleared when the screen it requires has no access', () => {
    const out = applyDependencies({
      orders: { access: false, operations: {} },
      'order-actions': { access: true, operations: { approve: true, reject: true, cancel: true, refer_back: true } },
    });
    expect(out['order-actions']).toEqual({ access: false, operations: { refer_back: false, cancel: false, approve: false, reject: false } });
  });

  test('a role needs at least one screen', () => {
    expect(validatePermissions(null)).toEqual({ valid: false, message: 'Permissions are required.' });
    expect(validatePermissions({ orders: { access: false } }).valid).toBe(false);
    expect(validatePermissions({ orders: { access: true } })).toEqual({ valid: true });
  });

  test('the first screen a user can open, in menu order; nothing at all lands on the profile', () => {
    signIn({ role: 'Storekeeper', permissions: { bom: { access: true, operations: { view: true } }, inventory: { access: true, operations: { view: true } } } });
    expect(getFirstAccessibleRoute()).toBe('/bom/list');
    signIn({ role: 'Nobody', permissions: {} });
    expect(getFirstAccessibleRoute()).toBe('/profile');
    expect(getCurrentUserPermissions().orders).toEqual({ access: false, operations: { view: false, add: false, update: false, delete: false } });
  });
});
