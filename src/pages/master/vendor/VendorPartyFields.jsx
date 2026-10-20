import { Col, Form, Input, Row, Switch } from 'antd';
import { getLocationByPincode } from '../../../services/master/supplierService';
import { EMAIL_REGEX } from '../../../utils/partyValidation';

/**
 * Who the vendor is and where. Required as on the Supplier master: the name, the contact person, phone,
 * email and the full address. A vendor carried over from the Supplier master, or quick-created on a
 * cost sheet, may lack some of them; its first edit asks for them.
 */
const VendorPartyFields = ({ form }) => {
  // Six digits fill the city, state and country, as on the Supplier master
  const fillFromPincode = async (e) => {
    const pincode = e.target.value;
    if (pincode?.length !== 6) return;
    const location = await getLocationByPincode(pincode);
    if (location) form.setFieldsValue({ city: location.city, state: location.state, country: location.country });
  };

  return (
    <Row gutter={16}>
      <Col xs={24} md={16}>
        <Form.Item name="name" label="Vendor Name" rules={[{ required: true, whitespace: true, message: 'Vendor Name is required' }]}>
          <Input placeholder="e.g. Annai Panel Printers" maxLength={255} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="active" label="Active" valuePropName="checked"
          tooltip="An inactive vendor leaves every picker; documents that name it keep it.">
          <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="contactPerson" label="Contact Person"
          rules={[{ required: true, whitespace: true, message: 'Contact Person is required' }]}>
          <Input placeholder="Contact person" maxLength={100} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="phone" label="Phone"
          rules={[{ required: true, message: 'Phone is required' }, { pattern: /^[0-9+\- ]{6,20}$/, message: 'Digits only, 6 to 20' }]}>
          <Input placeholder="e.g. 9840012345" maxLength={20} />
        </Form.Item>
      </Col>
      <Col xs={24} md={8}>
        <Form.Item name="email" label="Email"
          rules={[{ required: true, message: 'Email is required' }, { pattern: EMAIL_REGEX, message: 'Invalid email format' }]}>
          <Input placeholder="name@example.com" maxLength={150} />
        </Form.Item>
      </Col>
      <Col span={24}>
        <Form.Item name="address" label="Address" rules={[{ required: true, whitespace: true, message: 'Address is required' }]}>
          <Input.TextArea placeholder="Street, area" autoSize={{ minRows: 1, maxRows: 3 }} maxLength={2000} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="pincode" label="Pincode"
          rules={[{ required: true, message: 'Pincode is required' }, { pattern: /^[0-9]{6}$/, message: 'Pincode must be 6 digits' }]}
          normalize={(value) => value?.replace(/[^0-9]/g, '').slice(0, 6)}>
          <Input placeholder="6 digits" maxLength={6} onBlur={fillFromPincode} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="city" label="City" rules={[{ required: true, whitespace: true, message: 'City is required' }]}>
          <Input placeholder="City" maxLength={100} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="state" label="State" rules={[{ required: true, whitespace: true, message: 'State is required' }]}>
          <Input placeholder="State" maxLength={100} />
        </Form.Item>
      </Col>
      <Col xs={12} md={6}>
        <Form.Item name="country" label="Country" rules={[{ required: true, whitespace: true, message: 'Country is required' }]}>
          <Input placeholder="Country" maxLength={100} />
        </Form.Item>
      </Col>
    </Row>
  );
};

export default VendorPartyFields;
