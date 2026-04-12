import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchMeasurementReports } from '../../../services/sewing/sewingService';
import { hasPermission } from '../../../utils/permissions';
import { getMeasurementResultLabel, getMeasurementResultColor } from '../../../utils/sewingConstants';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const MeasurementReportList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('measurement-report', 'add');

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
      const response = await searchMeasurementReports(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load measurement reports');
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
      title: 'Report No',
      dataIndex: 'reportNo',
      key: 'reportNo',
      sorter: true,
      width: 160,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 140, ellipsis: true },
    { title: 'Size', dataIndex: 'sizeInspected', key: 'sizeInspected', width: 80 },
    { title: 'Stage', dataIndex: 'inspectionStage', key: 'inspectionStage', width: 110 },
    {
      title: 'Result',
      dataIndex: 'overallResult',
      key: 'overallResult',
      width: 130,
      render: (s) => <Tag color={getMeasurementResultColor(s)}>{getMeasurementResultLabel(s)}</Tag>,
    },
    { title: 'Inspector', dataIndex: 'inspector', key: 'inspector', width: 140, ellipsis: true },
    {
      title: 'Date',
      dataIndex: 'inspectionDate',
      key: 'inspectionDate',
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
          <ActionButton action="view" onClick={() => navigate(`/sewing/measurement/view/${record.id}`)} />
        </span>
      ),
    },
  ], [navigate]);

  return (
    <>
      <PageHeader
        title="Measurement Reports"
        onAdd={canAdd ? () => navigate('/sewing/measurement/new') : undefined}
        addLabel="New Report"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search report no, style..."
          onReset={() => { setSearchText(''); }}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={getTablePagination(pagination)}
          onChange={handleTableChange}
          scroll={{ x: 950 }}
          locale={{ emptyText: <EmptyState description="No measurement reports found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default MeasurementReportList;
