import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App,
  Table,
  Card,
  Space,
  Typography,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchOrders, deleteOrder, getOrderById } from '../../services/orders/orderService';
import { hasPermission } from '../../utils/permissions';
import { getStatusLabel, EDITABLE_STATUSES, DELETABLE_STATUSES } from '../../utils/orderConstants';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import StatusTag from '../../components/StatusTag';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import RecordLink from '../../components/RecordLink';
import SampleOrderTag from '../../components/SampleOrderTag';
import CurrencyDisplay from '../../components/CurrencyDisplay';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { ORDER_STATUS_CONFIG } from '../../utils/statusConfig';
import { getTablePagination } from '../../utils/paginationConfig';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import OrderView from './OrderView';

const { Text } = Typography;

const OrderList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [orderTypeFilter, setOrderTypeFilter] = useState(undefined);
  const [orderDateRange, setOrderDateRange] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  // View modal state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);

  // Handle deep link from push notification (?viewId=X&action=approve)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const viewId = searchParams.get('viewId');
    const action = searchParams.get('action');
    if (viewId) {
      if (action) setPendingAction(action);
      searchParams.delete('viewId');
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      // OrderView needs the full order object — fetch by ID
      getOrderById(parseInt(viewId))
        .then((orderData) => {
          setViewingOrder(orderData);
          setViewModalVisible(true);
        })
        .catch(() => message.error('Failed to load order'));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (orderTypeFilter) params.orderType = orderTypeFilter;
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
    [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter, orderTypeFilter, orderDateRange]
  );

  // Re-fetch on filter change
  useEffect(() => {
    fetchData(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, orderTypeFilter, orderDateRange]);

  // Table change (pagination, sorting)
  const handleTableChange = (pag, _filters, sorter) => {
    const newSort = sorter.field || sortField;
    const newDirection = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(newSort);
    setSortDirection(newDirection);
    fetchData(pag.current, pag.pageSize, newSort, newDirection);
  };

  // Delete
  const handleDelete = useCallback(async (record) => {
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
  }, [fetchData, pagination.current, pagination.pageSize]);

  // View
  const handleView = useCallback((record) => {
    setViewingOrder(record);
    setViewModalVisible(true);
  }, []);

  const handleStatusActionComplete = () => {
    setViewModalVisible(false);
    setViewingOrder(null);
    fetchData(pagination.current, pagination.pageSize);
  };

  const columns = useMemo(() => [
    {
      title: 'Order No',
      dataIndex: 'orderNo',
      key: 'orderNo',
      fixed: 'left',
      width: 150,
      sorter: true,
      render: (text, record) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <RecordLink text={text} onClick={() => handleView(record)} />
          {record.orderType === 'SAMPLE' && <SampleOrderTag />}
        </span>
      ),
    },
    {
      title: 'Order Date',
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 120,
      sorter: true,
      render: (date) => formatDate(date),
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
        <CurrencyDisplay amount={amount} currency={record.currency} />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status) => (
        <StatusTag status={status} config={ORDER_STATUS_CONFIG} getLabel={getStatusLabel} />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          {canView && (
            <ActionButton
              action="view"
              size="small"
              onClick={() => handleView(record)}
            />
          )}
          {EDITABLE_STATUSES.includes(record.status) && canUpdate && (
            <ActionButton
              action="edit"
              size="small"
              onClick={() => navigate(`/orders/edit/${record.id}`, { state: { orderData: record } })}
            />
          )}
          {DELETABLE_STATUSES.includes(record.status) && canDelete && (
            <DeleteConfirm
              title="Delete Order"
              recordLabel={record.orderNo}
              onConfirm={() => handleDelete(record)}
              loading={deletingId === record.id}
            >
              <ActionButton
                action="delete"
                size="small"
              />
            </DeleteConfirm>
          )}
        </Space>
      ),
    },
  ], [handleView, handleDelete, navigate, deletingId, canView, canUpdate, canDelete]);

  // Status filter options
  const statusOptions = useMemo(() =>
    Object.keys(ORDER_STATUS_CONFIG).map((s) => ({
      label: getStatusLabel(s),
      value: s,
    })),
    []
  );

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Order Management">
        {canAdd && (
          <ActionButton
            action="create"
            text="New Order"
            onClick={() => navigate('/orders/new')}
          />
        )}
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search order no, buyer, style..."
          filters={[
            {
              type: 'select',
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
              props: {
                placeholder: 'Status',
                value: statusFilter,
                onChange: setStatusFilter,
                options: statusOptions,
              },
            },
            {
              type: 'select',
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
              props: {
                placeholder: 'Type',
                value: orderTypeFilter,
                onChange: setOrderTypeFilter,
                options: [
                  { label: 'Bulk', value: 'BULK' },
                  { label: 'Sample', value: 'SAMPLE' },
                ],
              },
            },
            {
              type: 'rangePicker',
              span: { xs: 24, sm: 12, md: 6, lg: 5 },
              props: {
                placeholder: ['Order From', 'Order To'],
                value: orderDateRange,
                onChange: setOrderDateRange,
              },
            },
          ]}
          onRefresh={() => fetchData(pagination.current, pagination.pageSize)}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          onChange={handleTableChange}
          pagination={getTablePagination(pagination, 'orders')}
          locale={{
            emptyText: (
              <EmptyState
                title="No orders found"
                description="Try adjusting your search or filters"
              />
            ),
          }}
        />
      </Card>

      {/* Order View Modal */}
      <OrderView
        open={viewModalVisible}
        orderData={viewingOrder}
        pendingAction={pendingAction}
        onClose={() => {
          setViewModalVisible(false);
          setViewingOrder(null);
          setPendingAction(null);
        }}
        onStatusChange={handleStatusActionComplete}
      />
    </div>
  );
};

export default OrderList;
