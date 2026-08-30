import { Result } from 'antd';
import { ToolOutlined } from '@ant-design/icons';

const ComingSoon = ({ title = 'Coming Soon' }) => (
  <Result
    icon={<ToolOutlined />}
    title={title}
    subTitle="This screen is under development and will be available soon."
  />
);

export default ComingSoon;
