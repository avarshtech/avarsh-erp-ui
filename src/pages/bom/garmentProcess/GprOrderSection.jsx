import { memo, useMemo } from 'react';
import { Alert, App, Card, Col, Form, Row, Typography } from 'antd';
import RequirementOrderSelect from '../shared/RequirementOrderSelect';
import FactSheet from '../../../components/FactSheet';
import { requestedByProcess } from '../../../utils/garmentProcessCalc';
import { formatDate } from '../../../utils/formatters';

const { Text } = Typography;
const n = (v) => Number(v || 0).toLocaleString('en-IN');

/**
 * A. Order details (PRD §7): Order No. is the only input; the rest is fetched and locked.
 * Changing the order when lines exist asks first, then clears the lines (PRD §7).
 * OP-2: other open requirements on the same order are shown, not blocked.
 */
const GprOrderSection = memo(function GprOrderSection({ doc, order, orders, siblings, editable, onSelectOrder }) {
  const { modal } = App.useApp();
  const requested = useMemo(() => requestedByProcess(siblings), [siblings]);

  const change = (orderId) => {
    if (!doc.orderId || orderId === doc.orderId) { onSelectOrder(orderId); return; }
    modal.confirm({
      title: 'Change the order?',
      content: 'All process lines on this requirement will be cleared and one empty line started for the new order.',
      okText: 'Change order',
      okButtonProps: { danger: true },
      onOk: () => onSelectOrder(orderId),
    });
  };

  const fields = order ? [
    { label: 'Buyer', value: order.buyer },
    { label: 'Style No.', value: order.styleNo },
    { label: 'Garment', value: order.garmentDescription },
  ] : [];
  const tiles = order ? [
    { label: 'Order Qty', value: n(order.totalQty), accent: true },
    { label: 'Delivery Date', value: formatDate(order.deliveryDate, 'DD-MM-YYYY') },
  ] : [];

  return (
    <Card title="A. Order details" size="small" style={{ marginBottom: 16 }}>
      <Form layout="vertical" component="div">
        <Row gutter={16}>
          <Col xs={24} md={10} lg={8}>
            <Form.Item label="Order No." required htmlFor="gpr-order">
              {editable
                ? <RequirementOrderSelect id="gpr-order" orders={orders} value={doc.orderId ?? undefined} onChange={change} />
                : <Text strong>{doc.orderNo}</Text>}
            </Form.Item>
          </Col>
        </Row>
      </Form>
      {order
        ? <FactSheet fields={fields} tiles={tiles} />
        : <Text type="secondary">Select a confirmed order to begin.</Text>}
      {requested.length > 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12 }}
          title="Already requested on this order (open requirements — shown, not blocked)"
          description={requested.map((r) => `${r.label}: ${n(r.total)} (${r.requirementNos.join(', ')})`).join(' · ')}
        />
      )}
    </Card>
  );
});

export default GprOrderSection;
