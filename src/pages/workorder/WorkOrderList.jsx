import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchWorkOrders, deleteWorkOrder, changeWorkOrderStatus } from '../../services/workOrderService';
import { hasPermission } from '../../utils/permissions';
import {
  getStatusLabel,
  getStatusColor,
  EDITABLE_STATUSES,
  DELETABLE_STATUSES,
  SUBMITTABLE_STATUSES,
  WORK_ORDER_STATUS,
  STATUS_OPTIONS,
  PROCESSING_UNIT_TYPE_OPTIONS,
} from '../../utils/workOrderConstants';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import RecordLink from '../../components/RecordLink';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { getTablePagination } from '../../utils/paginationConfig';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import WorkOrderView from './WorkOrderView';

const { Text } = Typography;

const WorkOrderList = () => {
  const { message, modal } = App.useApp();
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
  const [unitTypeFilter, setUnitTypeFilter] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  // View drawer state
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);

  // Permissions
  const canAdd = hasPermission('work-orders', 'add');
  const canUpdate = hasPermission('work-orders', 'update');
  const canDelete = hasPermission('work-orders', 'delete');
  const canApprove = hasPermission('work-order-approval', 'approve');

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
        if (unitTypeFilter) params.processingUnitType = unitTypeFilter;
        if (dateRange && dateRange.length === 2) {
          params.dateStart = dateRange[0].format('YYYY-MM-DD');
          params.dateEnd = dateRange[1].format('YYYY-MM-DD');
        }

        const response = await searchWorkOrders(params);
        setData(response.content || []);
        setPagination((prev) => ({
          ...prev,
          current: page || prev.current,
          pageSize: pageSize || prev.pageSize,
          total: response.totalElements || 0,
        }));
      } catch {
        message.error('Failed to load work orders');
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter, unitTypeFilter, dateRange]
  );

  useEffect(() => {
    fetchData(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, unitTypeFilter, dateRange]);

  const handleTableChange = (pag, _filters, sorter) => {
    const newSort = sorter.field || sortField;
    const newDirection = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(newSort);
    setSortDirection(newDirection);
    fetchData(pag.current, pag.pageSize, newSort, newDirection);
  };

  const handleDelete = useCallback(async (record) => {
    setDeletingId(record.id);
    try {
      await deleteWorkOrder(record.id);
      message.success(`${record.workOrderNo} deleted`);
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error('Failed to delete work order');
    } finally {
      setDeletingId(null);
    }
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleSubmit = useCallback(async (record) => {
    try {
      await changeWorkOrderStatus(record.id, { status: WORK_ORDER_STATUS.PENDING_APPROVAL });
      message.success(`${record.workOrderNo} submitted for approval`);
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error('Failed to submit work order');
    }
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleApprove = useCallback(async (record) => {
    try {
      await changeWorkOrderStatus(record.id, { status: WORK_ORDER_STATUS.APPROVED });
      message.success(`${record.workOrderNo} approved`);
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error('Failed to approve work order');
    }
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleReject = useCallback((record) => {
    modal.confirm({
      title: 'Reject Work Order',
      content: `Reject ${record.workOrderNo}? It will be sent back to Draft.`,
      okText: 'Reject',
      okType: 'danger',
      onOk: async () => {
        try {
          await changeWorkOrderStatus(record.id, {
            status: WORK_ORDER_STATUS.DRAFT,
            reason: 'Rejected by approver',
          });
          message.success(`${record.workOrderNo} rejected`);
          fetchData(pagination.current, pagination.pageSize);
        } catch {
          message.error('Failed to reject work order');
        }
      },
    });
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleCancel = useCallback((record) => {
    modal.confirm({
      title: 'Cancel Work Order',
      content: `Cancel ${record.workOrderNo}? This action cannot be undone.`,
      okText: 'Cancel WO',
      okType: 'danger',
      onOk: async () => {
        try {
          await changeWorkOrderStatus(record.id, {
            status: WORK_ORDER_STATUS.CANCELLED,
            reason: 'Cancelled by user',
          });
          message.success(`${record.workOrderNo} cancelled`);
          fetchData(pagination.current, pagination.pageSize);
        } catch {
          message.error('Failed to cancel work order');
        }
      },
    });
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleView = useCallback((record) => {
    setViewingRecord(record);
    setViewOpen(true);
  }, []);

  const columns = useMemo(() => [
    {
      title: 'WO No',
      dataIndex: 'workOrderNo',
      key: 'workOrderNo',
      fixed: 'left',
      width: 140,
      sorter: true,
      render: (text, record) => (
        <RecordLink text={text} onClick={() => handleView(record)} />
      ),
    },
    {
      title: 'Order No',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 140,
      render: (text) => text || '-',
    },
    {
      title: 'Style No',
      dataIndex: 'styleNo',
      key: 'styleNo',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Processing Unit',
      key: 'processingUnit',
      width: 180,
      ellipsis: true,
      render: (_, record) => (
        <Space size={4}>
          <Tag color={record.processingUnitType === 'VENDOR' ? 'orange' : 'blue'} style={{ margin: 0 }}>
            {record.processingUnitType === 'VENDOR' ? 'Vendor' : 'Unit'}
          </Tag>
          <Text ellipsis style={{ maxWidth: 100 }}>{record.processingUnitName || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Start Date',
      dataIndex: 'plannedStartDate',
      key: 'plannedStartDate',
      width: 110,
      sorter: true,
      render: (date) => formatDate(date),
    },
    {
      title: 'Order Qty',
      dataIndex: 'totalOrderQty',
      key: 'totalOrderQty',
      width: 100,
      align: 'right',
      sorter: true,
      render: (qty) => <Text strong>{(qty || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Planned Qty',
      dataIndex: 'totalPlannedQty',
      key: 'totalPlannedQty',
      width: 110,
      align: 'right',
      render: (qty) => <Text strong>{(qty || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, record) => (
        <Space size="small" wrap>
          <ActionButton action="view" size="small" onClick={() => handleView(record)} />
          {EDITABLE_STATUSES.includes(record.status) && canUpdate && (
            <ActionButton
              action="edit"
              size="small"
              onClick={() => navigate(`/work-orders/edit/${record.id}`)}
            />
          )}
          {SUBMITTABLE_STATUSES.includes(record.status) && canUpdate && (
            <ActionButton
              action="submit"
              size="small"
              onClick={() => handleSubmit(record)}
            />
          )}
          {record.status === WORK_ORDER_STATUS.PENDING_APPROVAL && canApprove && (
            <>
              <ActionButton action="approve" size="small" onClick={() => handleApprove(record)} />
              <ActionButton action="reject" size="small" onClick={() => handleReject(record)} />
            </>
          )}
          {record.status !== WORK_ORDER_STATUS.CANCELLED
            && record.status !== WORK_ORDER_STATUS.APPROVED
            && canUpdate && (
            <ActionButton action="cancel" size="small" onClick={() => handleCancel(record)} />
          )}
          {DELETABLE_STATUSES.includes(record.status) && canDelete && (
            <DeleteConfirm
              title="Delete Work Order"
              recordLabel={record.workOrderNo}
              onConfirm={() => handleDelete(record)}
              loading={deletingId === record.id}
            >
              <ActionButton action="delete" size="small" />
            </DeleteConfirm>
          )}
        </Space>
      ),
    },
  ], [handleView, handleDelete, handleSubmit, handleApprove, handleReject, handleCancel, navigate, deletingId, canUpdate, canDelete, canApprove]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Work Orders">
        {canAdd && (
          <ActionButton
            action="create"
            text="New Work Order"
            onClick={() => navigate('/work-orders/new')}
          />
        )}
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search WO No, Style, Unit..."
          filters={[
            {
              type: 'select',
              placeholder: 'Status',
              value: statusFilter,
              onChange: setStatusFilter,
              options: STATUS_OPTIONS,
              allowClear: true,
              style: { width: 160 },
            },
            {
              type: 'select',
              placeholder: 'Unit Type',
              value: unitTypeFilter,
              onChange: setUnitTypeFilter,
              options: PROCESSING_UNIT_TYPE_OPTIONS,
              allowClear: true,
              style: { width: 160 },
            },
            {
              type: 'dateRange',
              value: dateRange,
              onChange: setDateRange,
              placeholder: ['Start', 'End'],
            },
          ]}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          onChange={handleTableChange}
          pagination={getTablePagination(pagination)}
          scroll={{ x: 1300 }}
          locale={{ emptyText: <EmptyState description="No work orders found" /> }}
          size="middle"
        />
      </Card>

      <WorkOrderView
        open={viewOpen}
        record={viewingRecord}
        onClose={() => {
          setViewOpen(false);
          setViewingRecord(null);
        }}
        onStatusChange={() => {
          setViewOpen(false);
          setViewingRecord(null);
          fetchData(pagination.current, pagination.pageSize);
        }}
      />
    </div>
  );
};

export default WorkOrderList;
