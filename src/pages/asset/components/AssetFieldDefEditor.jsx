import { Button, Card, Col, Divider, Form, Input, Row, Select, Switch } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { FIELD_TYPES } from '../../../utils/assetConstants';

/**
 * The extra fields this category adds to the asset form.
 *
 * The key is what the value is stored under, so it is fixed in shape
 * (lower-case, no spaces) and the label is what people read. Four types and
 * nothing computed: a category that needs a formula needs a developer, not a
 * setup screen.
 */
const AssetFieldDefEditor = () => (
  <>
    <Divider titlePlacement="start">Extra fields on the asset form</Divider>

    <Form.List name="fieldDefs">
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name, ...rest }) => (
            <Card key={key} size="small" style={{ marginBottom: 12 }}>
              <Row gutter={12}>
                <Col xs={24} sm={8}>
                  <Form.Item
                    {...rest}
                    name={[name, 'key']}
                    label="Key"
                    rules={[
                      { required: true, message: 'Needed' },
                      { pattern: /^[a-z][a-z0-9_]{0,29}$/, message: 'Lower-case, digits or _' },
                    ]}
                  >
                    <Input placeholder="motor_type" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={8}>
                  <Form.Item {...rest} name={[name, 'label']} label="Label" rules={[{ required: true, message: 'Needed' }]}>
                    <Input placeholder="Motor type" maxLength={60} />
                  </Form.Item>
                </Col>
                <Col xs={16} sm={5}>
                  <Form.Item {...rest} name={[name, 'type']} label="Type" rules={[{ required: true, message: 'Needed' }]}>
                    <Select options={FIELD_TYPES} />
                  </Form.Item>
                </Col>
                <Col xs={8} sm={3}>
                  <Form.Item {...rest} name={[name, 'required']} label="Required" valuePropName="checked">
                    <Switch size="small" />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  {/* Only a dropdown has options; the server rejects one with none. */}
                  <Form.Item
                    {...rest}
                    noStyle
                    shouldUpdate={(prev, next) => prev.fieldDefs?.[name]?.type !== next.fieldDefs?.[name]?.type}
                  >
                    {({ getFieldValue }) => (getFieldValue(['fieldDefs', name, 'type']) === 'SELECT' ? (
                      <Form.Item
                        name={[name, 'options']}
                        label="Options"
                        rules={[{ required: true, message: 'A dropdown needs at least one option' }]}
                      >
                        <Select mode="tags" tokenSeparators={[',']} placeholder="Type an option and press Enter" />
                      </Form.Item>
                    ) : null)}
                  </Form.Item>
                </Col>
              </Row>
              <Button danger size="small" icon={<DeleteOutlined />} onClick={() => remove(name)}>
                Remove field
              </Button>
            </Card>
          ))}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ type: 'TEXT', required: false })}>
            Add a field
          </Button>
        </>
      )}
    </Form.List>
  </>
);

export default AssetFieldDefEditor;
