import { Col, DatePicker, Form, Input, InputNumber, Row, Select } from 'antd';

/**
 * The category's own fields, rendered from its definitions.
 *
 * Values live under the `specData` namespace, so a category field called
 * "name" or "status" cannot collide with the asset's own.
 */
const AssetSpecFields = ({ defs }) => {
  if (!defs?.length) return null;

  return (
    <Row gutter={16}>
      {defs.map((def) => (
        <Col xs={24} sm={12} md={8} key={def.key}>
          <Form.Item
            name={['specData', def.key]}
            label={def.label}
            rules={def.required ? [{ required: true, message: `${def.label} is required` }] : undefined}
          >
            {def.type === 'NUMBER' ? <InputNumber style={{ width: '100%' }} />
              : def.type === 'DATE' ? <DatePicker style={{ width: '100%' }} format="DD-MM-YYYY" />
                : def.type === 'SELECT' ? (
                  <Select
                    allowClear
                    placeholder={`Select ${def.label.toLowerCase()}`}
                    options={(def.options ?? []).map((option) => ({ value: option, label: option }))}
                  />
                ) : <Input maxLength={200} />}
          </Form.Item>
        </Col>
      ))}
    </Row>
  );
};

export default AssetSpecFields;
