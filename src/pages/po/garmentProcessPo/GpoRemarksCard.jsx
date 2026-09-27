import { memo } from 'react';
import { Card, Empty, Input, Space, Typography } from 'antd';

const { Text } = Typography;

/**
 * ⑥ Instructions & Remarks (PRD FR-15): each requirement's remarks, read-only; the
 * processing instructions (defaulted from the process master, printed for the vendor) and
 * the PO's own remarks.
 */
const GpoRemarksCard = memo(function GpoRemarksCard({ doc, cards, editable, onPatch }) {
  const gprRemarks = [...new Map(cards.filter((c) => c.remarks).map((c) => [c.gprNo, c.remarks])).entries()];
  return (
    <Card id="gpo-remarks" size="small" title="⑥ Instructions & Remarks" style={{ height: '100%' }}>
      <Space orientation="vertical" size={10} style={{ width: '100%' }}>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>From requirement (read-only)</Text>
          {gprRemarks.length ? gprRemarks.map(([no, text]) => (
            <div key={no} style={{ fontSize: 13 }}><Text strong>{no}</Text> — {text}</div>
          )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No requirement remarks" style={{ margin: 4 }} />}
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>Processing instructions (printed)</Text>
          <Input.TextArea id="gpo-instructions" rows={3} maxLength={2000} disabled={!editable} value={doc.instructions}
            onChange={(e) => onPatch({ instructions: e.target.value })} />
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 12 }}>PO Remarks</Text>
          <Input.TextArea id="gpo-remarks-text" rows={3} maxLength={1000} showCount disabled={!editable} value={doc.remarks}
            onChange={(e) => onPatch({ remarks: e.target.value })} />
        </div>
      </Space>
    </Card>
  );
});

export default GpoRemarksCard;
