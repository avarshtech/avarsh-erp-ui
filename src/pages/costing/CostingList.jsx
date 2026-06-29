import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  App,
  Table,
  Card,
  Space,
  Typography,
  Tooltip,
} from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  searchCostSheets,
  deleteCostSheet,
  duplicateCostSheet,
  getCostSheetById,
} from '../../services/costing/costingService';
import { hasPermission } from '../../utils/permissions';
import {
  COSTING_STATUS,
  getStatusLabel,
  EDITABLE_STATUSES,
  DELETABLE_STATUSES,
  SEASONS,
  formatCurrency,
} from '../../utils/costingConstants';
import { getBuyers } from '../../services/master/buyerService';
import { generateCostingPdf } from '../../utils/costingPdfGenerator';
import CostingHistoryModal from './CostingHistoryModal';
import { ActionButton, DeleteConfirm } from '../../components/buttons';
import StatusTag from '../../components/StatusTag';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import RecordLink from '../../components/RecordLink';
import CurrencyDisplay from '../../components/CurrencyDisplay';
import EmptyState from '../../components/EmptyState';
import { COSTING_STATUS_CONFIG } from '../../utils/statusConfig';
import { getTablePagination } from '../../utils/paginationConfig';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';

const { Text } = Typography;

const CostingList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 25,
    total: 0,
  });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [buyerFilter, setBuyerFilter] = useState(undefined);
  const [seasonFilter, setSeasonFilter] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyRecord, setHistoryRecord] = useState(null);
  const [buyerOptions, setBuyerOptions] = useState([]);
  const [duplicatingId, setDuplicatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [printingId, setPrintingId] = useState(null);

  // Permissions
  const canAdd = hasPermission('costing', 'add');
  const canView = hasPermission('costing', 'view');
  const canUpdate = hasPermission('costing', 'update');
  const canDelete = hasPermission('costing', 'delete');

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
        if (buyerFilter) params.buyerId = buyerFilter;
        if (seasonFilter) params.season = seasonFilter;
        if (dateRange && dateRange.length === 2) {
          params.dateFrom = dateRange[0].format('YYYY-MM-DD');
          params.dateTo = dateRange[1].format('YYYY-MM-DD');
        }

        const response = await searchCostSheets(params);
        setData(response.content || []);
        setPagination((prev) => ({
          ...prev,
          current: page || prev.current,
          pageSize: pageSize || prev.pageSize,
          total: response.totalElements || 0,
        }));
      } catch {
        message.error('Failed to load cost sheets');
      } finally {
        setLoading(false);
      }
    },
    [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter, buyerFilter, seasonFilter, dateRange]
  );

  // Fetch buyer options on mount
  useEffect(() => {
    getBuyers()
      .then((buyers) =>
        setBuyerOptions((buyers || []).map((b) => ({ value: b.id, label: b.name })))
      )
      .catch(() => {});
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    fetchData(1, pagination.pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, statusFilter, buyerFilter, seasonFilter, dateRange]);

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
      await deleteCostSheet(record.id);
      message.success(`${record.costingId} deleted successfully`);
      fetchData(pagination.current, pagination.pageSize);
    } catch {
      message.error('Failed to delete cost sheet');
    } finally {
      setDeletingId(null);
    }
  }, [fetchData, pagination.current, pagination.pageSize]);

  const handleDuplicate = useCallback(async (record) => {
    setDuplicatingId(record.id);
    try {
      const dup = await duplicateCostSheet(record.id);
      message.success(`Duplicated as ${dup.costingId}`);
      fetchData(1, pagination.pageSize);
    } catch {
      message.error('Failed to duplicate cost sheet');
    } finally {
      setDuplicatingId(null);
    }
  }, [fetchData, pagination.pageSize]);

  const handleClearFilters = () => {
    setSearchText('');
    setStatusFilter(undefined);
    setBuyerFilter(undefined);
    setSeasonFilter(undefined);
    setDateRange(null);
  };

  const handleViewHistory = useCallback((record) => {
    setHistoryRecord(record);
    setHistoryModalOpen(true);
  }, []);

  const handlePrint = useCallback(async (record) => {
    setPrintingId(record.id);
    try {
      const fullData = await getCostSheetById(record.id);
      await generateCostingPdf(fullData);
    } catch {
      message.error('Failed to generate print document');
    } finally {
      setPrintingId(null);
    }
  }, []);

  const filters = useMemo(() => [
    {
      type: 'select',
      span: { xs: 12, sm: 8, md: 4, lg: 3 },
      props: {
        placeholder: 'Buyer',
        value: buyerFilter,
        onChange: setBuyerFilter,
        options: buyerOptions,
      },
    },
    {
      type: 'select',
      span: { xs: 12, sm: 8, md: 3, lg: 3 },
      props: {
        placeholder: 'Season',
        value: seasonFilter,
        onChange: setSeasonFilter,
        options: SEASONS,
        showSearch: false,
      },
    },
    {
      type: 'rangePicker',
      span: { xs: 24, sm: 12, md: 5, lg: 4 },
      props: {
        placeholder: ['Date From', 'Date To'],
        value: dateRange,
        onChange: setDateRange,
        allowClear: true,
      },
    },
    {
      type: 'select',
      span: { xs: 12, sm: 8, md: 3, lg: 3 },
      props: {
        placeholder: 'Status',
        value: statusFilter,
        onChange: setStatusFilter,
        options: Object.values(COSTING_STATUS).map((s) => ({
          label: getStatusLabel(s),
          value: s,
        })),
        showSearch: false,
      },
    },
  ], [buyerFilter, buyerOptions, seasonFilter, dateRange, statusFilter]);

  const columns = useMemo(() => [
    {
      title: 'Costing ID',
      dataIndex: 'costingId',
      key: 'costingId',
      fixed: 'left',
      width: 160,
      sorter: true,
      render: (text, record) => (
        <RecordLink
          text={text}
          onClick={() => navigate(`/costing/${record.id}`)}
        />
      ),
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      sorter: true,
      render: (date) => (date ? dayjs(date).format('DD-MMM-YYYY') : '-'),
    },
    {
      title: 'Buyer',
      dataIndex: 'buyerName',
      key: 'buyerName',
      width: 180,
      ellipsis: true,
      render: (text) => <Text strong>{text || '-'}</Text>,
    },
    {
      title: 'Style #',
      dataIndex: 'styleNo',
      key: 'styleNo',
      width: 140,
      render: (text) => text || '-',
    },
    {
      title: 'Garment Name',
      dataIndex: 'garmentName',
      key: 'garmentName',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Season',
      dataIndex: 'season',
      key: 'season',
      width: 90,
      render: (val) => val || '-',
    },
    {
      title: 'Type',
      dataIndex: 'costingType',
      key: 'costingType',
      width: 70,
      render: (val) => val || 'FOB',
    },
    {
      title: 'Scenario',
      dataIndex: 'scenarioName',
      key: 'scenarioName',
      width: 140,
      ellipsis: true,
      render: (val) => val || '-',
    },
    {
      title: 'Total Price',
      dataIndex: 'totalPrice',
      key: 'totalPrice',
      width: 140,
      align: 'right',
      sorter: true,
      render: (amount, record) => (
        <CurrencyDisplay
          amount={amount}
          currency={record.currency}
          color="var(--success-color)"
        />
      ),
    },
    {
      title: 'Final Price',
      dataIndex: 'finalPrice',
      key: 'finalPrice',
      width: 140,
      align: 'right',
      render: (amount, record) => {
        const hasSizes = record.sizeSummaries && record.sizeSummaries.length > 0;
        const content = (
          <CurrencyDisplay
            amount={amount}
            currency={record.quoteCurrency}
            color="var(--primary-color)"
            secondary={formatCurrency(record.finalPriceUsd || amount, 'USD')}
          />
        );
        if (!hasSizes) return content;
        return (
          <Tooltip
            title={
              <div>
                {record.sizeSummaries.map((ss) => (
                  <div key={ss.sizes}>{ss.sizes}: $ {ss.finalPriceUsd?.toFixed(2)}</div>
                ))}
              </div>
            }
          >
            {content}
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => (
        <StatusTag
          status={status}
          config={COSTING_STATUS_CONFIG}
          getLabel={getStatusLabel}
        />
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          {canView && (
            <ActionButton
              action="view"
              onClick={() => navigate(`/costing/${record.id}`)}
            />
          )}
          {EDITABLE_STATUSES.includes(record.status) && canUpdate && (
            <ActionButton
              action="edit"
              onClick={() => navigate(`/costing/edit/${record.id}`)}
            />
          )}
          {/* Revise a submitted (Final) sheet: opening + saving as draft reverts it
              to Draft and cancels the pending approval (CR C-13). */}
          {record.status === COSTING_STATUS.FINAL && canUpdate && (
            <ActionButton
              action="edit"
              text="Revise"
              onClick={() => navigate(`/costing/edit/${record.id}`)}
            />
          )}
          <ActionButton
            action="duplicate"
            onClick={() => handleDuplicate(record)}
            loading={duplicatingId === record.id}
          />
          <ActionButton
            action="print"
            onClick={() => handlePrint(record)}
            loading={printingId === record.id}
          />
          {(record.status === COSTING_STATUS.APPROVED || record.status === COSTING_STATUS.FINAL) && (
            <ActionButton
              action="history"
              onClick={() => handleViewHistory(record)}
            />
          )}
          {DELETABLE_STATUSES.includes(record.status) && canDelete && (
            <DeleteConfirm
              title="Delete Cost Sheet"
              recordLabel={record.costingId}
              onConfirm={() => handleDelete(record)}
              loading={deletingId === record.id}
            >
              <ActionButton action="delete" />
            </DeleteConfirm>
          )}
        </Space>
      ),
    },
  ], [navigate, handleDelete, handleDuplicate, handlePrint, handleViewHistory, deletingId, duplicatingId, printingId, canView, canUpdate, canDelete]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Costing Module">
        {canAdd && (
          <ActionButton
            action="create"
            text="New Cost Sheet"
            onClick={() => navigate('/costing/new')}
          />
        )}
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search ID, buyer, style..."
          filters={filters}
          onClear={handleClearFilters}
          onRefresh={() => fetchData(pagination.current, pagination.pageSize)}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{ x: 1400 }}
          onChange={handleTableChange}
          pagination={getTablePagination(pagination, 'cost sheets')}
          locale={{
            emptyText: (
              <EmptyState
                title="No cost sheets found"
                description="Try adjusting your filters or create a new cost sheet."
              />
            ),
          }}
        />
      </Card>

      <CostingHistoryModal
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        costingId={historyRecord?.costingId}
        recordId={historyRecord?.id}
      />
    </div>
  );
};

export default CostingList;
