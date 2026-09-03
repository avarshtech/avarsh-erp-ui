import { useState } from 'react';
import { Button, Form, Input, InputNumber, Space, Typography } from 'antd';
import { LinkOutlined } from '@ant-design/icons';
import { formatNumber } from '../../../utils/formatters';
import OrderSelect from './OrderSelect';

const { Text } = Typography;

/**
 * Inline "map N units of this line to order X" form, rendered inside the
 * expanded row of a PO line. Quantity defaults to whatever is still open.
 */
const AllocationAdder = ({ line, onAdd }) => {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleFinish = async (values) => {
    setSaving(true);
    try {
      await onAdd({ poLineItemId: line.id, ...values });
      form.resetFields();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form
      form={form}
      layout="inline"
      size="small"
      onFinish={handleFinish}
      initialValues={{ qty: line.unmappedQty }}
      style={{ padding: '8px 0 4px', rowGap: 8 }}
    >
      <Form.Item name="orderId" rules={[{ required: true, message: 'Pick an order' }]} style={{ marginBottom: 0 }}>
        <OrderSelect disabled={saving} />
      </Form.Item>
      <Form.Item
        name="qty"
        rules={[
          { required: true, message: 'Qty required' },
          { type: 'number', min: 0.001, max: line.unmappedQty, message: `Max ${formatNumber(line.unmappedQty, 3)} ${line.uom}` },
        ]}
        style={{ marginBottom: 0 }}
      >
        <InputNumber min={0} max={line.unmappedQty} step={1} precision={3} disabled={saving} style={{ width: 150 }} addonAfter={line.uom} />
      </Form.Item>
      <Form.Item name="remarks" style={{ marginBottom: 0 }}>
        <Input placeholder="Remarks (optional)" disabled={saving} style={{ width: 220 }} allowClear />
      </Form.Item>
      <Form.Item style={{ marginBottom: 0 }}>
        <Space>
          <Button type="primary" htmlType="submit" icon={<LinkOutlined />} loading={saving}>Map</Button>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Open: {formatNumber(line.unmappedQty, 3)} {line.uom}
          </Text>
        </Space>
      </Form.Item>
    </Form>
  );
};

export default AllocationAdder;
