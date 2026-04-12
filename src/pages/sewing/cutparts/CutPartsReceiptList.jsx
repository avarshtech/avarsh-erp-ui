import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { searchCutPartsReceipts } from '../../../services/sewing/sewingService';
import { hasPermission } from '../../../utils/permissions';
import { ActionButton } from '../../../components/buttons';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { formatDate, formatNumber } from '../../../utils/formatters';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const CutPartsReceiptList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [sortField, setSortField] = useState('id');
  const [sortDirection, setSortDirection] = useState('desc');

  const canAdd = hasPermission('cut-parts-receipt', 'add');

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
      const response = await searchCutPartsReceipts(params);
      setData(response.content || []);
      setPagination((prev) => ({
        ...prev,
        current: page || prev.current,
        pageSize: pageSize || prev.pageSize,
        total: response.totalElements || 0,
      }));
    } catch {
      message.error('Failed to load cut parts receipts');
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
      title: 'Receipt No',
      dataIndex: 'receiptNo',
      key: 'receiptNo',
      sorter: true,
      width: 150,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>,
    },
    { title: 'Style', dataIndex: 'styleNo', key: 'styleNo', width: 130, ellipsis: true },
    { title: 'Order', dataIndex: 'orderNo', key: 'orderNo', width: 130, ellipsis: true },
    { title: 'Color', dataIndex: 'color', key: 'color', width: 100 },
    { title: 'Line', dataIndex: 'lineName', key: 'lineName', width: 120, ellipsis: true },
    {
      title: 'Bundles',
      dataIndex: 'totalBundles',
      key: 'totalBundles',
      width: 90,
      align: 'right',
      render: (v) => formatNumber(v),
    },
    {
      title: 'Pieces',
      dataIndex: 'totalPieces',
      key: 'totalPieces',
      width: 90,
      align: 'right',
      render: (v) => formatNumber(v),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s) => (
        <Tag color={s === 'RECEIVED' ? 'success' : s === 'PARTIAL' ? 'warning' : 'default'}>
          {s || 'Draft'}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'receiptDate',
      key: 'receiptDate',
      width: 110,
      sorter: true,
      render: (d) => formatDate(d),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 60,
      fixed: 'right',
      render: (_, record) => (
        <ActionButton action="view" onClick={() => navigate(`/sewing/cut-parts-receipt/${record.id}`)} />
      ),
    },
  ], [navigate]);

  return (
    <>
      <PageHeader
        title="Cut Parts Receipts"
        onAdd={canAdd ? () => navigate('/sewing/cut-parts-receipt/new') : undefined}
        addLabel="New Receipt"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search receipt no, style, order..."
          onReset={() => setSearchText('')}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={getTablePagination(pagination)}
          onChange={handleTableChange}
          scroll={{ x: 1100 }}
          locale={{ emptyText: <EmptyState description="No cut parts receipts found" /> }}
          size="small"
        />
      </Card>
    </>
  );
};

export default CutPartsReceiptList;
