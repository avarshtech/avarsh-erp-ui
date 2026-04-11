import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  searchFabricReceipts,
  deleteFabricReceipt,
} from '../../../services/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import {
  FABRIC_RECEIPT_STATUS,
  getFabricReceiptLabel,
  getFabricReceiptColor,
  FABRIC_RECEIPT_STATUS_OPTIONS,
} from '../../../utils/cuttingConstants';
import { ActionButton, DeleteConfirm } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const FabricReceiptList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('fabric-receipt', 'add');
  const canUpdate = hasPermission('fabric-receipt', 'update');
  const canDelete = hasPermission('fabric-receipt', 'delete');

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
      const response = await searchFabricReceipts(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load fabric receipts');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [debouncedSearch, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

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
      await deleteFabricReceipt(record.id);
      message.success(`${record.receiptNo} deleted`);
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error('Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }, [pagination.current, pagination.pageSize, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  const columns = useMemo(() => [
    {
      title: 'Receipt No',
      dataIndex: 'receiptNo',
      key: 'receiptNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Buyer', dataIndex: 'buyerName', key: 'buyerName', width: 160, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100, ellipsis: true },
    {
      title: 'Total Rolls',
      dataIndex: 'totalRolls',
      key: 'totalRolls',
      width: 100,
      align: 'right',
    },
    {
      title: 'Total Weight (kg)',
      dataIndex: 'totalWeightKg',
      key: 'totalWeightKg',
      width: 140,
      align: 'right',
      render: (v) => (v != null ? Number(v).toFixed(3) : '—'),
    },
    {
      title: 'Date',
      dataIndex: 'receiptDate',
      key: 'receiptDate',
      width: 110,
      sorter: true,
      render: (d) => formatDate(d),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => <Tag color={getFabricReceiptColor(s)}>{getFabricReceiptLabel(s)}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          {canUpdate && record.status === FABRIC_RECEIPT_STATUS.PENDING && (
            <ActionButton action="edit" onClick={() => navigate(`/cutting/fabric-receipt/edit/${record.id}`)} />
          )}
          {canDelete && record.status === FABRIC_RECEIPT_STATUS.PENDING && (
            <DeleteConfirm onConfirm={() => handleDelete(record)} loading={deletingId === record.id} />
          )}
        </span>
      ),
    },
  ], [canUpdate, canDelete, deletingId, navigate, handleDelete]);

  const filters = useMemo(() => [
    {
      key: 'status',
      type: 'select',
      placeholder: 'Status',
      value: statusFilter,
      onChange: setStatusFilter,
      options: FABRIC_RECEIPT_STATUS_OPTIONS,
      width: 160,
    },
  ], [statusFilter]);

  return (
    <>
      <PageHeader
        title="Fabric Receipts"
        onAdd={canAdd ? () => navigate('/cutting/fabric-receipt/new') : undefined}
        addLabel="New Receipt"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search receipt no, style, buyer..."
          filters={filters}
          onReset={() => { setSearchText(''); setStatusFilter(undefined); }}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={getTablePagination(pagination)}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <EmptyState description="No fabric receipts found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default FabricReceiptList;
