import { Checkbox, Col, Form, Input, InputNumber, Row, Select } from 'antd';
import { getPresetFactor } from '../../../utils/uomConversions';
import { numericInputProps } from '../../../utils/inputHelpers';

/**
 * How the material is bought (purchase unit, HSN, allowance) and, optionally, the different unit
 * it is costed in — e.g. bought per kg, consumed in grams — with the factor between them. For a
 * variant added to an existing item these are the item's own and cannot change here.
 */
export default function UomFields({ form, uomOptions, allUoms, locked }) {
  const uomId = Form.useWatch('uomId', form);
  const secondaryUomId = Form.useWatch('secondaryUomId', form);
  const splitUnit = Form.useWatch('splitUnit', form);
  const symbolOf = (id) => allUoms.find((u) => u.id === id)?.symbol || '';

  const onSecondaryChange = (id) => {
    const preset = getPresetFactor(symbolOf(uomId), symbolOf(id));
    if (preset && !form.getFieldValue('uomConversionFactor')) form.setFieldValue('uomConversionFactor', preset);
  };

  return (
    <>
      <Row gutter={12}>
        <Col span={8}>
          <Form.Item name="uomId" label="Purchase Unit" rules={[{ required: true, message: 'Pick a unit' }]}>
            <Select showSearch={{ optionFilterProp: 'label' }} options={uomOptions} disabled={locked} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="defaultAllowance" label="Allowance %" rules={[{ required: true, message: 'Required' }]}>
            <InputNumber min={0} max={100} step={0.5} controls={false} disabled={locked} style={{ width: '100%' }} {...numericInputProps} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="hsnCode" label="HSN Code">
            <Input maxLength={20} disabled={locked} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="splitUnit" valuePropName="checked" style={{ marginBottom: splitUnit ? 8 : 16 }}>
        <Checkbox disabled={locked}>Costed in a different unit (e.g. bought per kg, consumed in grams)</Checkbox>
      </Form.Item>
      {splitUnit && (
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="secondaryUomId" label="Consumption Unit" rules={[{ required: true, message: 'Pick a unit' }]}>
              <Select showSearch={{ optionFilterProp: 'label' }} disabled={locked} onChange={onSecondaryChange}
                options={allUoms.filter((u) => u.id !== uomId).map((u) => ({ value: u.id, label: u.symbol || u.name }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="uomConversionFactor" rules={[{ required: true, message: 'Required' }]}
              label={`1 ${symbolOf(uomId) || 'purchase unit'} = ? ${symbolOf(secondaryUomId) || 'consumption units'}`}>
              <InputNumber min={0.000001} controls={false} disabled={locked} style={{ width: '100%' }} {...numericInputProps} />
            </Form.Item>
          </Col>
        </Row>
      )}
    </>
  );
}
