import { useState, useCallback, useMemo } from 'react';
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
import SampleOrderTag from '../../components/SampleOrderTag';
import EmptyState from '../../components/EmptyState';
import { BOM_STATUS_CONFIG } from '../../utils/statusConfig';
import { getTablePagination } from '../../utils/paginationConfig';
import useServerList from '../../hooks/useServerList';
import useSampleOrderNos from '../../hooks/useSampleOrderNos';

const { Text } = Typography;

const BOM_FILTERS = { status: undefined };
const BOM_LIST_OPTIONS = { defaultSort: { field: 'id', order: 'descend' }, urlState: true };

const fetchBomPage = ({ page, size, search, sort, direction, status }) => {
  const params = { page: page - 1, size, sort, direction };
  if (search) params.search = search;
  if (status) params.status = status;
  return searchBoms(params);
};

const BOMList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { isSampleOrder } = useSampleOrderNos();
  const [deletingId, setDeletingId] = useState(null);
  // Page, sort, search and filters live in the URL, so a refresh or the way back from a form keeps them;
  // with no column sorter the list is newest first (id descending), as it always was.
  const list = useServerList(fetchBomPage, BOM_FILTERS, 'Failed to load BOMs', BOM_LIST_OPTIONS);
  const { load: reload, sortOrderFor } = list;

  // View modal state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [viewingBom, setViewingBom] = useState(null);

  // Permissions
  const canView = hasPermission('bom', 'view');
  const canUpdate = hasPermission('bom', 'update');
  const canDelete = hasPermission('bom', 'delete');

  // Delete
  const handleDelete = useCallback(async (record) => {
    setDeletingId(record.id);
    try {
      await deleteBom(record.id);
      message.success(`${record.orderNo} deleted successfully`);
      reload();
    } catch {
      message.error('Failed to delete BOM');
    } finally {
      setDeletingId(null);
    }
  }, [reload, message]);

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
      sortOrder: sortOrderFor('orderNo'),
      render: (text, record) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <RecordLink text={text} onClick={() => handleView(record)} />
          {isSampleOrder(text) && <SampleOrderTag />}
        </span>
      ),
    },
    {
      title: 'Style No',
      dataIndex: 'styleName',
      key: 'styleName',
      width: 140,
      sorter: true,
      sortOrder: sortOrderFor('styleName'),
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
      // Summed from the lines, so the server cannot sort by it (it answered a 500 before API 7120044)
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
  ], [handleView, handleDelete, navigate, deletingId, canView, canUpdate, canDelete, isSampleOrder, sortOrderFor]);

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
          searchText={list.searchText}
          onSearchChange={(e) => list.setSearchText(e.target.value)}
          searchPlaceholder="Search order no, style, buyer..."
          filters={[
            {
              type: 'select',
              props: {
                placeholder: 'Status',
                value: list.filters.status,
                onChange: list.setFilter('status'),
                options: statusFilterOptions,
              },
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
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
          scroll={{ x: 1000 }}
          onChange={list.onTableChange}
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'BOMs')}
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
          reload();
        }}
      />
    </div>
  );
};

export default BOMList;
