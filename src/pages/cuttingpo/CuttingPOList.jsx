import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchCuttingPOs, deleteCuttingPO, changeCuttingPOStatus } from '../../services/cuttingPoService';
import { hasPermission } from '../../utils/permissions';
import {
  getStatusLabel,
  getStatusColor,
  EDITABLE_STATUSES,
  DELETABLE_STATUSES,
  SUBMITTABLE_STATUSES,
  CUTTING_PO_STATUS,
  STATUS_OPTIONS,
} from '../../utils/cuttingPoConstants';
import { PROCESSING_UNIT_TYPE_OPTIONS } from '../../utils/workOrderConstants';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import RecordLink from '../../components/RecordLink';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/formatters';
import { getTablePagination } from '../../utils/paginationConfig';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import CuttingPOView from './CuttingPOView';

const { Text } = Typography;

const CuttingPOList = () => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [unitTypeFilter, setUnitTypeFilter] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingRecord, setViewingRecord] = useState(null);

  const canAdd = hasPermission('cutting-po', 'add');
  const canUpdate = hasPermission('cutting-po', 'update');
  const canDelete = hasPermission('cutting-po', 'delete');
  // Approval handled via centralized Approval Flows module
  const canApprove = false;

  const fetchData = useCallback(async (page, pageSize, sort, direction) => {
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
      const response = await searchCuttingPOs(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load cutting POs');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter, unitTypeFilter, dateRange]);

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [debouncedSearch, statusFilter, unitTypeFilter, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTableChange = (pag, _f, sorter) => {
    const s = sorter.field || sortField;
    const d = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(s);
    setSortDirection(d);
    fetchData(pag.current, pag.pageSize, s, d);
  };

  const handleDelete = useCallback(async (record) => {
    setDeletingId(record.id);
    try {
      await deleteCuttingPO(record.id);
      message.success(`${record.cuttingPoNo} deleted`);
      fetchData(pagination.current, pagination.pageSize);
    } catch { message.error('Failed to delete'); }
    finally { setDeletingId(null); }
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleSubmit = useCallback(async (record) => {
    try {
      await changeCuttingPOStatus(record.id, { status: CUTTING_PO_STATUS.PENDING_APPROVAL });
      message.success(`${record.cuttingPoNo} submitted for approval`);
      fetchData(pagination.current, pagination.pageSize);
    } catch { message.error('Failed to submit'); }
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleApprove = useCallback(async (record) => {
    try {
      await changeCuttingPOStatus(record.id, { status: CUTTING_PO_STATUS.APPROVED });
      message.success(`${record.cuttingPoNo} approved`);
      fetchData(pagination.current, pagination.pageSize);
    } catch { message.error('Failed to approve'); }
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleReject = useCallback((record) => {
    modal.confirm({
      title: 'Reject Cutting PO',
      content: `Reject ${record.cuttingPoNo}? It will be sent back to Draft.`,
      okText: 'Reject', okType: 'danger',
      onOk: async () => {
        try {
          await changeCuttingPOStatus(record.id, { status: CUTTING_PO_STATUS.DRAFT, reason: 'Rejected' });
          message.success(`${record.cuttingPoNo} rejected`);
          fetchData(pagination.current, pagination.pageSize);
        } catch { message.error('Failed to reject'); }
      },
    });
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleCancel = useCallback((record) => {
    modal.confirm({
      title: 'Cancel Cutting PO',
      content: `Cancel ${record.cuttingPoNo}? This cannot be undone.`,
      okText: 'Cancel CPO', okType: 'danger',
      onOk: async () => {
        try {
          await changeCuttingPOStatus(record.id, { status: CUTTING_PO_STATUS.CANCELLED, reason: 'Cancelled' });
          message.success(`${record.cuttingPoNo} cancelled`);
          fetchData(pagination.current, pagination.pageSize);
        } catch { message.error('Failed to cancel'); }
      },
    });
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleView = useCallback((record) => {
    setViewingRecord(record);
    setViewOpen(true);
  }, []);

  const columns = useMemo(() => [
    { title: 'CPO No', dataIndex: 'cuttingPoNo', key: 'cuttingPoNo', fixed: 'left', width: 140, sorter: true,
      render: (text, record) => <RecordLink text={text} onClick={() => handleView(record)} /> },
    { title: 'Order No', dataIndex: 'orderNo', key: 'orderNo', width: 140, render: (t) => t || '-' },
    { title: 'Style No', dataIndex: 'styleNo', key: 'styleNo', width: 120, ellipsis: true },
    { title: 'Processing Unit', key: 'processingUnit', width: 180, ellipsis: true,
      render: (_, r) => (
        <Space size={4}>
          <Tag color={r.processingUnitType === 'VENDOR' ? 'orange' : 'blue'} style={{ margin: 0 }}>
            {r.processingUnitType === 'VENDOR' ? 'Vendor' : 'Unit'}
          </Tag>
          <Text ellipsis style={{ maxWidth: 100 }}>{r.processingUnitName || '-'}</Text>
        </Space>
      ),
    },
    { title: 'Cut Date', dataIndex: 'plannedCutDate', key: 'plannedCutDate', width: 110, sorter: true,
      render: (d) => formatDate(d) },
    { title: 'Order Qty', dataIndex: 'totalOrderQty', key: 'totalOrderQty', width: 100, align: 'right', sorter: true,
      render: (q) => <Text strong>{(q || 0).toLocaleString()}</Text> },
    { title: 'Planned Qty', dataIndex: 'totalPlannedQty', key: 'totalPlannedQty', width: 110, align: 'right',
      render: (q) => <Text strong>{(q || 0).toLocaleString()}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 150,
      render: (s) => <Tag color={getStatusColor(s)}>{getStatusLabel(s)}</Tag> },
    { title: 'Actions', key: 'actions', fixed: 'right', width: 160,
      render: (_, record) => (
        <Space size="small" wrap>
          <ActionButton action="view" size="small" onClick={() => handleView(record)} />
          {EDITABLE_STATUSES.includes(record.status) && canUpdate && (
            <ActionButton action="edit" size="small" onClick={() => navigate(`/cutting-po/edit/${record.id}`)} />
          )}
          {SUBMITTABLE_STATUSES.includes(record.status) && canUpdate && (
            <ActionButton action="submit" size="small" onClick={() => handleSubmit(record)} />
          )}
          {record.status === CUTTING_PO_STATUS.PENDING_APPROVAL && canApprove && (
            <>
              <ActionButton action="approve" size="small" onClick={() => handleApprove(record)} />
              <ActionButton action="reject" size="small" onClick={() => handleReject(record)} />
            </>
          )}
          {record.status !== CUTTING_PO_STATUS.CANCELLED && record.status !== CUTTING_PO_STATUS.APPROVED && canUpdate && (
            <ActionButton action="cancel" size="small" onClick={() => handleCancel(record)} />
          )}
          {DELETABLE_STATUSES.includes(record.status) && canDelete && (
            <DeleteConfirm title="Delete Cutting PO" recordLabel={record.cuttingPoNo}
              onConfirm={() => handleDelete(record)} loading={deletingId === record.id}>
              <ActionButton action="delete" size="small" />
            </DeleteConfirm>
          )}
        </Space>
      ),
    },
  ], [handleView, handleDelete, handleSubmit, handleApprove, handleReject, handleCancel, navigate, deletingId, canUpdate, canDelete, canApprove]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Cutting PO">
        {canAdd && <ActionButton action="create" text="New Cutting PO" onClick={() => navigate('/cutting-po/new')} />}
      </PageHeader>
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search CPO No, Style, Unit..."
          filters={[
            { type: 'select', placeholder: 'Status', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS, allowClear: true, style: { width: 160 } },
            { type: 'select', placeholder: 'Unit Type', value: unitTypeFilter, onChange: setUnitTypeFilter, options: PROCESSING_UNIT_TYPE_OPTIONS, allowClear: true, style: { width: 160 } },
            { type: 'dateRange', value: dateRange, onChange: setDateRange, placeholder: ['Start', 'End'] },
          ]}
        />
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading}
          onChange={handleTableChange} pagination={getTablePagination(pagination)}
          scroll={{ x: 1300 }} locale={{ emptyText: <EmptyState description="No cutting POs found" /> }} size="middle" />
      </Card>
      <CuttingPOView open={viewOpen} record={viewingRecord}
        onClose={() => { setViewOpen(false); setViewingRecord(null); }}
        onStatusChange={() => { setViewOpen(false); setViewingRecord(null); fetchData(pagination.current, pagination.pageSize); }} />
    </div>
  );
};

export default CuttingPOList;
