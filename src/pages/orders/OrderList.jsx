import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Card,
  Button,
  Space,
  Input,
  Tag,
  Select,
  Typography,
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
  FileTextOutlined,
  ClockCircleOutlined,
  UndoOutlined,
  ReloadOutlined,
  StopOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { searchOrders, deleteOrder } from '../../services/orderService';
import { hasPermission } from '../../utils/permissions';
import { ORDER_STATUS, getStatusLabel, EDITABLE_STATUSES, DELETABLE_STATUSES, getCurrencySymbol } from '../../utils/orderConstants';
import OrderView from './OrderView';

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Status config mapping
const STATUS_CONFIG = {
  [ORDER_STATUS.DRAFT]: { color: 'default', icon: <FileTextOutlined /> },
  [ORDER_STATUS.CONFIRMED]: { color: 'green', icon: <CheckCircleOutlined /> },
  [ORDER_STATUS.REFERRED_BACK]: { color: 'orange', icon: <UndoOutlined /> },
  [ORDER_STATUS.IN_PRODUCTION]: { color: 'blue', icon: <ClockCircleOutlined /> },
  [ORDER_STATUS.COMPLETED]: { color: 'cyan', icon: <CheckCircleOutlined /> },
  [ORDER_STATUS.CANCELLED]: { color: 'volcano', icon: <StopOutlined /> },
};

const OrderList = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [navigatingId, setNavigatingId] = useState(null);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [orderDateRange, setOrderDateRange] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  // View modal state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);

  // Permissions
  const canView = hasPermission('orders', 'view');
  const canAdd = hasPermission('orders', 'add');
  const canUpdate = hasPermission('orders', 'update');
  const canDelete = hasPermission('orders', 'delete');

  // Fetch data
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
        if (debouncedSearch) params.search = debouncedSearch;
        if (statusFilter) params.status = statusFilter;
        if (orderDateRange && orderDateRange.length === 2) {
          params.orderDateStart = orderDateRange[0].format('YYYY-MM-DD');
          params.orderDateEnd = orderDateRange[1].format('YYYY-MM-DD');
        }

        const response = await searchOrders(params);
        setData(response.content || []);
        setPagination((prev) => ({
          ...prev,
          current: page || prev.current,
          pageSize: pageSize || prev.pageSize,
          total: response.totalElements || 0,
        }));
      } catch {
        message.error('Failed to load orders');
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter, orderDateRange]
  );

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Re-fetch on filter change
  useEffect(() => {
    fetchData(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, orderDateRange]);

  // Table change (pagination, sorting)
  const handleTableChange = (pag, _filters, sorter) => {
    const newSort = sorter.field || sortField;
    const newDirection = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(newSort);
    setSortDirection(newDirection);
    fetchData(pag.current, pag.pageSize, newSort, newDirection);
  };

  // Delete
  const handleDelete = async (record) => {
    setDeletingId(record.id);
    try {
      await deleteOrder(record.id);
      message.success(`${record.orderNo} deleted successfully`);
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error('Failed to delete order');
    } finally {
      setDeletingId(null);
    }
  };

  // View
  const handleView = (record) => {
    setViewingOrder(record);
    setViewModalVisible(true);
  };

  const handleStatusActionComplete = () => {
    setViewModalVisible(false);
    setViewingOrder(null);
    fetchData(pagination.current, pagination.pageSize);
  };

  // Format currency
  const formatCurrency = (amount, currency) => {
    if (amount === null || amount === undefined) return `${getCurrencySymbol(currency)} 0.00`;
    return `${getCurrencySymbol(currency)} ${Number(amount).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Can edit?
  const canEditOrder = (record) =>
    EDITABLE_STATUSES.includes(record.status) && canUpdate;

  // Can delete?
  const canDeleteOrder = (record) =>
    DELETABLE_STATUSES.includes(record.status) && canDelete;

  const columns = [
    {
      title: 'Order No',
      dataIndex: 'orderNo',
      key: 'orderNo',
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
      title: 'Order Date',
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 120,
      sorter: true,
      render: (date) => (date ? dayjs(date).format('DD-MMM-YYYY') : '-'),
    },
    {
      title: 'Buyer',
      dataIndex: 'buyerName',
      key: 'buyerName',
      width: 200,
      ellipsis: true,
      render: (text) => <Text strong>{text || '-'}</Text>,
    },
    {
      title: 'Lines',
      key: 'lineCount',
      width: 70,
      align: 'center',
      render: (_, record) => (record.orderLines?.length || 0),
    },
    {
      title: 'Total Qty',
      dataIndex: 'totalOrderQty',
      key: 'totalOrderQty',
      width: 100,
      align: 'right',
      sorter: true,
      render: (qty) => <Text strong>{(qty || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Total Value',
      dataIndex: 'totalOrderValue',
      key: 'totalOrderValue',
      width: 140,
      align: 'right',
      sorter: true,
      render: (amount, record) => (
        <Text strong style={{ color: 'var(--success-color)' }}>
          {formatCurrency(amount, record.currency)}
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
          {canEditOrder(record) && (
            <Tooltip title="Edit">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                loading={navigatingId === record.id}
                onClick={() => {
                  setNavigatingId(record.id);
                  navigate(`/orders/edit/${record.id}`, { state: { orderData: record } });
                }}
                style={{ color: '#52c41a' }}
              />
            </Tooltip>
          )}
          {canDeleteOrder(record) && (
            <Popconfirm
              title="Delete Order"
              description={`Are you sure you want to delete "${record.orderNo}"?`}
              onConfirm={() => handleDelete(record)}
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
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <h1>Order Management</h1>
        <div className="header-actions">
          {canAdd && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/orders/new')}
            >
              New Order
            </Button>
          )}
        </div>
      </div>

      <Card>
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }} align="middle">
          <Col xs={24} sm={12} md={6} lg={5}>
            <Input
              placeholder="Search order no, buyer, style..."
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
              onChange={setStatusFilter}
              options={Object.keys(STATUS_CONFIG).map((s) => ({
                label: getStatusLabel(s),
                value: s,
              }))}
            />
          </Col>
          <Col xs={24} sm={12} md={6} lg={5}>
            <RangePicker
              style={{ width: '100%' }}
              placeholder={['Order From', 'Order To']}
              value={orderDateRange}
              onChange={setOrderDateRange}
            />
          </Col>
          <Col>
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
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} orders`,
          }}
        />
      </Card>

      {/* Order View Modal */}
      <OrderView
        open={viewModalVisible}
        orderData={viewingOrder}
        onClose={() => {
          setViewModalVisible(false);
          setViewingOrder(null);
        }}
        onStatusChange={handleStatusActionComplete}
      />
    </div>
  );
};

export default OrderList;
