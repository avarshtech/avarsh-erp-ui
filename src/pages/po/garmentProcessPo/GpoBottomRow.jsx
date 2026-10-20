import { memo } from 'react';
import { Col, Row, Typography } from 'antd';
import { CalculatorOutlined } from '@ant-design/icons';
import DetailCard from '../../../components/DetailCard';
import GpoDeliveryCard from './GpoDeliveryCard';
import JobWorkValueSummary from '../jobWork/JobWorkValueSummary';

const { Text } = Typography;
const LABELS = { basic: 'Subtotal', total: 'Grand Total' };

/**
 * The bottom row of the Garment Process PO (PRD §19): delivery instructions and the
 * commercial summary — side by side on desktop, stacked on a tablet. The requirements'
 * remarks sit on their requirement detail cards. `editable` = { delivery, commercial }.
 */
const GpoBottomRow = memo(function GpoBottomRow({ doc, value, units, editable, onPatch }) {
  const qty = doc.lines.reduce((s, l) => s + (Number(l.poQty) || 0), 0);
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
      <Col xs={24} lg={14}><GpoDeliveryCard doc={doc} editable={editable.delivery} units={units} onPatch={onPatch} /></Col>
      <Col xs={24} lg={10}>
        <DetailCard id="gpo-commercial" bare icon={<CalculatorOutlined />} title="Commercial Summary" extra={<Text type="secondary" style={{ fontSize: 12 }}>GST from the vendor&apos;s state</Text>} style={{ height: '100%' }}>
          <JobWorkValueSummary value={value} qty={qty} sacCode={doc.process?.sacCode} commercial={doc} editable={editable.commercial}
            onChange={onPatch} labels={LABELS} rounding={false} />
        </DetailCard>
      </Col>
    </Row>
  );
});

export default GpoBottomRow;
