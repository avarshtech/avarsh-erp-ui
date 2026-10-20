import { Col, DatePicker, Form, Input, InputNumber, Row, Select, Switch } from 'antd';
import { notBeforeRule } from '../../../utils/dateRules';

/**
 * Purchase, warranty and AMC.
 *
 * The AMC fields appear only when there is an AMC, and the server clears them
 * when the switch is off, so the dates on the detail screen always belong to a
 * contract that is actually live.
 */
const AssetPurchaseFields = ({ supplierOptions, amcAvailable }) => {
  // Both date pairs are checked on the field itself. The server and the
  // database enforce the same rule, but only after a save - and when the
  // database answered first the message named a constraint, which is no help
  // to somebody filling in a warranty date.
  const form = Form.useFormInstance();

  return (
  <Row gutter={16}>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="purchaseDate" label="Purchase date">
        <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="supplierId" label="Supplier">
        <Select allowClear showSearch optionFilterProp="label" placeholder="Select supplier" options={supplierOptions} />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item
        name="supplierText"
        label="Or supplier name"
        tooltip="For a one-off purchase from someone who is not in the supplier master."
      >
        <Input maxLength={150} />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="invoiceNo" label="Invoice no.">
        <Input maxLength={50} />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="poNo" label="PO no.">
        <Input maxLength={50} />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="purchaseCost" label="Purchase cost">
        <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="₹" />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="warrantyStart" label="Warranty from">
        <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item
        name="warrantyEnd"
        label="Warranty to"
        dependencies={['warrantyStart']}
        rules={[notBeforeRule(() => form.getFieldValue('warrantyStart'),
          { earlier: 'warranty start', later: 'warranty end' })]}
      >
        <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
      </Form.Item>
    </Col>
    <Col xs={24} sm={12} md={8}>
      <Form.Item name="amcAvailable" label="Under AMC" valuePropName="checked">
        <Switch />
      </Form.Item>
    </Col>

    {amcAvailable && (
      <>
        <Col xs={24} sm={12} md={8}>
          <Form.Item
            name="amcVendorId"
            label="AMC vendor"
            tooltip="From the supplier master. Leave it blank and type the name below if the service company is not in it."
          >
            <Select allowClear showSearch optionFilterProp="label" placeholder="Select vendor" options={supplierOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Form.Item
            name="amcVendorText"
            label="Or AMC vendor name"
            tooltip="For a service company that is not in the supplier master. Ignored if a vendor is picked above."
          >
            <Input maxLength={150} placeholder="e.g. Coimbatore Service Co" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Form.Item name="amcStart" label="AMC from">
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Form.Item
            name="amcEnd"
            label="AMC to"
            dependencies={['amcStart']}
            rules={[
              { required: true, message: 'An AMC needs an end date, or nothing can warn you before it lapses' },
              notBeforeRule(() => form.getFieldValue('amcStart'),
                { earlier: 'AMC start', later: 'AMC end' }),
            ]}
          >
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>
        </Col>
      </>
    )}
  </Row>
  );
};

export default AssetPurchaseFields;
