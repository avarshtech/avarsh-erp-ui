import { useState, useEffect } from 'react';
import { Form, Input, Select, DatePicker, InputNumber, Button, Card, Row, Col, Table, Space, Typography, message, Popconfirm, Descriptions, Tag, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined, ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

const GRNForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [selectedPO, setSelectedPO] = useState(null);
  const [lineItems, setLineItems] = useState([]);

  const purchaseOrders = [
    { value: 'PO-2024-0156', label: 'PO-2024-0156 - Fabric World Inc', supplier: 'Fabric World Inc', items: [
      { key: '1', itemCode: 'cotton-40s', description: 'Cotton Fabric 40s', uom: 'meters', orderedQty: 1000, pendingQty: 1000, unitPrice: 5.50 },
      { key: '2', itemCode: 'cotton-60s', description: 'Cotton Fabric 60s', uom: 'meters', orderedQty: 500, pendingQty: 500, unitPrice: 7.25 },
    ]},
    { value: 'PO-2024-0157', label: 'PO-2024-0157 - Thread Masters Ltd', supplier: 'Thread Masters Ltd', items: [
      { key: '1', itemCode: 'thread-white', description: 'White Thread - 5000m', uom: 'cones', orderedQty: 200, pendingQty: 200, unitPrice: 2.50 },
      { key: '2', itemCode: 'thread-black', description: 'Black Thread - 5000m', uom: 'cones', orderedQty: 150, pendingQty: 150, unitPrice: 2.50 },
    ]},
  ];

  const warehouses = [
    { value: 'main', label: 'Main Warehouse' },
    { value: 'trims', label: 'Trims Store' },
    { value: 'fabric', label: 'Fabric Store' },
  ];

  const handlePOChange = (value) => {
    const po = purchaseOrders.find(p => p.value === value);
    setSelectedPO(po);
    if (po) {
      setLineItems(po.items.map(item => ({
        ...item,
        receivedQty: 0,
        acceptedQty: 0,
        rejectedQty: 0,
        amount: 0,
      })));
    }
  };

  const handleLineChange = (key, field, value) => {
    setLineItems(lineItems.map(item => {
      if (item.key === key) {
        const updated = { ...item, [field]: value };
        if (field === 'receivedQty' || field === 'rejectedQty') {
          updated.acceptedQty = Math.max(0, (updated.receivedQty || 0) - (updated.rejectedQty || 0));
          updated.amount = updated.acceptedQty * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const getTotalReceived = () => lineItems.reduce((sum, item) => sum + (item.receivedQty || 0), 0);
  const getTotalAccepted = () => lineItems.reduce((sum, item) => sum + (item.acceptedQty || 0), 0);
  const getTotalRejected = () => lineItems.reduce((sum, item) => sum + (item.rejectedQty || 0), 0);
  const getTotalAmount = () => lineItems.reduce((sum, item) => sum + (item.amount || 0), 0);

  const columns = [
    { title: '#', width: 50, render: (_, __, i) => i + 1 },
    { title: 'Item', dataIndex: 'description', width: 200 },
    { title: 'UOM', dataIndex: 'uom', width: 80 },
    { title: 'Ordered', dataIndex: 'orderedQty', width: 90, align: 'center' },
    { title: 'Pending', dataIndex: 'pendingQty', width: 90, align: 'center', render: (v) => <Tag color="blue">{v}</Tag> },
    { title: 'Received', dataIndex: 'receivedQty', width: 100, render: (v, record) => <InputNumber min={0} max={record.pendingQty} style={{ width: '100%' }} value={v} onChange={(val) => handleLineChange(record.key, 'receivedQty', val)} /> },
    { title: 'Rejected', dataIndex: 'rejectedQty', width: 100, render: (v, record) => <InputNumber min={0} max={record.receivedQty} style={{ width: '100%' }} value={v} onChange={(val) => handleLineChange(record.key, 'rejectedQty', val)} /> },
    { title: 'Accepted', dataIndex: 'acceptedQty', width: 90, align: 'center', render: (v) => <Text strong style={{ color: '#22c55e' }}>{v}</Text> },
    { title: 'Rate', dataIndex: 'unitPrice', width: 80, render: (v) => `$${v.toFixed(2)}` },
    { title: 'Amount', dataIndex: 'amount', width: 100, render: (v) => <Text strong style={{ color: '#10b981' }}>${v.toFixed(2)}</Text> },
  ];

  const handleSubmit = (values) => {
    const grnData = { ...values, poNumber: selectedPO?.value, supplier: selectedPO?.supplier, lineItems, totalReceived: getTotalReceived(), totalAccepted: getTotalAccepted(), totalRejected: getTotalRejected(), totalAmount: getTotalAmount() };
    console.log('GRN Data:', grnData);
    message.success('GRN created successfully!');
    navigate('/grn/list');
  };

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <Space><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/grn/list')} /><h1>{id ? 'Edit GRN' : 'Create Goods Received Note'}</h1></Space>
        <div className="header-actions">
          <Button icon={<SaveOutlined />}>Save as Draft</Button>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => form.submit()}>Post GRN</Button>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ grnDate: dayjs() }}>
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Card style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 24 }}>GRN Details</Title>
              <Row gutter={24}>
                <Col xs={24} md={12}><Form.Item name="poNumber" label="Purchase Order" rules={[{ required: true }]}><Select placeholder="Select PO" options={purchaseOrders} onChange={handlePOChange} showSearch /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="grnDate" label="GRN Date" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}><Form.Item name="invoiceNumber" label="Supplier Invoice Number" rules={[{ required: true }]}><Input placeholder="Enter invoice number" /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="invoiceDate" label="Invoice Date"><DatePicker style={{ width: '100%' }} /></Form.Item></Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}><Form.Item name="warehouse" label="Receiving Warehouse" rules={[{ required: true }]}><Select placeholder="Select warehouse" options={warehouses} /></Form.Item></Col>
                <Col xs={24} md={12}><Form.Item name="vehicleNumber" label="Vehicle Number"><Input placeholder="e.g., MH-12-AB-1234" /></Form.Item></Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 16 }}>PO Information</Title>
              {selectedPO ? (
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="PO Number">{selectedPO.value}</Descriptions.Item>
                  <Descriptions.Item label="Supplier">{selectedPO.supplier}</Descriptions.Item>
                  <Descriptions.Item label="Items">{selectedPO.items.length}</Descriptions.Item>
                </Descriptions>
              ) : <Text type="secondary">Select a PO to view details</Text>}
            </Card>
          </Col>
        </Row>

        {lineItems.length > 0 && (
          <Card style={{ marginBottom: 24 }}>
            <Title level={5} style={{ marginBottom: 16 }}>Receive Items</Title>
            {getTotalRejected() > 0 && <Alert message={`${getTotalRejected()} items marked as rejected. Please ensure quality inspection notes are added.`} type="warning" showIcon style={{ marginBottom: 16 }} />}
            <Table columns={columns} dataSource={lineItems} pagination={false} scroll={{ x: 1000 }} size="middle" summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row style={{ background: '#f8fafc' }}>
                  <Table.Summary.Cell index={0} colSpan={5}><Text strong>Totals</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center"><Text strong>{getTotalReceived()}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="center"><Text strong style={{ color: '#ef4444' }}>{getTotalRejected()}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="center"><Text strong style={{ color: '#22c55e' }}>{getTotalAccepted()}</Text></Table.Summary.Cell>
                  <Table.Summary.Cell index={4}></Table.Summary.Cell>
                  <Table.Summary.Cell index={5}><Text strong style={{ color: '#10b981' }}>${getTotalAmount().toFixed(2)}</Text></Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )} />
          </Card>
        )}

        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>Additional Notes</Title>
          <Form.Item name="remarks"><TextArea rows={3} placeholder="Quality remarks, rejection reasons, or any special notes" /></Form.Item>
        </Card>
      </Form>
    </div>
  );
};

export default GRNForm;
