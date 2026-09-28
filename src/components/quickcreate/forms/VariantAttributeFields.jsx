import { Col, Divider, Form, Input, Row, Select } from 'antd';

/**
 * The variant: its name and one value per attribute of the item type (every attribute is
 * required, as in Item Master). A new item type picks which attributes it has first.
 */
export default function VariantAttributeFields({ attributes, isNewType, allAttributes }) {
  return (
    <>
      <Divider style={{ margin: '4px 0 12px' }}>Variant</Divider>
      {isNewType && (
        <Form.Item name="newTypeAttributeIds" label="Attributes of the new item type"
          extra="Its variants are told apart by these in Item Master, and each needs a value (e.g. Colour, GSM)."
          rules={[{ required: true, type: 'array', min: 1, message: 'Pick at least one attribute, e.g. Colour' }]}>
          <Select mode="multiple" allowClear placeholder="e.g. Colour, GSM"
            options={allAttributes.map((a) => ({ value: a.id, label: a.attributeName }))} />
        </Form.Item>
      )}
      <Form.Item name="variantName" label="Variant Name"
        rules={[{ required: true, message: 'Variant name is required' }, { min: 5, message: 'At least 5 characters' }]}>
        <Input placeholder="e.g. Black 180 GSM" maxLength={100} />
      </Form.Item>
      {attributes.length > 0 && (
        <Row gutter={12}>
          {attributes.map((attr) => (
            <Col span={12} key={attr.id}>
              <Form.Item name={`attr_${attr.id}`} label={attr.attributeName}
                rules={[{ required: true, whitespace: true, message: `${attr.attributeName} is required` }]}>
                <Input placeholder={attr.attributeName} maxLength={100} />
              </Form.Item>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
