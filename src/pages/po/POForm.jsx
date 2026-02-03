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
  Typography,
  message,
  Popconfirm,
  Descriptions,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const POForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [lineItems, setLineItems] = useState([
    {
      key: '1',
      itemCode: '',
      description: '',
      uom: 'meters',
      quantity: 0,
      unitPrice: 0,
      discount: 0,
      tax: 0,
      amount: 0,
    },
  ]);

  const suppliers = [
    {
      value: '1',
      label: 'Fabric World Inc',
      code: 'FWI-001',
      address: '123 Textile Lane, Mumbai, India',
      contact: 'Mr. Raj Patel',
      phone: '+91 9876543210',
      paymentTerms: 'Net 30',
    },
    {
      value: '2',
      label: 'Thread Masters Ltd',
      code: 'TML-002',
      address: '456 Thread Street, Delhi, India',
      contact: 'Ms. Priya Singh',
      phone: '+91 8765432109',
      paymentTerms: 'Net 45',
    },
    {
      value: '3',
      label: 'Button Bazaar',
      code: 'BB-003',
      address: '789 Button Road, Chennai, India',
      contact: 'Mr. Kumar',
      phone: '+91 7654321098',
      paymentTerms: 'Net 15',
    },
  ];

  const items = [
    { value: 'cotton-40s', label: 'Cotton Fabric 40s', uom: 'meters', rate: 5.50 },
    { value: 'cotton-60s', label: 'Cotton Fabric 60s', uom: 'meters', rate: 7.25 },
    { value: 'polyester', label: 'Polyester Fabric', uom: 'meters', rate: 4.00 },
    { value: 'thread-white', label: 'White Thread - 5000m', uom: 'cones', rate: 2.50 },
    { value: 'thread-black', label: 'Black Thread - 5000m', uom: 'cones', rate: 2.50 },
    { value: 'buttons-20mm', label: 'Shell Buttons 20mm', uom: 'gross', rate: 12.00 },
    { value: 'zipper-7inch', label: 'Zipper 7 inch', uom: 'pcs', rate: 0.45 },
    { value: 'interlining', label: 'Interlining - Fusible', uom: 'meters', rate: 1.80 },
  ];

  const uoms = [
    { value: 'meters', label: 'Meters' },
    { value: 'yards', label: 'Yards' },
    { value: 'kgs', label: 'Kgs' },
    { value: 'pcs', label: 'Pieces' },
    { value: 'gross', label: 'Gross' },
    { value: 'cones', label: 'Cones' },
    { value: 'sets', label: 'Sets' },
  ];

  const handleSupplierChange = (value) => {
    const supplier = suppliers.find((s) => s.value === value);
    setSelectedSupplier(supplier);
  };

  const handleAddLine = () => {
    const newKey = String(Date.now());
    setLineItems([
      ...lineItems,
      {
        key: newKey,
        itemCode: '',
        description: '',
        uom: 'meters',
        quantity: 0,
        unitPrice: 0,
        discount: 0,
        tax: 0,
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

  const handleItemSelect = (key, value) => {
    const item = items.find((i) => i.value === value);
    handleLineChange(key, 'itemCode', value);
    if (item) {
      handleLineChange(key, 'description', item.label);
      handleLineChange(key, 'uom', item.uom);
      handleLineChange(key, 'unitPrice', item.rate);
    }
  };

  const handleLineChange = (key, field, value) => {
    setLineItems(
      lineItems.map((item) => {
        if (item.key === key) {
          const updated = { ...item, [field]: value };
          // Calculate amount
          const qty = updated.quantity || 0;
          const price = updated.unitPrice || 0;
          const discount = updated.discount || 0;
          const tax = updated.tax || 0;
          const subtotal = qty * price;
          const discountAmt = subtotal * (discount / 100);
          const taxAmt = (subtotal - discountAmt) * (tax / 100);
          updated.amount = subtotal - discountAmt + taxAmt;
          return updated;
        }
        return item;
      })
    );
  };

  const getSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
  };

  const getTotalDiscount = () => {
    return lineItems.reduce((sum, item) => {
      const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
      return sum + subtotal * ((item.discount || 0) / 100);
    }, 0);
  };

  const getTotalTax = () => {
    return lineItems.reduce((sum, item) => {
      const subtotal = (item.quantity || 0) * (item.unitPrice || 0);
      const discountAmt = subtotal * ((item.discount || 0) / 100);
      return sum + (subtotal - discountAmt) * ((item.tax || 0) / 100);
    }, 0);
  };

  const getTotalAmount = () => {
    return lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const lineColumns = [
    {
      title: '#',
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Item',
      dataIndex: 'itemCode',
      width: 200,
      render: (value, record) => (
        <Select
          placeholder="Select item"
          style={{ width: '100%' }}
          value={value || undefined}
          onChange={(v) => handleItemSelect(record.key, v)}
          options={items}
          showSearch
          filterOption={(input, option) =>
            option.label.toLowerCase().includes(input.toLowerCase())
          }
        />
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      width: 180,
      render: (value, record) => (
        <Input
          placeholder="Description"
          value={value}
          onChange={(e) => handleLineChange(record.key, 'description', e.target.value)}
        />
      ),
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      width: 100,
      render: (value, record) => (
        <Select
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleLineChange(record.key, 'uom', v)}
          options={uoms}
        />
      ),
    },
    {
      title: 'Quantity',
      dataIndex: 'quantity',
      width: 100,
      render: (value, record) => (
        <InputNumber
          min={0}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleLineChange(record.key, 'quantity', v)}
        />
      ),
    },
    {
      title: 'Unit Price ($)',
      dataIndex: 'unitPrice',
      width: 110,
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
      title: 'Disc %',
      dataIndex: 'discount',
      width: 80,
      render: (value, record) => (
        <InputNumber
          min={0}
          max={100}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleLineChange(record.key, 'discount', v)}
        />
      ),
    },
    {
      title: 'Tax %',
      dataIndex: 'tax',
      width: 80,
      render: (value, record) => (
        <InputNumber
          min={0}
          max={100}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleLineChange(record.key, 'tax', v)}
        />
      ),
    },
    {
      title: 'Amount ($)',
      dataIndex: 'amount',
      width: 120,
      render: (value) => (
        <Text strong style={{ color: '#10b981' }}>
          ${(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: '',
      width: 50,
      render: (_, record) => (
        <Popconfirm title="Remove line?" onConfirm={() => handleRemoveLine(record.key)}>
          <Button type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const handleSubmit = (values) => {
    const poData = {
      ...values,
      supplier: selectedSupplier,
      lineItems,
      subtotal: getSubtotal(),
      totalDiscount: getTotalDiscount(),
      totalTax: getTotalTax(),
      totalAmount: getTotalAmount(),
    };
    console.log('PO Data:', poData);
    message.success('Purchase Order created successfully!');
    navigate('/purchase-orders/list');
  };

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/purchase-orders/list')} />
          <h1>{id ? 'Edit Purchase Order' : 'Create Purchase Order'}</h1>
        </Space>
       <div className="header-actions">
          <Button icon={<PrinterOutlined />}>Print</Button>
          <Button icon={<SaveOutlined />}>Save as Draft</Button>
          <Button type="primary" icon={<SendOutlined />} onClick={() => form.submit()}>
            Submit PO
          </Button>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          poDate: dayjs(),
          currency: 'USD',
        }}
      >
        <Row gutter={24}>
          {/* PO Details */}
          <Col xs={24} lg={16}>
            <Card style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 24 }}>Purchase Order Details</Title>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="supplier"
                    label="Supplier"
                    rules={[{ required: true, message: 'Please select supplier' }]}
                  >
                    <Select
                      placeholder="Select supplier"
                      options={suppliers}
                      showSearch
                      filterOption={(input, option) =>
                        option.label.toLowerCase().includes(input.toLowerCase())
                      }
                      onChange={handleSupplierChange}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="poDate" label="PO Date" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={8}>
                  <Form.Item name="expectedDate" label="Expected Delivery Date" rules={[{ required: true }]}>
                    <DatePicker style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="currency" label="Currency">
                    <Select
                      options={[
                        { value: 'USD', label: 'USD - US Dollar' },
                        { value: 'EUR', label: 'EUR - Euro' },
                        { value: 'INR', label: 'INR - Indian Rupee' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={8}>
                  <Form.Item name="paymentTerms" label="Payment Terms">
                    <Select
                      placeholder="Select terms"
                      options={[
                        { value: 'net15', label: 'Net 15' },
                        { value: 'net30', label: 'Net 30' },
                        { value: 'net45', label: 'Net 45' },
                        { value: 'net60', label: 'Net 60' },
                        { value: 'advance', label: '100% Advance' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Supplier Info */}
          <Col xs={24} lg={8}>
            <Card style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 16 }}>Supplier Information</Title>
              {selectedSupplier ? (
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="Code">{selectedSupplier.code}</Descriptions.Item>
                  <Descriptions.Item label="Contact">{selectedSupplier.contact}</Descriptions.Item>
                  <Descriptions.Item label="Phone">{selectedSupplier.phone}</Descriptions.Item>
                  <Descriptions.Item label="Address">{selectedSupplier.address}</Descriptions.Item>
                  <Descriptions.Item label="Payment Terms">{selectedSupplier.paymentTerms}</Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">Select a supplier to view details</Text>
              )}
            </Card>
          </Col>
        </Row>

        {/* Line Items */}
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>Line Items</Title>
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddLine}>
              Add Item
            </Button>
          </div>
          <Table
            columns={lineColumns}
            dataSource={lineItems}
            pagination={false}
            scroll={{ x: 1200 }}
            size="middle"
          />
        </Card>

        {/* Summary */}
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Card>
              <Title level={5} style={{ marginBottom: 16 }}>Additional Information</Title>
              <Form.Item name="deliveryAddress" label="Delivery Address">
                <TextArea rows={2} placeholder="Enter delivery address" />
              </Form.Item>
              <Form.Item name="remarks" label="Remarks / Special Instructions">
                <TextArea rows={2} placeholder="Any special instructions for supplier" />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Title level={5} style={{ marginBottom: 16 }}>Order Summary</Title>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Subtotal:</Text>
                  <Text strong>${getSubtotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Total Discount:</Text>
                  <Text style={{ color: '#ef4444' }}>- ${getTotalDiscount().toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Total Tax:</Text>
                  <Text>${getTotalTax().toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text strong style={{ fontSize: 18 }}>Grand Total:</Text>
                  <Text strong style={{ fontSize: 24, color: '#6366f1' }}>
                    ${getTotalAmount().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default POForm;
