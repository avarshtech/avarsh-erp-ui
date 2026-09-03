import { Tag } from 'antd';

/**
 * Small purple "SAMPLE" badge shown beside order numbers across the ERP so a
 * sample order (orderType = SAMPLE) is recognisable on every lifecycle screen.
 */
const SampleOrderTag = ({ style }) => (
  <Tag
    color="purple"
    style={{ marginInlineStart: 4, fontSize: 10, lineHeight: '16px', padding: '0 4px', verticalAlign: 'middle', ...style }}
  >
    SAMPLE
  </Tag>
);

export default SampleOrderTag;
