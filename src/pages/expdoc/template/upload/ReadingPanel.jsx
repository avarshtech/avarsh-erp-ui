import { Button, Space, Spin, Typography } from 'antd';
import { readingHint } from './uploadRules';

const { Text } = Typography;

/** While the reader works, in place of the upload form: what is happening, how long it takes, and a way out. */
const ReadingPanel = ({ contains, onCancel }) => (
  <Space orientation="vertical" align="center" style={{ width: '100%', padding: '32px 0' }}>
    <Spin size="large" />
    <Text strong>Reading the document…</Text>
    <Text type="secondary">{readingHint(contains)}</Text>
    <Button onClick={onCancel}>Cancel</Button>
  </Space>
);

export default ReadingPanel;
