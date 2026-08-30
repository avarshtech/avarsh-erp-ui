import { Form, Select, InputNumber, Button, Row, Col, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import {
  CONDITION_FIELDS,
  CONDITION_OPERATORS,
  getConditionField,
} from '../../../utils/approvalFlowConstants';

const { Text } = Typography;

// The backend evaluator only supports EQ/NEQ for string values.
const EQUALITY_OPS = CONDITION_OPERATORS.filter((o) => o.value === 'EQ' || o.value === 'NEQ');

/** Condition rows for one entity type — the value input follows the field's type. */
const FlowConditionEditor = ({ entityType, disabled = false }) => {
  const form = Form.useFormInstance();
  const fieldsForEntity = entityType ? (CONDITION_FIELDS[entityType] || []) : [];

  if (!entityType) {
    return <Text type="secondary">Select an entity type first to configure conditions.</Text>;
  }
  if (!fieldsForEntity.length) {
    return <Text type="secondary">No configurable conditions for this entity type.</Text>;
  }

  return (
    <Form.List name="conditions">
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name, ...restField }) => (
            <Row key={key} gutter={[8, 0]} align="middle" style={{ marginBottom: 8 }}>
              <Col span={8}>
                <Form.Item {...restField} name={[name, 'field']} noStyle>
                  <Select
                    placeholder="Field"
                    disabled={disabled}
                    style={{ width: '100%' }}
                    options={fieldsForEntity.map((f) => ({ value: f.value, label: f.label }))}
                    onChange={() => {
                      // Operator/value semantics change with the field type
                      form.setFieldValue(['conditions', name, 'operator'], undefined);
                      form.setFieldValue(['conditions', name, 'value'], undefined);
                    }}
                  />
                </Form.Item>
              </Col>
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) =>
                  prev.conditions?.[name]?.field !== curr.conditions?.[name]?.field}
              >
                {({ getFieldValue }) => {
                  const def = getConditionField(entityType, getFieldValue(['conditions', name, 'field']));
                  const isSelect = def?.type === 'select';
                  return (
                    <>
                      <Col span={5}>
                        <Form.Item {...restField} name={[name, 'operator']} noStyle>
                          <Select
                            placeholder="Op"
                            disabled={disabled}
                            style={{ width: '100%' }}
                            options={isSelect ? EQUALITY_OPS : CONDITION_OPERATORS}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={9}>
                        <Form.Item {...restField} name={[name, 'value']} noStyle>
                          {isSelect ? (
                            <Select
                              placeholder="Value"
                              disabled={disabled}
                              style={{ width: '100%' }}
                              options={(def.options || []).map((o) => ({ value: o, label: o }))}
                            />
                          ) : (
                            <InputNumber placeholder="Value" disabled={disabled} style={{ width: '100%' }} />
                          )}
                        </Form.Item>
                      </Col>
                    </>
                  );
                }}
              </Form.Item>
              <Col span={2}>
                {!disabled && (
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                )}
              </Col>
            </Row>
          ))}
          {!disabled && (
            <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} style={{ marginTop: 4 }}>
              Add Condition
            </Button>
          )}
          {fields.length > 1 && (
            <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
              All conditions must match (AND logic).
            </Text>
          )}
        </>
      )}
    </Form.List>
  );
};

export default FlowConditionEditor;
