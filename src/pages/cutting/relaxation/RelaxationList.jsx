import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag, Button } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { searchRelaxations } from '../../../services/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import {
  RELAXATION_STATUS,
  getRelaxationLabel,
  getRelaxationColor,
} from '../../../utils/cuttingConstants';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const RELAXATION_STATUS_OPTIONS = Object.entries({
  [RELAXATION_STATUS.IN_PROGRESS]: 'In Progress',
  [RELAXATION_STATUS.COMPLETED]: 'Completed',
  [RELAXATION_STATUS.REPORT_GENERATED]: 'Report Generated',
}).map(([value, label]) => ({ value, label }));

const RelaxationList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('fabric-relaxation', 'add');

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
      const response = await searchRelaxations(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load relaxations');
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

  // Format duration in hours from two datetime strings
  const formatDuration = useCallback((startTime, endTime) => {
    if (!startTime || !endTime) return '—';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end - start;
    if (diffMs < 0) return '—';
    const hours = diffMs / (1000 * 60 * 60);
    return `${hours.toFixed(2)} hrs`;
  }, []);

  const columns = useMemo(() => [
    {
      title: 'Relaxation No',
      dataIndex: 'relaxationNo',
      key: 'relaxationNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 130, ellipsis: true },
    {
      title: 'Fabric Type',
      dataIndex: 'fabricType',
      key: 'fabricType',
      width: 130,
      ellipsis: true,
    },
    {
      title: 'Start Time',
      dataIndex: 'startTime',
      key: 'startTime',
      width: 160,
      sorter: true,
      render: (d) => d ? new Date(d).toLocaleString() : '—',
    },
    {
      title: 'End Time',
      dataIndex: 'endTime',
      key: 'endTime',
      width: 160,
      render: (d) => d ? new Date(d).toLocaleString() : '—',
    },
    {
      title: 'Duration (hrs)',
      key: 'duration',
      width: 120,
      align: 'right',
      render: (_, record) => formatDuration(record.startTime, record.endTime),
    },
    {
      title: 'Shrinkage Before %',
      dataIndex: 'shrinkageBeforePct',
      key: 'shrinkageBeforePct',
      width: 150,
      align: 'right',
      render: (v) => (v != null ? `${Number(v).toFixed(2)}%` : '—'),
    },
    {
      title: 'Shrinkage After %',
      dataIndex: 'shrinkageAfterPct',
      key: 'shrinkageAfterPct',
      width: 140,
      align: 'right',
      render: (v) => (v != null ? `${Number(v).toFixed(2)}%` : '—'),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (s) => <Tag color={getRelaxationColor(s)}>{getRelaxationLabel(s)}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          {record.status === RELAXATION_STATUS.IN_PROGRESS && (
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => navigate(`/cutting/relaxation/complete/${record.id}`)}
            >
              Complete
            </Button>
          )}
        </span>
      ),
    },
  ], [navigate, formatDuration]);

  const filters = useMemo(() => [
    {
      key: 'status',
      type: 'select',
      placeholder: 'Status',
      value: statusFilter,
      onChange: setStatusFilter,
      options: RELAXATION_STATUS_OPTIONS,
      width: 160,
    },
  ], [statusFilter]);

  return (
    <>
      <PageHeader
        title="Fabric Relaxation"
        onAdd={canAdd ? () => navigate('/cutting/relaxation/new') : undefined}
        addLabel="Start Relaxation"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search relaxation no, style..."
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
          scroll={{ x: 1350 }}
          locale={{ emptyText: <EmptyState description="No fabric relaxations found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default RelaxationList;
