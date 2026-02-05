import { hasPermission, hasModuleAccess } from '../utils/permissions';

/**
 * Permission Guard Component
 * Conditionally renders children based on user permissions
 * 
 * Usage:
 * <PermissionGuard module="purchase-orders" operation="add">
 *   <Button>Create PO</Button>
 * </PermissionGuard>
 */
const PermissionGuard = ({ 
  module, 
  operation, 
  fallback = null, 
  children 
}) => {
  // If only module is provided, check module access
  // If operation is also provided, check operation permission
  const hasAccess = operation 
    ? hasPermission(module, operation) 
    : hasModuleAccess(module);

  if (!hasAccess) {
    return fallback;
  }

  return children;
};

/**
 * Higher-order component for permission-based rendering
 * 
 * Usage:
 * const ProtectedButton = withPermission(Button, 'purchase-orders', 'add');
 */
export const withPermission = (Component, module, operation) => {
  return function ProtectedComponent(props) {
    const hasAccess = operation 
      ? hasPermission(module, operation) 
      : hasModuleAccess(module);

    if (!hasAccess) {
      return null;
    }

    return <Component {...props} />;
  };
};

/**
 * Hook for checking permissions in functional components
 * 
 * Usage:
 * const canEdit = usePermission('purchase-orders', 'update');
 */
export const usePermission = (module, operation) => {
  return operation 
    ? hasPermission(module, operation) 
    : hasModuleAccess(module);
};

export default PermissionGuard;
