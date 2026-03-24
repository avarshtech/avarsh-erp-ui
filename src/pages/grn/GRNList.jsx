import { useState } from 'react';
import { Table, Card, Space, Input, DatePicker, Select, Typography, Modal, message, Row, Col } from 'antd';
import { FilterOutlined, ExportOutlined, SearchOutlined, CheckCircleOutlined, InboxOutlined, TruckOutlined, FileSearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import { ActionButton } from '../../components/buttons';
import PageHeader from '../../components/PageHeader';
import RecordLink from '../../components/RecordLink';
import CurrencyDisplay from '../../components/CurrencyDisplay';
import StatusTag from '../../components/StatusTag';
import EmptyState from '../../components/EmptyState';
import StatCard from '../../components/StatCard';
import { formatNumber } from '../../utils/formatters';
import { getTablePagination } from '../../utils/paginationConfig';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const GRN_LIST_STATUS_CONFIG = {
  'Pending': { color: 'gold', icon: InboxOutlined },
  'In Progress': { color: 'blue', icon: TruckOutlined },
  'Quality Check': { color: 'purple', icon: FileSearchOutlined },
  'Partial Rejection': { color: 'orange', icon: InboxOutlined },
  'Completed': { color: 'green', icon: CheckCircleOutlined },
};

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

  const columns = [
    { title: 'GRN Number', dataIndex: 'grnNumber', fixed: 'left', width: 140, render: (text, record) => <RecordLink text={text} onClick={() => setViewModal({ open: true, record })} /> },
    { title: 'GRN Date', dataIndex: 'grnDate', width: 110 },
    { title: 'PO Number', dataIndex: 'poNumber', width: 130, render: (text) => <Text style={{ color: 'var(--primary-color)' }}>{text}</Text> },
    { title: 'Supplier', dataIndex: 'supplier', width: 170 },
    { title: 'Invoice #', dataIndex: 'invoiceNumber', width: 150 },
    { title: 'Received Qty', width: 120, align: 'center', render: (_, record) => <><Text strong style={{ color: 'var(--success-color)' }}>{formatNumber(record.receivedQty)}</Text>{record.rejectedQty > 0 && <><br /><Text style={{ color: 'var(--error-color)', fontSize: 12 }}>Rej: {record.rejectedQty}</Text></>}</> },
    { title: 'Total Value', dataIndex: 'totalValue', width: 120, align: 'right', render: (v) => <CurrencyDisplay amount={v} currency="USD" /> },
    { title: 'Status', dataIndex: 'status', width: 140, fixed: 'right', render: (status) => <StatusTag status={status} config={GRN_LIST_STATUS_CONFIG} /> },
    { title: 'Actions', fixed: 'right', width: 100, render: (_, record) => (
      <Space size="small">
        {hasPermission('grn', 'view') && (
          <ActionButton action="view" onClick={() => setViewModal({ open: true, record })} />
        )}
        {hasPermission('grn', 'update') && (
          <ActionButton action="edit" onClick={() => navigate(`/grn/edit/${record.key}`)} />
        )}
        {(hasPermission('grn', 'view') || hasPermission('grn', 'update')) && (
          <ActionButton action="print" onClick={() => message.success('Printing...')} />
        )}
      </Space>
    ) },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Goods Received Notes">
        <ActionButton action="custom" text="Export" icon={<ExportOutlined />} />
        <PermissionGuard module="grn" operation="add">
          <ActionButton action="create" text="New GRN" onClick={() => navigate('/grn/new')} />
        </PermissionGuard>
      </PageHeader>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard title="Total GRNs" value={89} color="var(--primary-color)" icon={<InboxOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="Pending" value={5} color="var(--warning-color)" icon={<TruckOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="Total Value" value={125000} prefix="$" color="var(--success-color)" icon={<CheckCircleOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="Quality Issues" value={8} color="var(--error-color)" icon={<FileSearchOutlined />} />
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder="Search GRN..." prefix={<SearchOutlined />} style={{ width: 250 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select placeholder="Supplier" style={{ width: 180 }} allowClear options={[{ label: 'Fabric World Inc', value: '1' }, { label: 'Thread Masters', value: '2' }]} />
          <Select placeholder="Status" style={{ width: 150 }} allowClear options={Object.keys(GRN_LIST_STATUS_CONFIG).map((s) => ({ label: s, value: s }))} />
          <RangePicker style={{ width: 280 }} />
          <ActionButton action="custom" text="More Filters" icon={<FilterOutlined />} />
        </Space>
        <Table
          columns={columns}
          dataSource={grnData}
          loading={loading}
          scroll={{ x: 1300 }}
          pagination={getTablePagination({ pageSize: 10 }, 'GRNs')}
          rowSelection={{ type: 'checkbox' }}
          locale={{
            emptyText: <EmptyState title="No GRNs found" description="Create a new GRN to get started" />,
          }}
        />
      </Card>

      <Modal title={`GRN Details - ${viewModal.record?.grnNumber}`} open={viewModal.open} onCancel={() => setViewModal(prev => ({ ...prev, open: false }))} afterClose={() => setViewModal({ open: false, record: null })} footer={[<ActionButton key="close" action="close" text="Close" onClick={() => setViewModal(prev => ({ ...prev, open: false }))} />]} width={500} styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}>
        {viewModal.record && (
          <Row gutter={[16, 16]} style={{ padding: 16 }}>
            <Col span={12}><Text type="secondary">GRN Date:</Text><br /><Text strong>{viewModal.record.grnDate}</Text></Col>
            <Col span={12}><Text type="secondary">PO Number:</Text><br /><Text strong>{viewModal.record.poNumber}</Text></Col>
            <Col span={12}><Text type="secondary">Supplier:</Text><br /><Text strong>{viewModal.record.supplier}</Text></Col>
            <Col span={12}><Text type="secondary">Invoice:</Text><br /><Text strong>{viewModal.record.invoiceNumber}</Text></Col>
          </Row>
        )}
      </Modal>
    </div>
  );
};

export default GRNList;
