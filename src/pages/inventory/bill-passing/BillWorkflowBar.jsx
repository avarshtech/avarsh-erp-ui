import { Space } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { ActionButton } from '../../../components/buttons';

const ICONS = { query: <QuestionCircleOutlined /> };

/**
 * Renders a bill's workflow buttons (see buildBillActions). Only the clicked action spins; the others are
 * disabled until it settles. Print never waits on anything, so it is never disabled.
 */
const BillWorkflowBar = ({ actions, busyProps }) => {
  if (!actions?.length) return null;
  return (
    <Space wrap>
      {actions.map(({ key, iconKey, disabled, noBusy, onClick, ...rest }) => (
        <ActionButton
          key={key}
          {...rest}
          {...(iconKey ? { icon: ICONS[iconKey] } : {})}
          {...(noBusy ? {} : busyProps(key, disabled))}
          onClick={onClick}
        />
      ))}
    </Space>
  );
};

export default BillWorkflowBar;
