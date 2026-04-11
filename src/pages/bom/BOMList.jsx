import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App,
  Table,
  Card,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchBoms, deleteBom } from '../../services/bom/bomService';
import { BOM_STATUS, getStatusLabel, EDITABLE_STATUSES } from '../../utils/bomConstants';
import { hasPermission } from '../../utils/permissions';
import PermissionGuard from '../../components/PermissionGuard';
import BOMView from './BOMView';

import { ActionButton, DeleteConfirm } from '../../components/buttons';
import StatusTag from '../../components/StatusTag';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import RecordLink from '../../components/RecordLink';
import EmptyState from '../../components/EmptyState';
import { BOM_STATUS_CONFIG } from '../../utils/statusConfig';
import { getTablePagination } from '../../utils/paginationConfig';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';

const { Text } = Typography;

const BOMList = () => {
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
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  // View modal state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingBom, setViewingBom] = useState(null);

  // Permissions
  const canView = hasPermission('bom', 'view');
  const canAdd = hasPermission('bom', 'add');
  const canUpdate = hasPermission('bom', 'update');
  const canDelete = hasPermission('bom', 'delete');

  const fetchData = useCallback(async (page, size, sort, direction) => {
    setLoading(true);
    try {
      const params = {
        page: (page || pagination.current) - 1,
        size: size || pagination.pageSize,
        sort: sort || sortField,
        direction: direction || sortDirection,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;

      const res = await searchBoms(params);
      setData(res.content || []);
      setPagination((prev) => ({
        ...prev,
        current: (res.page ?? 0) + 1,
        pageSize: res.size || prev.pageSize,
        total: res.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load BOMs');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, pagination.current, pagination.pageSize, sortField, sortDirection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      await deleteBom(record.id);
      message.success(`${record.orderNo} deleted successfully`);
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error('Failed to delete BOM');
    } finally {
      setDeletingId(null);
    }
  }, [fetchData, pagination.current, pagination.pageSize]);

  // View
  const handleView = useCallback((record) => {
    setViewingBom(record);
    setViewModalVisible(true);
  }, []);

  const statusFilterOptions = useMemo(() =>
    Object.keys(BOM_STATUS_CONFIG).map((s) => ({
      label: getStatusLabel(s),
      value: s,
    })),
  []);

  const columns = useMemo(() => [
    {
      title: 'Order No',
      dataIndex: 'orderNo',
      key: 'orderNo',
      fixed: 'left',
      width: 160,
      sorter: true,
      render: (text, record) => (
        <RecordLink text={text} onClick={() => handleView(record)} />
      ),
    },
    {
      title: 'Style No',
      dataIndex: 'styleName',
      key: 'styleName',
      width: 140,
      sorter: true,
      render: (text) => <Text strong>{text || '-'}</Text>,
    },
    {
      title: 'Buyer',
      dataIndex: 'buyerName',
      key: 'buyerName',
      width: 200,
      ellipsis: true,
      render: (text) => text || '-',
    },
    {
      title: 'Season',
      dataIndex: 'season',
      key: 'season',
      width: 120,
      render: (text) => text || '-',
    },
    {
      title: 'Lines',
      dataIndex: 'lineCount',
      key: 'lineCount',
      width: 70,
      align: 'center',
      render: (count) => <Tag>{count || 0}</Tag>,
    },
    {
      title: 'Purchase Qty',
      dataIndex: 'totalPurchaseQty',
      key: 'totalPurchaseQty',
      width: 130,
      align: 'right',
      sorter: true,
      render: (qty) => qty ? <Text strong>{Number(qty).toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text> : '-',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => (
        <StatusTag
          status={status}
          config={BOM_STATUS_CONFIG}
          getLabel={getStatusLabel}
        />
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
              onClick={() => navigate(`/bom/edit/${record.id}`, { state: { bomData: record } })}
            />
          )}
          {record.status === BOM_STATUS.DRAFT && canDelete && (
            <DeleteConfirm
              title="Delete BOM"
              recordLabel={record.orderNo}
              onConfirm={() => handleDelete(record)}
              loading={deletingId === record.id}
            >
              <ActionButton action="delete" size="small" />
            </DeleteConfirm>
          )}
        </Space>
      ),
    },
  ], [handleView, handleDelete, navigate, deletingId, canView, canUpdate, canDelete]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Bill of Materials">
        <PermissionGuard module="bom" operation="add">
          <ActionButton
            action="create"
            text="Create BOM"
            onClick={() => navigate('/bom/new')}
          />
        </PermissionGuard>
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search order no, style, buyer..."
          filters={[
            {
              type: 'select',
              props: {
                placeholder: 'Status',
                value: statusFilter,
                onChange: setStatusFilter,
                options: statusFilterOptions,
              },
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
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
          scroll={{ x: 1000 }}
          onChange={handleTableChange}
          pagination={getTablePagination(pagination, 'BOMs')}
          locale={{
            emptyText: (
              <EmptyState
                title="No BOMs found"
                description="Create a new Bill of Materials to get started."
              />
            ),
          }}
        />
      </Card>

      {/* ── BOM View Modal ── */}
      <BOMView
        open={viewModalVisible}
        bomData={viewingBom}
        onClose={() => {
          setViewModalVisible(false);
          setViewingBom(null);
        }}
        onStatusChange={() => {
          setViewModalVisible(false);
          setViewingBom(null);
          fetchData(pagination.current, pagination.pageSize);
        }}
      />
    </div>
  );
};

export default BOMList;
