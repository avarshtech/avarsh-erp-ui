import { Checkbox, Form, Typography } from 'antd';
import { poKey, poLabel } from './shipmentPos';

const { Text } = Typography;

const TOOLTIP = 'A shipment to one location carries the buyer POs ticked here. Untick a PO that goes on another shipment: '
  + 'its cartons then stay off this shipment\'s packing list.';

const orderLabel = (o) => [o.orderNo, o.styleNo].filter(Boolean).join(' — ');

/**
 * Under the Orders picker: each picked order's buyer POs (number · destination · dispatch
 * date), all ticked when the order is added. An order whose lines carry no PO numbers
 * travels whole. `orders`: [{ orderId, orderNo, styleNo, choices, known }] from useShipmentParties.
 */
const ShipmentPoPicker = ({ orders }) => {
  if (!orders.length) return null;
  return (
    <>
      <Text strong style={{ display: 'block', marginBottom: 8 }}>Buyer POs on this shipment</Text>
      {orders.map((o) => (o.choices.length ? (
        <Form.Item
          key={o.orderId}
          name={['orderPos', String(o.orderId)]}
          label={orderLabel(o)}
          tooltip={TOOLTIP}
          rules={[{ required: true, type: 'array', min: 1, message: `Tick at least one buyer PO of ${o.orderNo}` }]}
          style={{ marginBottom: 12 }}
        >
          <Checkbox.Group options={o.choices.map((p) => ({ value: poKey(p), label: poLabel(p) }))} />
        </Form.Item>
      ) : (
        <Form.Item key={o.orderId} label={orderLabel(o)} style={{ marginBottom: 12 }}>
          <Text type="secondary">
            {o.known
              ? 'No buyer PO numbers on this order: it travels whole.'
              : 'Every buyer PO travels, as saved. Search for this order in Orders above to choose its POs.'}
          </Text>
        </Form.Item>
      )))}
    </>
  );
};

export default ShipmentPoPicker;
