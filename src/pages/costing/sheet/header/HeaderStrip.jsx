import { Card, Col, Form, Input, Row, Segmented, Select, Tag, Typography } from 'antd';
import { COSTING_TYPES, PRICING_UNITS } from '../../../../utils/costingConstants';
import { useSheet } from '../CostingSheetContext';
import BuyerStyleFields from './BuyerStyleFields';
import CurrencyRateFields from './CurrencyRateFields';
import SizesField from './SizesField';

/** Section A: who and what is being costed, in which currency. Everything else is below. */
export default function HeaderStrip() {
  const { meta } = useSheet();
  return (
    <Card
      size="small"
      data-genie-anchor="header"
      title={<Typography.Text strong style={{ fontSize: 15, color: 'var(--primary-color)' }}>Section A — General Details</Typography.Text>}
      extra={meta.costingId && <Tag color="blue">{meta.costingId}</Tag>}
    >
      <Row gutter={16}>
        <BuyerStyleFields />
        <Col xs={24} md={12}><SizesField /></Col>
        <Col xs={12} md={6}>
          <Form.Item label="Costing Type" name="costingType"><Select options={COSTING_TYPES} /></Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="Pricing Unit" name="pricingUnit"><Segmented options={PRICING_UNITS} block /></Form.Item>
        </Col>
        <CurrencyRateFields />
        <Col xs={12} md={6}>
          <Form.Item label="Scenario Name" name="scenarioName">
            <Input maxLength={100} placeholder="e.g. Option A — Cotton Body" />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
}
