import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  App,
  Table,
  Card,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { searchOrders, deleteOrder, getOrderById } from '../../services/orders/orderService';
import { hasPermission } from '../../utils/permissions';
import {
  getStatusLabel, EDITABLE_STATUSES, DELETABLE_STATUSES, hasDispatchDelay, getEarliestDispatchLine,
} from '../../utils/orderConstants';
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
import useServerList from '../../hooks/useServerList';
import OrderView from './OrderView';
import { useBranch } from '../../context/BranchContext';

const { Text } = Typography;

const ORDER_FILTERS = { status: undefined, orderType: undefined, orderDateRange: null };
const ORDER_LIST_OPTIONS = {
  defaultSort: { field: 'id', order: 'descend' },
  urlState: true,
  filterTypes: { orderDateRange: 'dateRange' },
};

const OrderList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  // The header switcher is the branch filter: the list follows it, "all" lifts it
  const { activeBranchId, isMultiBranch, branchName } = useBranch();
  const [deletingId, setDeletingId] = useState(null);

  // Page, sort, search and filters live in the URL, so a refresh or the way back from a form keeps them;
  // with no column sorter the list is newest first (id descending), as it always was.
  const fetchPage = useCallback(({ page, size, search, sort, direction, status, orderType, orderDateRange }) => {
    const params = { page: page - 1, size, sort, direction };
    if (search) params.search = search;
    if (status) params.status = status;
    if (orderType) params.orderType = orderType;
    if (activeBranchId) params.branchId = activeBranchId;
    if (orderDateRange && orderDateRange.length === 2) {
      params.orderDateStart = orderDateRange[0].format('YYYY-MM-DD');
      params.orderDateEnd = orderDateRange[1].format('YYYY-MM-DD');
    }
    return searchOrders(params);
  }, [activeBranchId]);
  const list = useServerList(fetchPage, ORDER_FILTERS, 'Failed to load orders', ORDER_LIST_OPTIONS);
  const { load: reload, goToFirstPage, sortOrderFor } = list;

  // The header's branch switch starts the list again from page 1
  const firstBranch = useRef(activeBranchId);
  useEffect(() => {
    if (firstBranch.current === activeBranchId) return;
    firstBranch.current = activeBranchId;
    goToFirstPage();
  }, [activeBranchId, goToFirstPage]);

  // View modal state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingOrder, setViewingOrder] = useState(null);
  // A notification's Approve/Reject, bound to the order it came for ({ action, orderId }). It is
  // used once: opening any order from the list, finishing an action or a failed load clears it,
  // so it can never act on another order the user opens afterwards.
  const [pendingAction, setPendingAction] = useState(null);

  // Handle deep link from push notification (?viewId=X&action=approve)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const viewId = searchParams.get('viewId');
    const action = searchParams.get('action');
    if (viewId) {
      const orderId = parseInt(viewId);
      if (action) setPendingAction({ action, orderId });
      searchParams.delete('viewId');
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
      // OrderView needs the full order object — fetch by ID
      getOrderById(orderId)
        .then((orderData) => {
          setViewingOrder(orderData);
          setViewModalVisible(true);
        })
        .catch(() => {
          setPendingAction(null);
          message.error('Failed to load order');
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Permissions
  const canView = hasPermission('orders', 'view');
  const canAdd = hasPermission('orders', 'add');
  const canUpdate = hasPermission('orders', 'update');
  const canDelete = hasPermission('orders', 'delete');

  // Delete
  const handleDelete = useCallback(async (record) => {
    setDeletingId(record.id);
    try {
      await deleteOrder(record.id);
      message.success(`${record.orderNo} deleted successfully`);
      reload();
    } catch {
      message.error('Failed to delete order');
    } finally {
      setDeletingId(null);
    }
  }, [reload, message]);

  // View
  const handleView = useCallback((record) => {
    setPendingAction(null);
    setViewingOrder(record);
    setViewModalVisible(true);
  }, []);

  const handleStatusActionComplete = () => {
    setPendingAction(null);
    setViewModalVisible(false);
    setViewingOrder(null);
    reload();
  };

  const columns = useMemo(() => [
    {
      title: 'Order No',
      dataIndex: 'orderNo',
      key: 'orderNo',
      fixed: 'left',
      width: 150,
      sorter: true,
      sortOrder: sortOrderFor('orderNo'),
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
      sortOrder: sortOrderFor('orderDate'),
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
    ...(isMultiBranch ? [{
      title: 'Branch',
      key: 'branches',
      width: 150,
      ellipsis: true,
      render: (_, record) => {
        const rows = (record.allocations || []).filter((a) => a.qty > 0);
        return rows.length
          ? rows.map((a) => a.branchName || branchName(a.branchId)).join(', ')
          : <Text type="secondary">Unallocated</Text>;
      },
    }] : []),
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
      sortOrder: sortOrderFor('totalOrderQty'),
      render: (qty) => <Text strong>{(qty || 0).toLocaleString('en-IN')}</Text>,
    },
    {
      title: 'Total Value',
      dataIndex: 'totalOrderValue',
      key: 'totalOrderValue',
      width: 140,
      align: 'right',
      sorter: true,
      sortOrder: sortOrderFor('totalOrderValue'),
      render: (amount, record) => (
        <CurrencyDisplay amount={amount} currency={record.currency} />
      ),
    },
    // Committed dispatch of the earliest line. Once an upstream slip (a supplier PO or a sample
    // request running late) has been applied to the order, the date it is now tracking to sits on
    // top and the original stays visible, struck through, so a revision is never mistaken for a
    // data-entry change — the same shape as the PO list. Deliberately NOT sortable: the list sorts
    // server-side by passing the column key straight into Sort.by(), and this is derived from the
    // lines with no matching entity property.
    {
      title: 'Dispatch',
      key: 'dispatch',
      width: 150,
      render: (_, record) => {
        const line = getEarliestDispatchLine(record);
        if (!line) return <Text type="secondary">—</Text>;
        if (!hasDispatchDelay(record) || !line.revisedDispatchDate) return formatDate(line.dispatchDate);
        const days = record.dispatchDelayDays;
        return (
          <Tooltip title={`Pushed +${days} day${days === 1 ? '' : 's'} by ${record.dispatchDelaySource}`}>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3, cursor: 'help' }}>
              <span style={{ whiteSpace: 'nowrap' }}>
                {formatDate(line.revisedDispatchDate)}
                <Tag color="error" style={{ marginLeft: 6, fontSize: 9, padding: '0 4px', lineHeight: '14px' }}>+{days}d</Tag>
              </span>
              <span style={{ textDecoration: 'line-through', opacity: 0.55, fontSize: 11 }}>{formatDate(line.dispatchDate)}</span>
            </div>
          </Tooltip>
        );
      },
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
  ], [handleView, handleDelete, navigate, deletingId, canView, canUpdate, canDelete, isMultiBranch, branchName, sortOrderFor]);

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
          searchText={list.searchText}
          onSearchChange={(e) => list.setSearchText(e.target.value)}
          searchPlaceholder="Search order no, buyer, style..."
          filters={[
            {
              type: 'select',
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
              props: {
                placeholder: 'Status',
                value: list.filters.status,
                onChange: list.setFilter('status'),
                options: statusOptions,
              },
            },
            {
              type: 'select',
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
              props: {
                placeholder: 'Type',
                value: list.filters.orderType,
                onChange: list.setFilter('orderType'),
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
                value: list.filters.orderDateRange,
                onChange: list.setFilter('orderDateRange'),
              },
            },
          ]}
          onRefresh={reload}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={list.rows}
          loading={list.loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          onChange={list.onTableChange}
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'orders')}
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
        pendingAction={pendingAction && pendingAction.orderId === viewingOrder?.id ? pendingAction.action : null}
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
