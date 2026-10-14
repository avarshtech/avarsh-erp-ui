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
import useServerList from '../../hooks/useServerList';

const { Text } = Typography;

const COSTING_FILTERS = { buyerId: undefined, season: undefined, dateRange: null, status: undefined };
const COSTING_LIST_OPTIONS = {
  defaultSort: { field: 'id', order: 'descend' },
  urlState: true,
  pageSize: 25,
  filterTypes: { buyerId: 'number', dateRange: 'dateRange' },
};

const fetchCostingPage = ({ page, size, search, sort, direction, status, buyerId, season, dateRange }) => {
  const params = { page: page - 1, size, sort, direction };
  if (search) params.search = search;
  if (status) params.status = status;
  if (buyerId) params.buyerId = buyerId;
  if (season) params.season = season;
  if (dateRange && dateRange.length === 2) {
    params.dateFrom = dateRange[0].format('YYYY-MM-DD');
    params.dateTo = dateRange[1].format('YYYY-MM-DD');
  }
  return searchCostSheets(params);
};

const CostingList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  // Page, sort, search and filters live in the URL, so a refresh or the way back from the sheet keeps them;
  // with no column sorter the list is newest first (id descending), 25 rows a page, as it always was.
  const list = useServerList(fetchCostingPage, COSTING_FILTERS, 'Failed to load cost sheets', COSTING_LIST_OPTIONS);
  const { load: reload, goToFirstPage, sortOrderFor, filters: listFilters, setFilter } = list;
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

  // Fetch buyer options on mount
  useEffect(() => {
    getBuyers()
      .then((buyers) =>
        setBuyerOptions((buyers || []).map((b) => ({ value: b.id, label: b.name })))
      )
      .catch(() => {});
  }, []);

  const handleDelete = useCallback(async (record) => {
    setDeletingId(record.id);
    try {
      await deleteCostSheet(record.id);
      message.success(`${record.costingId} deleted successfully`);
      reload();
    } catch {
      message.error('Failed to delete cost sheet');
    } finally {
      setDeletingId(null);
    }
  }, [reload, message]);

  // A duplicate is the newest sheet: show page 1, where it lands
  const onFirstPage = list.pagination.current === 1;
  const handleDuplicate = useCallback(async (record) => {
    setDuplicatingId(record.id);
    try {
      const dup = await duplicateCostSheet(record.id);
      message.success(`Duplicated as ${dup.costingId}`);
      if (onFirstPage) reload();
      else goToFirstPage();
    } catch {
      message.error('Failed to duplicate cost sheet');
    } finally {
      setDuplicatingId(null);
    }
  }, [reload, goToFirstPage, onFirstPage, message]);

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
        value: listFilters.buyerId,
        onChange: setFilter('buyerId'),
        options: buyerOptions,
      },
    },
    {
      type: 'select',
      span: { xs: 12, sm: 8, md: 3, lg: 3 },
      props: {
        placeholder: 'Season',
        value: listFilters.season,
        onChange: setFilter('season'),
        options: SEASONS,
        showSearch: false,
      },
    },
    {
      type: 'rangePicker',
      span: { xs: 24, sm: 12, md: 5, lg: 4 },
      props: {
        placeholder: ['Date From', 'Date To'],
        value: listFilters.dateRange,
        onChange: setFilter('dateRange'),
        allowClear: true,
      },
    },
    {
      type: 'select',
      span: { xs: 12, sm: 8, md: 3, lg: 3 },
      props: {
        placeholder: 'Status',
        value: listFilters.status,
        onChange: setFilter('status'),
        options: Object.values(COSTING_STATUS).map((s) => ({
          label: getStatusLabel(s),
          value: s,
        })),
        showSearch: false,
      },
    },
  ], [listFilters, setFilter, buyerOptions]);

  const columns = useMemo(() => [
    {
      title: 'Costing ID',
      dataIndex: 'costingId',
      key: 'costingId',
      fixed: 'left',
      width: 160,
      sorter: true,
      sortOrder: sortOrderFor('costingId'),
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
      sortOrder: sortOrderFor('date'),
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
      sortOrder: sortOrderFor('totalPrice'),
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
          {/* Duplicating creates a new cost sheet, so it needs the same right
              as creating one. It was rendered unconditionally, which let a
              view-only role add cost sheets. */}
          {canAdd && (
            <ActionButton
              action="duplicate"
              onClick={() => handleDuplicate(record)}
              loading={duplicatingId === record.id}
            />
          )}
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
  ], [navigate, handleDelete, handleDuplicate, handlePrint, handleViewHistory, deletingId, duplicatingId, printingId, canView, canUpdate, canDelete, canAdd, sortOrderFor]);

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
          searchText={list.searchText}
          onSearchChange={(e) => list.setSearchText(e.target.value)}
          searchPlaceholder="Search ID, buyer, style..."
          filters={filters}
          onClear={list.resetFilters}
          onRefresh={reload}
          style={{ marginBottom: 16 }}
        />

        <Table
          columns={columns}
          dataSource={list.rows}
          loading={list.loading}
          rowKey="id"
          scroll={{ x: 1400 }}
          onChange={list.onTableChange}
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'cost sheets')}
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
