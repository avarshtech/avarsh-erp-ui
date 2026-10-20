import { Col, Row, Typography } from 'antd';
import { SECTION_CONFIG } from '../model/sectionConfig';
import GridCell from './GridCell';

/** The less-used fields of a row (description, widths, classification, codes), under the row when expanded. */
export default function RowDetails({ sectionKey, record }) {
  return (
    <Row gutter={[12, 8]} style={{ padding: '4px 8px' }}>
      {SECTION_CONFIG[sectionKey].details.map((spec) => (
        <Col key={spec.field || spec.type} xs={24} sm={12} md={spec.field === 'description' ? 12 : 6}>
          <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 2 }}>{spec.title}</Typography.Text>
          <GridCell sectionKey={sectionKey} spec={spec} record={record} />
        </Col>
      ))}
    </Row>
  );
}
