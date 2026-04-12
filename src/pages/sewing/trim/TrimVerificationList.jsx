import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchTrimVerifications } from '../../../services/sewing/sewingService';
import { hasPermission } from '../../../utils/permissions';
import { getTrimStatusLabel, getTrimStatusColor } from '../../../utils/sewingConstants';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const TrimVerificationList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('trim-verification', 'add');

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
      const response = await searchTrimVerifications(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load trim verifications');
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
      title: 'Verification No',
      dataIndex: 'verificationNo',
      key: 'verificationNo',
      sorter: true,
      width: 170,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100 },
    { title: 'Check Type', dataIndex: 'checkType', key: 'checkType', width: 120 },
    {
      title: 'Overall Status',
      dataIndex: 'overallStatus',
      key: 'overallStatus',
      width: 130,
      render: (s) => <Tag color={getTrimStatusColor(s)}>{getTrimStatusLabel(s)}</Tag>,
    },
    { title: 'Verified By', dataIndex: 'verifiedBy', key: 'verifiedBy', width: 140, ellipsis: true },
    {
      title: 'Date',
      dataIndex: 'verificationDate',
      key: 'verificationDate',
      width: 120,
      sorter: true,
      render: (d) => formatDate(d),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => (
        <span style={{ display: 'flex', gap: 4 }}>
          <ActionButton action="view" onClick={() => navigate(`/sewing/trim-verification/view/${record.id}`)} />
        </span>
      ),
    },
  ], [navigate]);

  return (
    <>
      <PageHeader
        title="Trim Verifications"
        onAdd={canAdd ? () => navigate('/sewing/trim-verification/new') : undefined}
        addLabel="New Verification"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search verification no, style..."
          onReset={() => { setSearchText(''); }}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={getTablePagination(pagination)}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
          locale={{ emptyText: <EmptyState description="No trim verifications found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default TrimVerificationList;
