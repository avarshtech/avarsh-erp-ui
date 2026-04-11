import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchCuttingReports } from '../../../services/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import {
  CUT_REPORT_STATUS, getCutReportLabel, getCutReportColor,
} from '../../../utils/cuttingConstants';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const CUT_REPORT_STATUS_OPTIONS = [
  { value: CUT_REPORT_STATUS.DRAFT, label: 'Draft' },
  { value: CUT_REPORT_STATUS.IN_PROGRESS, label: 'In Progress' },
  { value: CUT_REPORT_STATUS.COMPLETED, label: 'Completed' },
];

const CUT_REPORT_EDITABLE = [CUT_REPORT_STATUS.DRAFT, CUT_REPORT_STATUS.IN_PROGRESS];

const CuttingReportList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('cutting-report', 'add');
  const canUpdate = hasPermission('cutting-report', 'update');

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
      const response = await searchCuttingReports(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load cutting reports');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, statusFilter]);

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

  const columns = useMemo(() => [
    {
      title: 'Report No',
      dataIndex: 'reportNo',
      key: 'reportNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Buyer', dataIndex: 'buyerName', key: 'buyerName', width: 160, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100 },
    {
      title: 'Fab Required',
      dataIndex: 'fabricRequiredKg',
      key: 'fabricRequiredKg',
      width: 120,
      align: 'right',
      render: (v) => v != null ? Number(v).toFixed(3) : '-',
    },
    {
      title: 'Fab Received',
      dataIndex: 'fabricReceivedKg',
      key: 'fabricReceivedKg',
      width: 120,
      align: 'right',
      render: (v) => v != null ? Number(v).toFixed(3) : '-',
    },
    {
      title: 'Balance',
      dataIndex: 'balanceKg',
      key: 'balanceKg',
      width: 110,
      align: 'right',
      render: (v) => {
        const val = v != null ? Number(v) : null;
        return val != null ? (
          <span style={{ color: val < 0 ? 'red' : 'inherit' }}>{val.toFixed(3)}</span>
        ) : '-';
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s) => <Tag color={getCutReportColor(s)}>{getCutReportLabel(s)}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          {canUpdate && CUT_REPORT_EDITABLE.includes(record.status) && (
            <ActionButton action="edit" onClick={() => navigate(`/cutting/report/edit/${record.id}`)} />
          )}
        </span>
      ),
    },
  ], [canUpdate, navigate]);

  const filters = useMemo(() => [
    {
      key: 'status',
      type: 'select',
      placeholder: 'Status',
      value: statusFilter,
      onChange: setStatusFilter,
      options: CUT_REPORT_STATUS_OPTIONS,
      width: 150,
    },
  ], [statusFilter]);

  return (
    <>
      <PageHeader
        title="Cutting Reports"
        onAdd={canAdd ? () => navigate('/cutting/report/new') : undefined}
        addLabel="New Report"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search report no, style, buyer..."
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
          scroll={{ x: 1200 }}
          locale={{ emptyText: <EmptyState description="No cutting reports found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default CuttingReportList;
