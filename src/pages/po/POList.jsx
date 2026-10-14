import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table,
  Card,
  Tag,
  Typography,
  App,
  Space,
} from 'antd';
import { LinkOutlined } from '@ant-design/icons';
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
import useServerList from '../../hooks/useServerList';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import StatusTag from '../../components/StatusTag';
import RecordLink from '../../components/RecordLink';
import CurrencyDisplay from '../../components/CurrencyDisplay';
import EmptyState from '../../components/EmptyState';
import POView from './POView';
import POVersionHistory from './POVersionHistory';
import PoOrderMappingWorkspace from './order-mapping/PoOrderMappingWorkspace';
import { useBranch } from '../../context/BranchContext';

const { Text } = Typography;

const PO_FILTERS = { status: undefined, poType: null, poDateRange: null, deliveryDateRange: null };
const PO_LIST_OPTIONS = {
  defaultSort: { field: 'id', order: 'descend' },
  urlState: true,
  filterTypes: { poDateRange: 'dateRange', deliveryDateRange: 'dateRange' },
};

// The list's own query; the working branch travels as X-Branch-Id, so it is not a parameter here.
const fetchPoPage = ({ page, size, search, sort, direction, status, poType, poDateRange, deliveryDateRange }) => {
  const params = { page: page - 1, size, sort, direction };
  if (search) params.search = search;
  if (status) params.status = status;
  if (poType) params.poType = poType;
  if (poDateRange && poDateRange.length === 2) {
    params.poDateStart = poDateRange[0].format('YYYY-MM-DD');
    params.poDateEnd = poDateRange[1].format('YYYY-MM-DD');
  }
  if (deliveryDateRange && deliveryDateRange.length === 2) {
    params.deliveryDateStart = deliveryDateRange[0].format('YYYY-MM-DD');
    params.deliveryDateEnd = deliveryDateRange[1].format('YYYY-MM-DD');
  }
  return searchPurchaseOrders(params);
};

const POList = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  // Deliver-to branch: a column on multi-branch, and the list follows the header switcher (X-Branch-Id)
  const { isMultiBranch } = useBranch();
  // Page, sort, search and filters live in the URL, so a refresh or the way back from a form keeps them;
  // with no column sorter the list is newest first (id descending), as it always was.
  const list = useServerList(fetchPoPage, PO_FILTERS, 'Failed to load purchase orders', PO_LIST_OPTIONS);
  const { load: reload, sortOrderFor } = list;

  // Delete loading state
  const [deletingId, setDeletingId] = useState(null);

  // Deep link from a push notification (?viewId=X&action=approve): the PO opens on the first render,
  // and the two parameters then leave the address (the list's own parameters stay).
  const [searchParams, setSearchParams] = useSearchParams();
  const [deepLink] = useState(() => {
    const viewId = searchParams.get('viewId');
    return viewId ? { id: parseInt(viewId), action: searchParams.get('action') } : null;
  });
  useEffect(() => {
    if (!deepLink) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('viewId');
      next.delete('action');
      return next;
    }, { replace: true });
  }, [deepLink, setSearchParams]);

  // View modal state
  const [viewModalVisible, setViewModalVisible] = useState(!!deepLink);
  // General PO → customer order mapping workspace
  const [mappingOpen, setMappingOpen] = useState(false);
  const [viewingPO, setViewingPO] = useState(deepLink ? { id: deepLink.id } : null);
  const [pendingAction, setPendingAction] = useState(deepLink?.action || null);

  // History modal state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPO, setHistoryPO] = useState(null);

  // Permissions
  const canView = hasPermission('purchase-orders', 'view');
  const canUpdate = hasPermission('purchase-orders', 'update');
  const canDelete = hasPermission('purchase-orders', 'delete');

  // View PO
  const handleView = useCallback((record) => {
    setViewingPO(record);
    setViewModalVisible(true);
  }, []);

  // After status action in view, refresh list
  const handleStatusActionComplete = () => {
    setViewModalVisible(false);
    setViewingPO(null);
    reload();
  };

  const columns = useMemo(() => [
    {
      title: 'PO Number',
      dataIndex: 'poNumber',
      key: 'poNumber',
      fixed: 'left',
      width: 150,
      sorter: true,
      sortOrder: sortOrderFor('poNumber'),
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
      sortOrder: sortOrderFor('poDate'),
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
    ...(isMultiBranch ? [{ title: 'Deliver To', dataIndex: 'deliveryBranchName', key: 'deliveryBranchName', width: 150, ellipsis: true, render: (v) => v || '—' }] : []),
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
      sortOrder: sortOrderFor('deliveryDate'),
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
      sortOrder: sortOrderFor('grandTotal'),
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
                    reload();
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
  ], [handleView, navigate, reload, sortOrderFor, deletingId, canView, canUpdate, canDelete, isMultiBranch, message]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Supplier PO">
        <Space>
          {canView && (
            <ActionButton
              action="custom"
              icon={<LinkOutlined />}
              text="Order Mapping"
              tooltip="Link General POs to customer orders"
              onClick={() => setMappingOpen(true)}
            />
          )}
          {hasPermission('purchase-orders', 'add') && (
            <ActionButton
              action="create"
              text="New Supplier PO"
              onClick={() => navigate('/purchase-orders/supplier-po/new')}
            />
          )}
        </Space>
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={list.searchText}
          onSearchChange={(e) => list.setSearchText(e.target.value)}
          searchPlaceholder="Search PO number, supplier..."
          onRefresh={reload}
          filters={[
            {
              type: 'select',
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
              props: {
                placeholder: 'Status',
                value: list.filters.status,
                onChange: list.setFilter('status'),
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
                value: list.filters.poType,
                onChange: list.setFilter('poType'),
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
                value: list.filters.poDateRange,
                onChange: list.setFilter('poDateRange'),
              },
            },
            {
              type: 'rangePicker',
              span: { xs: 24, sm: 12, md: 6, lg: 5 },
              props: {
                placeholder: ['Delivery From', 'Delivery To'],
                value: list.filters.deliveryDateRange,
                onChange: list.setFilter('deliveryDateRange'),
              },
            },
          ]}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={list.rows}
          loading={list.loading}
          rowKey="id"
          scroll={{ x: 1200 }}
          onChange={list.onTableChange}
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'supplier PO')}
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
        onRefresh={reload}
      />

      {/* PO Version History Modal */}
      <POVersionHistory
        open={historyOpen}
        onClose={() => { setHistoryOpen(false); setHistoryPO(null); }}
        poId={historyPO?.id}
        poNumber={historyPO?.poNumber}
      />

      <PoOrderMappingWorkspace open={mappingOpen} onClose={() => setMappingOpen(false)} />
    </div>
  );
};

export default POList;
