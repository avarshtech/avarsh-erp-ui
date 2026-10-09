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

const LOCKED_TOOLTIP = 'Packing lists or invoices have been raised against this shipment, so its consignee can no longer change.';

const ordersEmptyText = (buyerId, loading, failed) => {
  if (buyerId == null) return 'Pick a consignee first';
  if (loading) return <Spin size="small" />;
  if (failed) return 'Orders could not be loaded';
  return 'No orders for this consignee in the working branch';
};

const printsAs = (block) => (block ? <span style={PRE_LINE}>{block}</span> : null);

// An explicit `disabled={false}` beats the Form's own (antd: `customDisabled ?? context`), which
// would leave a field editable on a read-only shipment: only ever disable, never enable.
const onlyIf = (condition) => (condition ? true : undefined);

/**
 * Consignee, orders, notify party and — only when the bank is notified and the buyer
 * has several shipping locations — the consignee address, with what each will print
 * as. `parties` is useShipmentParties; rendered inside the shipment Form.
 * `consigneeLocked`: documents name the consignee, so it stays as it is.
 */
const ShipmentConsigneeSection = ({ parties, buyerOptions, incotermOptions, consigneeLocked }) => {
  const {
    buyerId, orders, notifyOptions, addressOptions, askAddress, consigneePreview, notifyPreview,
  } = parties;

  return (
    <FormSection title="Consignee & Orders" columns={4}>
      <Form.Item
        name="buyerId"
        label="Consignee"
        tooltip={consigneeLocked ? LOCKED_TOOLTIP : undefined}
        rules={[{ required: true, message: 'Select the consignee' }]}
      >
        <FormSelect options={buyerOptions} placeholder="Select consignee" disabled={onlyIf(consigneeLocked)} />
      </Form.Item>
      <Form.Item
        name="orderIds"
        label="Orders"
        tooltip={ORDERS_TOOLTIP}
        rules={[{ required: true, type: 'array', min: 1, message: 'Select the order(s) this shipment carries' }]}
      >
        <FormSelect
          variant="multi"
          options={orders.options}
          loading={orders.loading}
          onSearch={orders.onSearch}
          disabled={onlyIf(buyerId == null)}
          placeholder="Select orders"
          notFoundContent={ordersEmptyText(buyerId, orders.loading, orders.failed)}
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
          disabled={onlyIf(!notifyOptions.length)}
          placeholder={notifyOptions.length || buyerId == null ? 'Select notify party' : 'Add a shipping location in Buyer Master'}
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
