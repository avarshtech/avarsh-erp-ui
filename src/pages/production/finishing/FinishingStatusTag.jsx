import { Tag } from 'antd';
import { FINISHING_STATUS_COLORS, finishingStatusLabel } from '../../../utils/finishingConstants';

const FinishingStatusTag = ({ status }) => (
  <Tag color={FINISHING_STATUS_COLORS[status] || 'default'}>{finishingStatusLabel(status)}</Tag>
);

export default FinishingStatusTag;
