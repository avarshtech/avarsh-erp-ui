import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Input,
  Tag,
  Select,
  Typography,
  Modal,
  message,
  Row,
  Col,
  Tooltip,
  Popconfirm,
  DatePicker,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  UndoOutlined,
  ReloadOutlined,
  StopOutlined,
  SendOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  searchPurchaseOrders,
  deletePurchaseOrder,
} from '../../services/purchaseOrderService';
import { hasPermission } from '../../utils/permissions';
import { PO_STATUS, getStatusLabel } from '../../utils/poStatusConstants';
import POView from './POView';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Format currency — pure function, defined outside component
const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return '₹ 0.00';
  return `₹ ${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// Status config mapping — keys are DB enum values
const STATUS_CONFIG = {
  [PO_STATUS.DRAFT]: { color: 'default', icon: <FileTextOutlined /> },
  [PO_STATUS.PENDING_APPROVAL]: { color: 'gold', icon: <ClockCircleOutlined /> },
  [PO_STATUS.APPROVED]: { color: 'blue', icon: <CheckCircleOutlined /> },
  [PO_STATUS.REJECTED]: { color: 'red', icon: <CloseCircleOutlined /> },
  [PO_STATUS.IN_PROGRESS]: { color: 'cyan', icon: <ClockCircleOutlined /> },
  [PO_STATUS.CANCELLED]: { color: 'volcano', icon: <StopOutlined /> },
  [PO_STATUS.REFERRED_BACK]: { color: 'orange', icon: <UndoOutlined /> },
  [PO_STATUS.PARTIALLY_RECEIVED]: { color: 'purple', icon: <InboxOutlined /> },
  [PO_STATUS.SENT_TO_SUPPLIER]: { color: 'magenta', icon: <SendOutlined /> },
  [PO_STATUS.COMPLETED]: { color: 'green', icon: <CheckCircleOutlined /> },
};

const POList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [poTypeFilter, setPoTypeFilter] = useState(null);
  const [poDateRange, setPoDateRange] = useState(null);
  const [deliveryDateRange, setDeliveryDateRange] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  // Delete loading state
  const [deletingId, setDeletingId] = useState(null);

  // View modal state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingPO, setViewingPO] = useState(null);

  // Permissions
  const canView = hasPermission('purchase-orders', 'view');
  const canUpdate = hasPermission('purchase-orders', 'update');
  const canDelete = hasPermission('purchase-orders', 'delete');

  // Fetch data using search API
  const fetchData = useCallback(
    async (page, pageSize, sort, direction) => {
      setLoading(true);
      try {
        const params = {
          page: (page || pagination.current) - 1,
          size: pageSize || pagination.pageSize,
          sort: sort || sortField,
          direction: direction || sortDirection,
        };

        // Add search text
        if (debouncedSearch) params.search = debouncedSearch;

        // Add status filter
        if (statusFilter) params.status = statusFilter;

        // Add PO type filter
        if (poTypeFilter) params.poType = poTypeFilter;

        // Add PO date range
        if (poDateRange && poDateRange.length === 2) {
          params.poDateStart = poDateRange[0].format('YYYY-MM-DD');
          params.poDateEnd = poDateRange[1].format('YYYY-MM-DD');
        }

        // Add delivery date range
        if (deliveryDateRange && deliveryDateRange.length === 2) {
          params.deliveryDateStart = deliveryDateRange[0].format('YYYY-MM-DD');
          params.deliveryDateEnd = deliveryDateRange[1].format('YYYY-MM-DD');
        }

        const response = await searchPurchaseOrders(params);
        setData(response.content || []);
        setPagination((prev) => ({
          ...prev,
          current: page || prev.current,
          pageSize: pageSize || prev.pageSize,
          total: response.totalElements || 0,
        }));
      } catch {
        message.error('Failed to load purchase orders');
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter, poTypeFilter, poDateRange, deliveryDateRange]
  );

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Re-fetch when any filter (including debounced search) changes
  useEffect(() => {
    fetchData(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, poTypeFilter, poDateRange, deliveryDateRange]);

  // Handle table change (pagination, sorting)
  const handleTableChange = (pag, _filters, sorter) => {
    const newSort = sorter.field || sortField;
    const newDirection = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(newSort);
    setSortDirection(newDirection);
    fetchData(pag.current, pag.pageSize, newSort, newDirection);
  };

  // Filter change handlers — just update state; useEffect triggers fetch
  const handleStatusFilter = (value) => setStatusFilter(value);
  const handlePoDateRangeChange = (dates) => setPoDateRange(dates);
  const handleDeliveryDateRangeChange = (dates) => setDeliveryDateRange(dates);

  // Delete PO
  const handleDelete = (record) => {
    Modal.confirm({
      title: 'Delete Purchase Order',
      icon: <ExclamationCircleOutlined />,
      content: `Are you sure you want to delete ${record.poNumber}? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deletePurchaseOrder(record.id);
          message.success(`${record.poNumber} deleted successfully`);
          fetchData(pagination.current, pagination.pageSize);
        } catch {
          message.error('Failed to delete purchase order');
        }
      },
    });
  };

  // View PO
  const handleView = useCallback((record) => {
    setViewingPO(record);
    setViewModalVisible(true);
  }, []);

  // After status action in view, refresh list
  const handleStatusActionComplete = () => {
    setViewModalVisible(false);
    setViewingPO(null);
    fetchData(pagination.current, pagination.pageSize);
  };

  const columns = useMemo(() => [
    {
      title: 'PO Number',
      dataIndex: 'poNumber',
      key: 'poNumber',
      fixed: 'left',
      width: 150,
      sorter: true,
      render: (text, record) => (
        <Text
          strong
          style={{ color: 'var(--primary-color)', cursor: 'pointer' }}
          onClick={() => handleView(record)}
        >
          {text}
        </Text>
      ),
    },
    {
      title: 'PO Date',
      dataIndex: 'poDate',
      key: 'poDate',
      width: 120,
      sorter: true,
      render: (date) => (date ? dayjs(date).format('DD-MMM-YYYY') : '-'),
    },
    {
      title: 'Supplier',
      dataIndex: 'supplierName',
      key: 'supplierName',
      width: 200,
      ellipsis: true,
      render: (text) => <Text strong>{text || '-'}</Text>,
    },
    {
      title: 'PO Type',
      dataIndex: 'poType',
      key: 'poType',
      width: 110,
      render: (type) => {
        const colorMap = { General: 'default', Regular: 'blue', Combined: 'purple' };
        return <Tag color={colorMap[type] || 'default'}>{type || 'General'}</Tag>;
      },
    },
    {
      title: 'Delivery Date',
      dataIndex: 'deliveryDate',
      key: 'deliveryDate',
      width: 120,
      sorter: true,
      render: (date) => (date ? dayjs(date).format('DD-MMM-YYYY') : '-'),
    },
    {
      title: 'Items',
      key: 'itemCount',
      width: 70,
      align: 'center',
      render: (_, record) => (record.lineItems?.length || 0),
    },
    {
      title: 'Grand Total',
      dataIndex: 'grandTotal',
      key: 'grandTotal',
      width: 140,
      align: 'right',
      sorter: true,
      render: (amount) => (
        <Text strong style={{ color: 'var(--success-color)' }}>
          {formatCurrency(amount)}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status) => {
        const config = STATUS_CONFIG[status] || {};
        return (
          <Tag
            color={config.color || 'default'}
            icon={config.icon}
            style={{ borderRadius: 20 }}
          >
            {getStatusLabel(status)}
          </Tag>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {canView && (
            <Tooltip title="View">
              <Button
                type="text"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => handleView(record)}
                style={{ color: '#1890ff' }}
              />
            </Tooltip>
          )}
          {(record.status === PO_STATUS.DRAFT || record.status === PO_STATUS.REFERRED_BACK || record.status === PO_STATUS.REJECTED) && canUpdate && (
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => navigate(`/purchase-orders/edit/${record.id}`)}
                style={{ color: '#52c41a' }}
              />
            </Tooltip>
          )}
          {record.status === PO_STATUS.DRAFT && canDelete && (
            <Popconfirm
              title="Delete Purchase Order"
              description={`Are you sure you want to delete "${record.poNumber}"?`}
              onConfirm={() => {
                setDeletingId(record.id);
                return deletePurchaseOrder(record.id)
                  .then(() => {
                    message.success(`${record.poNumber} deleted successfully`);
                    fetchData(pagination.current, pagination.pageSize);
                  })
                  .catch(() => message.error('Failed to delete purchase order'))
                  .finally(() => setDeletingId(null));
              }}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true, loading: deletingId === record.id }}
              icon={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
            >
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [handleView, navigate, fetchData, pagination.current, pagination.pageSize, deletingId, canView, canUpdate, canDelete]);

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1>Purchase Orders</h1>
        <div className="header-actions">
          {hasPermission('purchase-orders', 'add') && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/purchase-orders/new')}
            >
              New Purchase Order
            </Button>
          )}
        </div>
      </div>

      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} sm={12} md={6} lg={5}>
            <Input
              placeholder="Search PO number, supplier..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={8} md={4} lg={3}>
            <Select
              placeholder="Status"
              style={{ width: '100%' }}
              allowClear
              value={statusFilter}
              onChange={handleStatusFilter}
              options={Object.keys(STATUS_CONFIG).map((s) => ({
                label: getStatusLabel(s),
                value: s,
              }))}
            />
          </Col>
          <Col xs={12} sm={8} md={4} lg={3}>
            <Select
              placeholder="PO Type"
              style={{ width: '100%' }}
              allowClear
              value={poTypeFilter}
              onChange={(val) => setPoTypeFilter(val)}
              options={[
                { value: 'General', label: 'General' },
                { value: 'Regular', label: 'Regular' },
                { value: 'Combined', label: 'Combined' },
              ]}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <RangePicker
              placeholder={['PO Date From', 'PO Date To']}
              value={poDateRange}
              onChange={handlePoDateRangeChange}
              format="DD-MMM-YYYY"
              style={{ width: '100%', height: '40px' }}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <RangePicker
              placeholder={['Delivery From', 'Delivery To']}
              value={deliveryDateRange}
              onChange={handleDeliveryDateRangeChange}
              format="DD-MMM-YYYY"
              style={{ width: '100%', height: '40px' }}
              allowClear
            />
          </Col>
          <Col flex="auto" style={{ textAlign: 'right' }}>
            <Tooltip title="Refresh">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => fetchData(pagination.current, pagination.pageSize)}
              />
            </Tooltip>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          onChange={handleTableChange}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} purchase orders`,
          }}
        />
      </Card>

      {/* PO View Modal */}
      <POView
        open={viewModalVisible}
        poData={viewingPO}
        onClose={() => {
          setViewModalVisible(false);
          setViewingPO(null);
        }}
        onStatusChange={handleStatusActionComplete}
        onRefresh={() => fetchData(pagination.current, pagination.pageSize)}
      />
    </div>
  );
};

export default POList;
