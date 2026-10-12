import { Col, DatePicker, Form, Input, InputNumber, Row, Select, Switch } from 'antd';

/**
 * Purchase, warranty and AMC.
 *
 * The AMC fields appear only when there is an AMC, and the server clears them
 * when the switch is off, so the dates on the detail screen always belong to a
 * contract that is actually live.
 */
const AssetPurchaseFields = ({ supplierOptions, amcAvailable }) => (
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
      <Form.Item name="warrantyEnd" label="Warranty to">
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
          <Form.Item name="amcVendorId" label="AMC vendor">
            <Select allowClear showSearch optionFilterProp="label" placeholder="Select vendor" options={supplierOptions} />
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
            rules={[{ required: true, message: 'An AMC needs an end date, or nothing can warn you before it lapses' }]}
          >
            <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
          </Form.Item>
        </Col>
      </>
    )}
  </Row>
);

export default AssetPurchaseFields;
