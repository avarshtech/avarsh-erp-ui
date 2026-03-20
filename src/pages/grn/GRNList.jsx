import { useState } from 'react';
import { Table, Card, Button, Space, Input, Tag, Dropdown, DatePicker, Select, Typography, Modal, message, Row, Col, Statistic, Timeline } from 'antd';
import { PlusOutlined, SearchOutlined, FilterOutlined, ExportOutlined, EyeOutlined, EditOutlined, MoreOutlined, PrinterOutlined, CheckCircleOutlined, InboxOutlined, TruckOutlined, FileSearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const GRNList = () => {
  const navigate = useNavigate();
  const [loading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [viewModal, setViewModal] = useState({ open: false, record: null });

  const grnData = [
    { key: '1', grnNumber: 'GRN-2024-0089', grnDate: '2024-01-28', poNumber: 'PO-2024-0152', supplier: 'Fabric World Inc', invoiceNumber: 'INV-FWI-456', items: 3, receivedQty: 2500, rejectedQty: 0, totalValue: 13750.00, status: 'Completed', warehouse: 'Main Warehouse' },
    { key: '2', grnNumber: 'GRN-2024-0090', grnDate: '2024-01-28', poNumber: 'PO-2024-0154', supplier: 'Thread Masters Ltd', invoiceNumber: 'INV-TML-789', items: 5, receivedQty: 950, rejectedQty: 50, totalValue: 2375.00, status: 'Partial Rejection', warehouse: 'Main Warehouse' },
    { key: '3', grnNumber: 'GRN-2024-0091', grnDate: '2024-01-27', poNumber: 'PO-2024-0155', supplier: 'Button Bazaar', invoiceNumber: 'INV-BB-123', items: 8, receivedQty: 4800, rejectedQty: 200, totalValue: 1680.00, status: 'Quality Check', warehouse: 'Trims Store' },
    { key: '4', grnNumber: 'GRN-2024-0092', grnDate: '2024-01-26', poNumber: 'PO-2024-0150', supplier: 'Denim Suppliers Co', invoiceNumber: 'INV-DSC-567', items: 2, receivedQty: 3000, rejectedQty: 0, totalValue: 24750.00, status: 'Completed', warehouse: 'Main Warehouse' },
  ];

  const statusConfig = {
    'Pending': { color: 'gold', icon: <InboxOutlined /> },
    'In Progress': { color: 'blue', icon: <TruckOutlined /> },
    'Quality Check': { color: 'purple', icon: <FileSearchOutlined /> },
    'Partial Rejection': { color: 'orange', icon: <InboxOutlined /> },
    'Completed': { color: 'green', icon: <CheckCircleOutlined /> },
  };

  const columns = [
    { title: 'GRN Number', dataIndex: 'grnNumber', fixed: 'left', width: 140, render: (text, record) => <Text strong style={{ color: '#6366f1', cursor: 'pointer' }} onClick={() => setViewModal({ open: true, record })}>{text}</Text> },
    { title: 'GRN Date', dataIndex: 'grnDate', width: 110 },
    { title: 'PO Number', dataIndex: 'poNumber', width: 130, render: (text) => <Text style={{ color: '#6366f1' }}>{text}</Text> },
    { title: 'Supplier', dataIndex: 'supplier', width: 170 },
    { title: 'Invoice #', dataIndex: 'invoiceNumber', width: 150 },
    { title: 'Received Qty', width: 120, align: 'center', render: (_, record) => <><Text strong style={{ color: '#22c55e' }}>{record.receivedQty.toLocaleString()}</Text>{record.rejectedQty > 0 && <><br /><Text style={{ color: '#ef4444', fontSize: 12 }}>Rej: {record.rejectedQty}</Text></>}</> },
    { title: 'Total Value', dataIndex: 'totalValue', width: 120, align: 'right', render: (v) => <Text strong style={{ color: '#10b981' }}>${v.toLocaleString()}</Text> },
    { title: 'Status', dataIndex: 'status', width: 140, fixed: 'right', render: (status) => <Tag color={statusConfig[status]?.color} icon={statusConfig[status]?.icon} style={{ borderRadius: 20 }}>{status}</Tag> },
    { title: 'Actions', fixed: 'right', width: 80, render: (_, record) => { const items = []; if (hasPermission('grn', 'view')) items.push({ key: 'view', icon: <EyeOutlined />, label: 'View' }); if (hasPermission('grn', 'update')) items.push({ key: 'edit', icon: <EditOutlined />, label: 'Edit' }); if (items.length > 0) items.push({ key: 'print', icon: <PrinterOutlined />, label: 'Print' }); if (items.length === 0) return null; return <Dropdown menu={{ items, onClick: ({ key }) => key === 'view' ? setViewModal({ open: true, record }) : key === 'edit' ? navigate(`/grn/edit/${record.key}`) : message.success('Printing...') }} trigger={['click']}><Button type="text" icon={<MoreOutlined />} /></Dropdown>; } },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1>Goods Received Notes</h1>
        <div className="header-actions">
          <Button icon={<ExportOutlined />}>Export</Button>
          <PermissionGuard module="grn" operation="add">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/grn/new')}>New GRN</Button>
          </PermissionGuard>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {[{ title: 'Total GRNs', value: 89, color: '#6366f1' }, { title: 'Pending', value: 5, color: '#f59e0b' }, { title: 'Total Value', value: 125000, prefix: '$', color: '#10b981' }, { title: 'Quality Issues', value: 8, color: '#ef4444' }].map((stat, i) => (
          <Col xs={12} sm={6} key={i}><Card size="small" hoverable><Statistic title={stat.title} value={stat.value} prefix={stat.prefix} valueStyle={{ color: stat.color, fontWeight: 600 }} /></Card></Col>
        ))}
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder="Search GRN..." prefix={<SearchOutlined />} style={{ width: 250 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select placeholder="Supplier" style={{ width: 180 }} allowClear options={[{ label: 'Fabric World Inc', value: '1' }, { label: 'Thread Masters', value: '2' }]} />
          <Select placeholder="Status" style={{ width: 150 }} allowClear options={Object.keys(statusConfig).map((s) => ({ label: s, value: s }))} />
          <RangePicker style={{ width: 280 }} />
          <Button icon={<FilterOutlined />}>More Filters</Button>
        </Space>
        <Table columns={columns} dataSource={grnData} loading={loading} scroll={{ x: 1300 }} pagination={{ pageSize: 10, showSizeChanger: true }} rowSelection={{ type: 'checkbox' }} />
      </Card>

      <Modal title={`GRN Details - ${viewModal.record?.grnNumber}`} open={viewModal.open} onCancel={() => setViewModal(prev => ({ ...prev, open: false }))} afterClose={() => setViewModal({ open: false, record: null })} footer={[<Button key="close" onClick={() => setViewModal(prev => ({ ...prev, open: false }))}>Close</Button>]} width={500} styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}>
        {viewModal.record && (
          <Row gutter={[16, 16]} style={{ padding: 16 }}>
            <Col span={12}><Text type="secondary">GRN Date:</Text><br /><Text strong>{viewModal.record.grnDate}</Text></Col>
            <Col span={12}><Text type="secondary">PO Number:</Text><br /><Text strong>{viewModal.record.poNumber}</Text></Col>
            <Col span={12}><Text type="secondary">Supplier:</Text><br /><Text strong>{viewModal.record.supplier}</Text></Col>
            <Col span={12}><Text type="secondary">Invoice:</Text><br /><Text strong>{viewModal.record.invoiceNumber}</Text></Col>
            <Col span={24}><Timeline style={{ marginTop: 16 }} items={[{ color: 'green', children: `GRN Created - ${viewModal.record.grnDate}` }, { color: 'blue', children: 'Quality Check' }, { color: 'green', children: 'Posted to Inventory' }]} /></Col>
          </Row>
        )}
      </Modal>
    </div>
  );
};

export default GRNList;
