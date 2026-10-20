import { Tag } from 'antd';
import { SEWING_STATUS_COLORS, sewingStatusLabel } from '../../../utils/sewingConstants';

const SewingStatusTag = ({ status }) => (
  <Tag color={SEWING_STATUS_COLORS[status] || 'default'} style={{ marginInlineEnd: 0 }}>
    {sewingStatusLabel(status)}
  </Tag>
);

export default SewingStatusTag;
