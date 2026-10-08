import { Col, Form, Spin } from 'antd';
import FactSheet from '../../../components/FactSheet';
import { FormSection, FormSelect } from '../../../components/form';

const PRE_LINE = { whiteSpace: 'pre-line', fontWeight: 400 };

const MODE_OPTIONS = [
  { value: 'SEA', label: 'Sea' },
  { value: 'AIR', label: 'Air' },
  { value: 'COURIER', label: 'Courier' },
];

const ORDERS_TOOLTIP = 'Every order of this consignee except cancelled ones — a shipment can be booked before its order completes. '
  + 'Only orders of the working branch are listed.';

const ordersEmptyText = (consigneeName, loading, error) => {
  if (!consigneeName) return 'Pick a consignee first';
  if (loading) return <Spin size="small" />;
  if (error === 'FORBIDDEN') return 'Listing orders needs access to Orders';
  if (error) return 'Orders could not be loaded';
  return 'No orders for this consignee in the working branch';
};

const printsAs = (block) => (block ? <span style={PRE_LINE}>{block}</span> : null);

/**
 * Consignee, orders, notify party and — only when the bank is notified and the buyer
 * has several shipping locations — the consignee address, with what each will print
 * as. `parties` is useShipmentParties; rendered inside the shipment Form.
 */
const ShipmentConsigneeSection = ({ parties, buyerOptions, incotermOptions }) => {
  const {
    buyerName, orders, notifyOptions, addressOptions, askAddress, consigneePreview, notifyPreview,
  } = parties;

  return (
    <FormSection title="Consignee & Orders" columns={4}>
      <Form.Item name="buyerName" label="Consignee" rules={[{ required: true, message: 'Select the consignee' }]}>
        <FormSelect options={buyerOptions} placeholder="Select consignee" />
      </Form.Item>
      <Form.Item
        name="orderNos"
        label="Orders"
        tooltip={ORDERS_TOOLTIP}
        rules={[{ required: true, type: 'array', min: 1, message: 'Select the order(s) this shipment carries' }]}
      >
        <FormSelect
          variant="multi"
          options={orders.options}
          loading={orders.loading}
          onSearch={orders.onSearch}
          disabled={!buyerName}
          placeholder="Select orders"
          notFoundContent={ordersEmptyText(buyerName, orders.loading, orders.error)}
        />
      </Form.Item>
      <Form.Item name="mode" label="Mode" rules={[{ required: true }]}>
        <FormSelect variant="default" options={MODE_OPTIONS} />
      </Form.Item>
      <Form.Item name="incoterm" label="Incoterm" rules={[{ required: true, message: 'Select an incoterm' }]}>
        <FormSelect variant="default" options={incotermOptions} />
      </Form.Item>
      <Form.Item
        name="notifyValue"
        label="Notify party"
        tooltip="The buyer's bank, or one of its shipping locations — both from Buyer Master."
        rules={[{ required: true, message: 'Select the notify party' }]}
      >
        <FormSelect
          options={notifyOptions}
          disabled={!notifyOptions.length}
          placeholder={notifyOptions.length || !buyerName ? 'Select notify party' : 'Add a shipping location in Buyer Master'}
        />
      </Form.Item>
      {askAddress && (
        <Form.Item
          name="consigneeLocationId"
          label="Consignee address"
          tooltip="The bank is notified, so pick which of the buyer's shipping locations prints under the consignee."
          rules={[{ required: true, message: 'Select the consignee address' }]}
        >
          <FormSelect options={addressOptions} placeholder="Select shipping location" />
        </Form.Item>
      )}
      {(consigneePreview || notifyPreview) && (
        <Col xs={24} style={{ marginBottom: 24 }}>
          <FactSheet
            fields={[
              { label: 'Consignee prints as', value: printsAs(consigneePreview?.block), wide: true },
              { label: 'Notify party prints as', value: printsAs(notifyPreview?.block), wide: true },
            ]}
          />
        </Col>
      )}
    </FormSection>
  );
};

export default ShipmentConsigneeSection;
