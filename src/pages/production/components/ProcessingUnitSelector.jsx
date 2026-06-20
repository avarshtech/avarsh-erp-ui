import { useEffect, useState } from 'react';
import { Row, Col, Form, Radio, DatePicker } from 'antd';
import { FormSelect } from '../../../components/form';
import { DATE_FORMAT } from '../../../utils/uiConstants';
import { PROCESSING_UNIT_TYPE, PROCESSING_UNIT_OPTIONS, PO_TYPE } from '../../../utils/productionConstants';
import { getProcessingUnits, getVendors } from '../../../services/production/productionService';

/**
 * Header Unit/Vendor selector (PRD §4.6 / §5.4) — a radio toggle that loads the
 * matching list (in-house factory units vs. outsource vendors) plus a planned
 * delivery date. Bound to the parent Form via field names; must sit inside a Form.
 */
const ProcessingUnitSelector = ({ poType = PO_TYPE.CUTTING, disabled = false }) => {
  const form = Form.useFormInstance();
  const unitType = Form.useWatch('processingUnitType', form) || PROCESSING_UNIT_TYPE.UNIT;
  const [options, setOptions] = useState([]);

  useEffect(() => {
    let active = true;
    const fetcher = unitType === PROCESSING_UNIT_TYPE.VENDOR
      ? getVendors(poType)
      : getProcessingUnits('UNIT');
    fetcher.then((list) => {
      if (!active) return;
      setOptions((list || []).map((u) => ({ value: u.id, label: u.name })));
    });
    return () => { active = false; };
  }, [unitType, poType]);

  const handleUnitChange = (value, option) => {
    form.setFieldValue('processingUnitName', option?.label || '');
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24}>
        <Form.Item name="processingUnitType" label="Processing By" initialValue={PROCESSING_UNIT_TYPE.UNIT}>
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            disabled={disabled}
            options={PROCESSING_UNIT_OPTIONS}
            onChange={() => {
              form.setFieldsValue({ processingUnitId: undefined, processingUnitName: '' });
            }}
          />
        </Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item
          name="processingUnitId"
          label={unitType === PROCESSING_UNIT_TYPE.VENDOR ? 'Vendor' : 'Factory Unit'}
          rules={[{ required: true, message: 'Select a processing unit' }]}
        >
          <FormSelect
            placeholder={unitType === PROCESSING_UNIT_TYPE.VENDOR ? 'Select vendor' : 'Select unit'}
            options={options}
            disabled={disabled}
            onChange={handleUnitChange}
          />
        </Form.Item>
        <Form.Item name="processingUnitName" hidden><input /></Form.Item>
      </Col>
      <Col xs={24} md={12}>
        <Form.Item
          name="plannedDeliveryDate"
          label="Planned Delivery Date"
          rules={[{ required: true, message: 'Select a delivery date' }]}
        >
          <DatePicker format={DATE_FORMAT} style={{ width: '100%' }} disabled={disabled} />
        </Form.Item>
      </Col>
    </Row>
  );
};

export default ProcessingUnitSelector;
