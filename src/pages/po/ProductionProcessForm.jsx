import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Form, Input, Select, DatePicker, InputNumber, Radio, Divider, Typography } from 'antd';
import { searchOrders } from '../../services/orderService';
import { PROCESS_TYPE, PROCESSING_UNIT_TYPE_OPTIONS } from '../../utils/poStatusConstants';
import { numericInputProps } from '../../utils/inputHelpers';

const { Text } = Typography;

const ProductionProcessForm = ({ form, processType, editable, onOrderSelect, onProcessDetailChange }) => {
  const [orderOptions, setOrderOptions] = useState([]);
  const [orderSearching, setOrderSearching] = useState(false);

  const handleOrderSearch = useCallback(async (value) => {
    if (!value || value.length < 2) return;
    setOrderSearching(true);
    try {
      const result = await searchOrders({ search: value, status: 'CONFIRMED', size: 20 });
      setOrderOptions((result.content || []).map((o) => ({
        value: o.id, label: `${o.orderNo} — ${o.buyerName || ''}`,
        orderNo: o.orderNo, buyerName: o.buyerName, styleNo: o.styleNo,
        styleId: o.styleId, totalOrderQty: o.totalOrderQty, orderLines: o.orderLines,
      })));
    } catch { /* silent */ }
    finally { setOrderSearching(false); }
  }, []);

  const handleOrderChange = useCallback((orderId) => {
    const order = orderOptions.find((o) => o.value === orderId);
    if (order) {
      form.setFieldsValue({ processDetail_styleNo: order.styleNo });
      onOrderSelect?.(order);
    }
  }, [orderOptions, form, onOrderSelect]);

  const isCutting = processType === PROCESS_TYPE.CUTTING;
  const isSewing = processType === PROCESS_TYPE.SEWING;

  return (
    <>
      <Divider orientation="left" style={{ margin: '8px 0 16px' }}>
        <Text strong>Production Details — {processType}</Text>
      </Divider>
      <Row gutter={[16, 8]}>
        <Col xs={24} md={8}>
          <Form.Item name="processDetail_orderId" label="Order" rules={[{ required: true, message: 'Select an order' }]}>
            <Select showSearch filterOption={false} onSearch={handleOrderSearch} onChange={handleOrderChange}
              loading={orderSearching} options={orderOptions} placeholder="Search order no..." disabled={!editable} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="processDetail_styleNo" label="Style No">
            <Input disabled />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="processDetail_processingUnitType" label="In-house / Vendor" initialValue="UNIT">
            <Radio.Group options={PROCESSING_UNIT_TYPE_OPTIONS} optionType="button" buttonStyle="solid" disabled={!editable} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="processDetail_processingUnitName" label="Unit / Vendor Name">
            <Input placeholder="Enter unit or vendor name" disabled={!editable} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="processDetail_plannedStartDate" label="Planned Start Date">
            <DatePicker style={{ width: '100%' }} disabled={!editable} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="processDetail_plannedDeliveryDate" label="Planned Delivery Date">
            <DatePicker style={{ width: '100%' }} disabled={!editable} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="processDetail_allowancePercent" label="Overall Allowance %">
            <InputNumber style={{ width: '100%' }} min={0} max={50} precision={2} disabled={!editable} {...numericInputProps} />
          </Form.Item>
        </Col>

        {/* Cutting-specific fields */}
        {isCutting && (
          <>
            <Col xs={24} md={8}>
              <Form.Item name="processDetail_markerEfficiency" label="Marker Efficiency %">
                <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} disabled={!editable} {...numericInputProps} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="processDetail_cadConsumptionPerPc" label="CAD Consumption/Pc">
                <InputNumber style={{ width: '100%' }} min={0} precision={4} disabled={!editable} {...numericInputProps} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="processDetail_bomConsumptionPerPc" label="BOM Consumption/Pc">
                <InputNumber style={{ width: '100%' }} min={0} precision={4} disabled={!editable} {...numericInputProps} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="processDetail_fabricWastagePercent" label="Fabric Wastage %">
                <InputNumber style={{ width: '100%' }} min={0} max={50} precision={2} disabled={!editable} {...numericInputProps} />
              </Form.Item>
            </Col>
          </>
        )}

        {/* Sewing-specific fields */}
        {isSewing && (
          <>
            <Col xs={24} md={8}>
              <Form.Item name="processDetail_sewingLine" label="Sewing Line">
                <Input placeholder="e.g. Line 3" disabled={!editable} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="processDetail_sam" label="SAM (Std Allowed Min)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} disabled={!editable} {...numericInputProps} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="processDetail_targetDailyOutput" label="Target Daily Output">
                <InputNumber style={{ width: '100%' }} min={0} precision={0} disabled={!editable} />
              </Form.Item>
            </Col>
          </>
        )}
      </Row>
    </>
  );
};

export default ProductionProcessForm;
