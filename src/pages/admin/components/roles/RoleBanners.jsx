import { Alert } from 'antd';
import { isNamedAdmin } from './roleGuards';

/**
 * What the rights below cannot say for themselves: a superuser role skips every check, and a role
 * named Admin is offered everything by the web app — by its name — while the server checks its rights.
 */
const RoleBanners = ({ role }) => (
  <>
    {role.isSuperuser && (
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="Superuser role"
        description="Users of this role can open and do everything, in the app and on the server. Nothing below limits them."
      />
    )}
    {isNamedAdmin(role) && (
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        title={`The app offers "${role.name}" every screen`}
        description={`Because the role is named "${role.name}", the app shows its users every screen and button, whatever is granted. The server allows only the rights below once it enforces permissions, so anything missing here ends in a "not permitted" error.`}
      />
    )}
  </>
);

export default RoleBanners;
