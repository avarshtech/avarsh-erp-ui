import { Tag } from 'antd';
import { CUTTING_STATUS_COLORS, statusLabel } from '../../../utils/cuttingConstants';

const CuttingStatusTag = ({ status }) => (
  <Tag color={CUTTING_STATUS_COLORS[status] || 'default'} style={{ marginInlineEnd: 0 }}>
    {statusLabel(status)}
  </Tag>
);

export default CuttingStatusTag;
