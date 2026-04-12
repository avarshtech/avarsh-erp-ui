import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchTmbChecks } from '../../../services/cuttingService';
import { hasPermission } from '../../../utils/permissions';
import {
  TMB_RESULT, getTmbResultLabel, getTmbResultColor,
} from '../../../utils/cuttingConstants';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const TMB_RESULT_OPTIONS = [
  { value: TMB_RESULT.PENDING, label: 'Pending' },
  { value: TMB_RESULT.PASSED, label: 'Passed' },
  { value: TMB_RESULT.FAILED, label: 'Failed' },
];

const TmbCheckList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [resultFilter, setResultFilter] = useState(undefined);
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('tmb-check', 'add');
  const canUpdate = hasPermission('tmb-check', 'update');

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
      if (resultFilter) params.overallResult = resultFilter;
      const response = await searchTmbChecks(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load TMB checks');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch, resultFilter]);

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [debouncedSearch, resultFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTableChange = (pag, _f, sorter) => {
    const s = sorter.field || sortField;
    const d = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(s);
    setSortDirection(d);
    fetchData(pag.current, pag.pageSize, s, d);
  };

  const columns = useMemo(() => [
    {
      title: 'Check No',
      dataIndex: 'checkNo',
      key: 'checkNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100 },
    { title: 'Lay No', dataIndex: 'layNo', key: 'layNo', width: 80, align: 'right' },
    {
      title: 'Date',
      dataIndex: 'checkDate',
      key: 'checkDate',
      width: 110,
      sorter: true,
      render: (d) => formatDate(d),
    },
    {
      title: 'Overall Result',
      dataIndex: 'overallResult',
      key: 'overallResult',
      width: 130,
      render: (s) => <Tag color={getTmbResultColor(s)}>{getTmbResultLabel(s)}</Tag>,
    },
    { title: 'QC Inspector', dataIndex: 'qcInspector', key: 'qcInspector', width: 140, ellipsis: true },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <ActionButton action="view" onClick={() => navigate(`/cutting/tmb-check/edit/${record.id}`)} />
          {canUpdate && record.overallResult === TMB_RESULT.PENDING && (
            <ActionButton action="edit" onClick={() => navigate(`/cutting/tmb-check/edit/${record.id}`)} />
          )}
        </span>
      ),
    },
  ], [canUpdate, navigate]);

  const filters = useMemo(() => [
    {
      key: 'result',
      type: 'select',
      placeholder: 'Result',
      value: resultFilter,
      onChange: setResultFilter,
      options: TMB_RESULT_OPTIONS,
      width: 150,
    },
  ], [resultFilter]);

  return (
    <>
      <PageHeader
        title="TMB Checks"
        onAdd={canAdd ? () => navigate('/cutting/tmb-check/new') : undefined}
        addLabel="New TMB Check"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search check no, style, color..."
          filters={filters}
          onReset={() => { setSearchText(''); setResultFilter(undefined); }}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={getTablePagination(pagination)}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <EmptyState description="No TMB checks found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default TmbCheckList;
