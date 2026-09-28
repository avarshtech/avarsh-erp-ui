import { memo } from 'react';
import { Alert, Button, Card, Col, Form, Row, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import RequirementOrderSelect from '../shared/RequirementOrderSelect';
import StatusTag from '../../../components/StatusTag';
import { REQUIREMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getRequirementStatusLabel } from '../../../utils/requirementStatus';
import { CPR_VAL, CPR_WRN } from '../../../utils/cutPanelConstants';
import CprOrderFacts from './CprOrderFacts';

const { Text } = Typography;

/**
 * Section 1 — Order and Header (PRD §8.1). Order and BOM version are the only inputs
 * and lock once the first line is added; everything else is fetched and read-only.
 */
const CprHeaderSection = memo(function CprHeaderSection({
  doc, order, orders, siblings, editable, onSelectOrder, onSelectBom, onRecalculate,
}) {
  const locked = !editable || doc.lines.length > 0 || Boolean(doc.id);
  const bomRevised = Boolean(doc.id && order && doc.bomVersion !== order.latestBomVersion);
  const orderRevised = Boolean(doc.id && order && doc.orderQtySnapshot !== order.totalQty);
  const bomOptions = (order?.approvedBoms || []).map((b) => ({ value: b.version, label: `${b.version} (approved)` }));

  return (
    <Card title="Order and Header" size="small" style={{ marginBottom: 16 }}>
      <Form layout="vertical" component="div">
        <Row gutter={16}>
          <Col xs={24} md={10} lg={8}>
            <Form.Item label="Order No." required htmlFor="cpr-order">
              {doc.id || !editable
                ? <Text strong>{doc.orderNo}</Text>
                : <RequirementOrderSelect id="cpr-order" orders={orders} value={doc.orderId ?? undefined} onChange={onSelectOrder} disabled={locked} />}
            </Form.Item>
          </Col>
          <Col xs={12} md={6} lg={4}>
            <Form.Item label="BOM Version" required htmlFor="cpr-bom">
              <Select id="cpr-bom" value={doc.bomVersion ?? undefined} options={bomOptions} onChange={onSelectBom} disabled={locked || !order} placeholder="Version" />
            </Form.Item>
          </Col>
          <Col xs={12} md={8} lg={6}>
            <Form.Item label="Cut Panel Requirement No.">
              <Text strong style={{ fontFamily: 'monospace' }}>{doc.cprNo || 'Generated on first save'}</Text>
            </Form.Item>
          </Col>
          <Col xs={24} lg={6}>
            <Form.Item label="Status">
              <Space wrap>
                <StatusTag status={doc.status} config={REQUIREMENT_STATUS_CONFIG} getLabel={getRequirementStatusLabel} />
                {bomRevised && <Tooltip title={CPR_WRN.WRN_05}><Tag color="warning" icon={<WarningOutlined />}>BOM revised</Tag></Tooltip>}
                {orderRevised && <Tooltip title={CPR_WRN.WRN_06}><Tag color="warning" icon={<WarningOutlined />}>Order revised</Tag></Tooltip>}
                {orderRevised && editable && <Button size="small" onClick={onRecalculate}>Recalculate</Button>}
              </Space>
            </Form.Item>
          </Col>
        </Row>
      </Form>
      {order && !order.approvedBoms.length && <Alert type="error" showIcon title={CPR_VAL.VAL_02} style={{ marginBottom: 12 }} />}
      {siblings.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={`${CPR_WRN.WRN_07} ${siblings.map((s) => `${s.cprNo} (${getRequirementStatusLabel(s.status)})`).join(', ')}`}
        />
      )}
      {order
        ? <CprOrderFacts order={order} doc={doc} />
        : <Text type="secondary">Select an order with an approved BOM to begin.</Text>}
    </Card>
  );
});

export default CprHeaderSection;
