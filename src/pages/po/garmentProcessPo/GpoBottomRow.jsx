import { memo } from 'react';
import { Card, Col, Row, Typography } from 'antd';
import GpoDeliveryCard from './GpoDeliveryCard';
import GpoRemarksCard from './GpoRemarksCard';
import JobWorkValueSummary from '../jobWork/JobWorkValueSummary';

const { Text } = Typography;
const LABELS = { basic: 'Subtotal', total: 'Grand Total' };

/**
 * The bottom row of the Garment Process PO (PRD §19): ⑤ delivery and movement, ⑥
 * instructions and remarks, ⑦ the commercial summary — side by side on desktop, stacked on
 * a tablet. `editable` = { delivery, commercial }.
 */
const GpoBottomRow = memo(function GpoBottomRow({ doc, cards, value, editable, onPatch }) {
  const qty = doc.lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0);
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} lg={8}><GpoDeliveryCard doc={doc} editable={editable.delivery} onPatch={onPatch} /></Col>
      <Col xs={24} lg={8}><GpoRemarksCard doc={doc} cards={cards} editable={editable.delivery} onPatch={onPatch} /></Col>
      <Col xs={24} lg={8}>
        <Card id="gpo-commercial" size="small" title="⑦ Commercial Summary" extra={<Text type="secondary" style={{ fontSize: 12 }}>GST from the vendor&apos;s state</Text>} style={{ height: '100%' }}>
          <JobWorkValueSummary value={value} qty={qty} sacCode={doc.process?.sacCode} commercial={doc} editable={editable.commercial}
            onChange={onPatch} labels={LABELS} rounding={false} />
        </Card>
      </Col>
    </Row>
  );
});

export default GpoBottomRow;
