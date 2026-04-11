import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchIncentives } from '../../../services/sewing/sewingService';
import { hasPermission } from '../../../utils/permissions';
import { INCENTIVE_STATUS } from '../../../utils/sewingConstants';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatPercentage, formatCurrency } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const getIncentiveStatusLabel = (s) => ({
  DRAFT: 'Draft', APPROVED: 'Approved',
}[s] || s || '');

const getIncentiveStatusColor = (s) => ({
  DRAFT: 'default', APPROVED: 'success',
}[s] || 'default');

const IncentiveList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('incentive-calc', 'add');

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
      const response = await searchIncentives(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load incentive calculations');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, sortField, sortDirection, debouncedSearch]);

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [debouncedSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTableChange = (pag, _f, sorter) => {
    const s = sorter.field || sortField;
    const d = sorter.order === 'ascend' ? 'asc' : 'desc';
    setSortField(s);
    setSortDirection(d);
    fetchData(pag.current, pag.pageSize, s, d);
  };

  const columns = useMemo(() => [
    {
      title: 'Calc No',
      dataIndex: 'calcNo',
      key: 'calcNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Line', dataIndex: 'lineCode', key: 'lineCode', width: 100 },
    { title: 'Period', dataIndex: 'period', key: 'period', width: 180, ellipsis: true },
    {
      title: 'Efficiency %',
      dataIndex: 'efficiencyPct',
      key: 'efficiencyPct',
      width: 110,
      align: 'right',
      render: (val) => formatPercentage(val),
    },
    {
      title: 'Total Incentive',
      dataIndex: 'totalIncentive',
      key: 'totalIncentive',
      width: 140,
      align: 'right',
      render: (val) => formatCurrency(val),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s) => <Tag color={getIncentiveStatusColor(s)}>{getIncentiveStatusLabel(s)}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <ActionButton action="view" onClick={() => navigate(`/sewing/incentive/view/${record.id}`)} />
        </span>
      ),
    },
  ], [navigate]);

  return (
    <>
      <PageHeader
        title="Incentive Calculations"
        onAdd={canAdd ? () => navigate('/sewing/incentive/new') : undefined}
        addLabel="New Calculation"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search calc no, line..."
          onReset={() => { setSearchText(''); }}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={getTablePagination(pagination)}
          onChange={handleTableChange}
          scroll={{ x: 900 }}
          locale={{ emptyText: <EmptyState description="No incentive calculations found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default IncentiveList;
