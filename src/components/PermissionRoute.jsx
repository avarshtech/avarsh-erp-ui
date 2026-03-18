import { Result, Button } from 'antd';
import { hasModuleAccess, hasPermission, isAdminRole, getCurrentUser } from '../utils/permissions';

/**
 * Route-level permission guard.
 *
 * Admin/SuperAdmin roles bypass all permission checks.
 *
 * Props:
 *  - module: module ID to check access for (e.g., 'bom', 'orders')
 *  - operation: optional specific operation (e.g., 'add', 'update')
 *  - children: component to render if authorized
 */
const PermissionRoute = ({ module, operation, children }) => {
  // Admin roles have unrestricted access
  const user = getCurrentUser();
  if (isAdminRole(user?.role)) return children;

  // Check module-level access
  if (!hasModuleAccess(module)) {
    return (
      <Result
        status="403"
        title="Access Denied"
        subTitle="You do not have permission to access this page."
        extra={<Button type="primary" onClick={() => window.history.back()}>Go Back</Button>}
      />
    );
  }

  // Check specific operation if provided
  if (operation && !hasPermission(module, operation)) {
    return (
      <Result
        status="403"
        title="Access Denied"
        subTitle={`You do not have the required permission to perform this action.`}
        extra={<Button type="primary" onClick={() => window.history.back()}>Go Back</Button>}
      />
    );
  }

  return children;
};

export default PermissionRoute;
