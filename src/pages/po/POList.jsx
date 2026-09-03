import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Card,
  Tag,
  Typography,
  App,
  Space,
} from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  searchPurchaseOrders,
  deletePurchaseOrder,
} from '../../services/po/purchaseOrderService';
import { hasPermission } from '../../utils/permissions';
import { PO_STATUS, getStatusLabel } from '../../utils/poStatusConstants';
import { PO_STATUS_CONFIG } from '../../utils/statusConfig';
import { formatDate } from '../../utils/formatters';
import { getTablePagination } from '../../utils/paginationConfig';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import StatusTag from '../../components/StatusTag';
import RecordLink from '../../components/RecordLink';
import CurrencyDisplay from '../../components/CurrencyDisplay';
import EmptyState from '../../components/EmptyState';
import POView from './POView';
import POVersionHistory from './POVersionHistory';

const { Text } = Typography;

const POList = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
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
  const [pendingAction, setPendingAction] = useState(null);

  // Handle deep link from push notification (?viewId=X&action=approve)
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const viewId = searchParams.get('viewId');
    const action = searchParams.get('action');
    if (viewId) {
      setViewingPO({ id: parseInt(viewId) });
      setViewModalVisible(true);
      if (action) setPendingAction(action);
      searchParams.delete('viewId');
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // History modal state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPO, setHistoryPO] = useState(null);

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
        <RecordLink text={text} onClick={() => handleView(record)} />
      ),
    },
    {
      title: 'PO Date',
      dataIndex: 'poDate',
      key: 'poDate',
      width: 120,
      sorter: true,
      render: (date) => formatDate(date),
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
      // Shows the date the PO is actually tracking to; the original stays visible,
      // struck through, so a revision is never mistaken for a data-entry change.
      render: (date, record) => (record.revisedDeliveryDate ? (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
          <span>{formatDate(record.revisedDeliveryDate)}<Tag color="warning" style={{ marginLeft: 6, fontSize: 9, padding: '0 4px', lineHeight: '14px' }}>Revised</Tag></span>
          <span style={{ textDecoration: 'line-through', opacity: 0.55, fontSize: 11 }}>{formatDate(date)}</span>
        </div>
      ) : formatDate(date)),
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
      render: (amount) => <CurrencyDisplay amount={amount} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 160,
      render: (status) => (
        <StatusTag status={status} config={PO_STATUS_CONFIG} getLabel={getStatusLabel} />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          {canView && (
            <ActionButton
              action="view"
              size="small"
              onClick={() => handleView(record)}
            />
          )}
          {canView && record.status !== PO_STATUS.DRAFT && (
            <ActionButton
              action="history"
              size="small"
              onClick={() => { setHistoryPO(record); setHistoryOpen(true); }}
            />
          )}
          {(record.status === PO_STATUS.DRAFT || record.status === PO_STATUS.REFERRED_BACK || record.status === PO_STATUS.REJECTED) && canUpdate && (
            <ActionButton
              action="edit"
              size="small"
              onClick={() => navigate(`/purchase-orders/supplier-po/edit/${record.id}`)}
            />
          )}
          {record.status === PO_STATUS.DRAFT && canDelete && (
            <DeleteConfirm
              title="Delete Purchase Order"
              recordLabel={record.poNumber}
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
  ], [handleView, navigate, fetchData, pagination.current, pagination.pageSize, deletingId, canView, canUpdate, canDelete]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Supplier PO">
        {hasPermission('purchase-orders', 'add') && (
          <ActionButton
            action="create"
            text="New Supplier PO"
            onClick={() => navigate('/purchase-orders/supplier-po/new')}
          />
        )}
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search PO number, supplier..."
          onRefresh={() => fetchData(pagination.current, pagination.pageSize)}
          filters={[
            {
              type: 'select',
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
              props: {
                placeholder: 'Status',
                value: statusFilter,
                onChange: handleStatusFilter,
                options: Object.keys(PO_STATUS_CONFIG).map((s) => ({
                  label: getStatusLabel(s),
                  value: s,
                })),
              },
            },
            {
              type: 'select',
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
              props: {
                placeholder: 'PO Type',
                value: poTypeFilter,
                onChange: (val) => setPoTypeFilter(val),
                options: [
                  { value: 'General', label: 'General' },
                  { value: 'Regular', label: 'Regular' },
                  { value: 'Combined', label: 'Combined' },
                ],
              },
            },
            {
              type: 'rangePicker',
              span: { xs: 24, sm: 12, md: 6, lg: 5 },
              props: {
                placeholder: ['PO Date From', 'PO Date To'],
                value: poDateRange,
                onChange: handlePoDateRangeChange,
              },
            },
            {
              type: 'rangePicker',
              span: { xs: 24, sm: 12, md: 6, lg: 5 },
              props: {
                placeholder: ['Delivery From', 'Delivery To'],
                value: deliveryDateRange,
                onChange: handleDeliveryDateRangeChange,
              },
            },
          ]}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          onChange={handleTableChange}
          pagination={getTablePagination(pagination, 'supplier PO')}
          locale={{
            emptyText: (
              <EmptyState
                title="No Supplier PO"
                description="No supplier PO found matching your criteria."
              />
            ),
          }}
        />
      </Card>

      {/* PO View Modal */}
      <POView
        open={viewModalVisible}
        poData={viewingPO}
        pendingAction={pendingAction}
        onClose={() => {
          setViewModalVisible(false);
          setViewingPO(null);
          setPendingAction(null);
        }}
        onStatusChange={handleStatusActionComplete}
        onRefresh={() => fetchData(pagination.current, pagination.pageSize)}
      />

      {/* PO Version History Modal */}
      <POVersionHistory
        open={historyOpen}
        onClose={() => { setHistoryOpen(false); setHistoryPO(null); }}
        poId={historyPO?.id}
        poNumber={historyPO?.poNumber}
      />
    </div>
  );
};

export default POList;
