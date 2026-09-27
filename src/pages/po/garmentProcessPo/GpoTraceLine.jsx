import { memo } from 'react';
import { Link } from 'react-router-dom';
import { Space, Typography } from 'antd';

const { Text } = Typography;

/**
 * The traceability line under the title (PRD FR-18, AC-14): Order → GPR → GPO, each
 * requirement a link to its screen, where the allocation drawer leads back to the POs.
 */
const GpoTraceLine = memo(function GpoTraceLine({ doc }) {
  const orders = [...new Set(doc.lines.map((l) => l.orderNo))];
  const gprs = [...new Map(doc.lines.map((l) => [l.gprId, l.gprNo])).entries()];
  if (!gprs.length) return <Text type="secondary">Garment processing by a job worker against submitted Garment Process Requirements</Text>;
  return (
    <Space size={6} wrap>
      <Text>{orders.join(', ')}</Text>
      <Text type="secondary">→</Text>
      {gprs.map(([id, no], i) => <span key={id}><Link to={`/bom/garment-process/${id}`}>{no}</Link>{i < gprs.length - 1 ? ',' : ''}</span>)}
      <Text type="secondary">→</Text>
      <Text strong>{doc.poNo || 'GPO (numbered on save)'}</Text>
    </Space>
  );
});

export default GpoTraceLine;
