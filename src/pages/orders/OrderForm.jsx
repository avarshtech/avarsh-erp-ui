import { useState } from 'react';
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Card,
  Row,
  Col,
  Table,
  Space,
  Divider,
  Typography,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  SendOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission } from '../../utils/permissions';

const { Title, Text } = Typography;
const { TextArea } = Input;

const OrderForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [lineItems, setLineItems] = useState([
    {
      key: '1',
      style: '',
      color: '',
      size: '',
      quantity: 0,
      unitPrice: 0,
      amount: 0,
    },
  ]);

  const customers = [
    { value: '1', label: 'Fashion Forward Ltd' },
    { value: '2', label: 'Urban Style Co' },
    { value: '3', label: 'Kids Kingdom' },
    { value: '4', label: 'Elite Apparel' },
    { value: '5', label: 'Denim Designers' },
  ];

  const styles = [
    { value: 'casual-shirt', label: 'Men\'s Casual Shirts' },
    { value: 'summer-dress', label: 'Women\'s Summer Dresses' },
    { value: 'kids-tshirt', label: 'Children\'s T-Shirts' },
    { value: 'polo-shirt', label: 'Premium Polo Shirts' },
    { value: 'jeans', label: 'Slim Fit Jeans' },
  ];

  const colors = [
    { value: 'navy-blue', label: 'Navy Blue' },
    { value: 'white', label: 'White' },
    { value: 'black', label: 'Black' },
    { value: 'grey', label: 'Grey' },
    { value: 'red', label: 'Red' },
    { value: 'floral', label: 'Floral Print' },
  ];

  const sizes = [
    { value: 'xs', label: 'XS' },
    { value: 's', label: 'S' },
    { value: 'm', label: 'M' },
    { value: 'l', label: 'L' },
    { value: 'xl', label: 'XL' },
    { value: 'xxl', label: 'XXL' },
  ];

  const handleAddLine = () => {
    const newKey = String(lineItems.length + 1);
    setLineItems([
      ...lineItems,
      {
        key: newKey,
        style: '',
        color: '',
        size: '',
        quantity: 0,
        unitPrice: 0,
        amount: 0,
      },
    ]);
  };

  const handleRemoveLine = (key) => {
    if (lineItems.length === 1) {
      message.warning('At least one line item is required');
      return;
    }
    setLineItems(lineItems.filter((item) => item.key !== key));
  };

  const handleLineChange = (key, field, value) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.key === key) {
          const updated = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updated.amount = (updated.quantity || 0) * (updated.unitPrice || 0);
          }
          return updated;
        }
        return item;
      })
    );
  };

  const getTotalAmount = () => {
    return lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const getTotalQuantity = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  };

  const lineColumns = [
    {
      title: '#',
      dataIndex: 'key',
      key: 'key',
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Style',
      dataIndex: 'style',
      key: 'style',
      width: 200,
      render: (value, record) => (
        <Select
          placeholder="Select style"
          style={{ width: '100%' }}
          value={value || undefined}
          onChange={(v) => handleLineChange(record.key, 'style', v)}
          options={styles}
        />
      ),
    },
    {
      title: 'Color',
      dataIndex: 'color',
      key: 'color',
      width: 150,
      render: (value, record) => (
        <Select
          placeholder="Select color"
          style={{ width: '100%' }}
          value={value || undefined}
          onChange={(v) => handleLineChange(record.key, 'color', v)}
          options={colors}
        />
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (value, record) => (
        <Select
          placeholder="Size"
          style={{ width: '100%' }}
          value={value || undefined}
          onChange={(v) => handleLineChange(record.key, 'size', v)}
          options={sizes}
        />
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 120,
      render: (value, record) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleLineChange(record.key, 'quantity', v)}
          formatter={(v) => v.toLocaleString()}
        />
      ),
    },
    {
      title: 'Unit Price ($)',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      width: 130,
      render: (value, record) => (
        <InputNumber
          min={0}
          step={0.01}
          precision={2}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleLineChange(record.key, 'unitPrice', v)}
        />
      ),
    },
    {
      title: 'Amount ($)',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      render: (value) => (
        <Text strong style={{ color: '#10b981' }}>
          ${(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 60,
      render: (_, record) => (
        <Popconfirm
          title="Remove this line?"
          onConfirm={() => handleRemoveLine(record.key)}
          okText="Yes"
          cancelText="No"
        >
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const handleSubmit = (values) => {
    const orderData = {
      ...values,
      lineItems,
      totalQuantity: getTotalQuantity(),
      totalAmount: getTotalAmount(),
    };
    console.log('Order Data:', orderData);
    message.success('Order saved successfully!');
    navigate('/orders/list');
  };

  const handleSaveAsDraft = () => {
    message.info('Order saved as draft');
  };

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/orders/list')}
          />
          <h1>{id ? 'Edit Order' : 'Create New Order'}</h1>
        </Space>
        <div className="header-actions">
          {hasPermission('orders', id ? 'update' : 'add') && (
            <Button icon={<SaveOutlined />} onClick={handleSaveAsDraft}>
              Save as Draft
            </Button>
          )}
          {hasPermission('orders', id ? 'update' : 'add') && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={() => form.submit()}
            >
              Submit Order
            </Button>
          )}
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          orderDate: dayjs(),
          priority: 'medium',
        }}
      >
        {/* Order Details */}
        <Card style={{ marginBottom: 24 }}>
          <Title level={5} style={{ marginBottom: 24 }}>
            Order Information
          </Title>
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item
                name="customer"
                label="Customer"
                rules={[{ required: true, message: 'Please select customer' }]}
              >
                <Select
                  placeholder="Select customer"
                  options={customers}
                  showSearch
                  filterOption={(input, option) =>
                    option.label.toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="buyerRef"
                label="Buyer Reference"
                rules={[{ required: true, message: 'Please enter buyer reference' }]}
              >
                <Input placeholder="Enter buyer reference number" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="orderDate"
                label="Order Date"
                rules={[{ required: true, message: 'Please select order date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item
                name="deliveryDate"
                label="Expected Delivery Date"
                rules={[{ required: true, message: 'Please select delivery date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="priority" label="Priority">
                <Select
                  options={[
                    { value: 'low', label: 'Low' },
                    { value: 'medium', label: 'Medium' },
                    { value: 'high', label: 'High' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="paymentTerms" label="Payment Terms">
                <Select
                  placeholder="Select payment terms"
                  options={[
                    { value: 'net30', label: 'Net 30' },
                    { value: 'net60', label: 'Net 60' },
                    { value: 'cod', label: 'Cash on Delivery' },
                    { value: 'advance', label: '100% Advance' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Line Items */}
        <Card style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Title level={5} style={{ margin: 0 }}>
              Order Items
            </Title>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddLine}
            >
              Add Line
            </Button>
          </div>
          <Table
            columns={lineColumns}
            dataSource={lineItems}
            pagination={false}
            scroll={{ x: 1000 }}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#f8fafc' }}>
                  <Table.Summary.Cell index={0} colSpan={4}>
                    <Text strong>Totals</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1}>
                    <Text strong>{getTotalQuantity().toLocaleString()}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}></Table.Summary.Cell>
                  <Table.Summary.Cell index={3}>
                    <Text strong style={{ color: '#10b981', fontSize: 16 }}>
                      ${getTotalAmount().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4}></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        </Card>

        {/* Additional Details */}
        <Card>
          <Title level={5} style={{ marginBottom: 24 }}>
            Additional Information
          </Title>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item name="shippingAddress" label="Shipping Address">
                <TextArea rows={3} placeholder="Enter shipping address" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="specialInstructions" label="Special Instructions">
                <TextArea rows={3} placeholder="Any special instructions or notes" />
              </Form.Item>
            </Col>
          </Row>
        </Card>
      </Form>
    </div>
  );
};

export default OrderForm;
