import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';

/** A requirement that could not be loaded (deleted, a wrong link or no access); the toast says why. */
const RequirementNotFound = ({ listPath }) => {
  const navigate = useNavigate();
  return (
    <Result
      status="warning"
      title="This requirement could not be loaded"
      subTitle="It may have been deleted, or the link is wrong."
      extra={<Button type="primary" onClick={() => navigate(listPath)}>Back to list</Button>}
    />
  );
};

export default RequirementNotFound;
