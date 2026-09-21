import { useState, useEffect, useMemo, useCallback } from 'react';
import { App, Card, Table, DatePicker, Input, Select, Space, Button, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import PermissionGuard from '../../../components/PermissionGuard';
import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { useBranch } from '../../../context/BranchContext';
import { searchTransfers } from '../../../services/inventory/stockTransferService';
import { formatNumber } from '../../../utils/formatters';
import { TRANSFER_STATUS, TRANSFER_STATUS_CONFIG, TRANSFER_STATUS_OPTIONS, getTransferStatusLabel } from './transferConstants';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const EMPTY_PAGE = { content: [], totalElements: 0, pageNumber: 0, pageSize: 20 };

/**
 * Inter-branch stock transfers. The list follows the header switcher: the
 * working branch sees what it sent and what is on its way in.
 */
const StockTransferList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { activeBranchId } = useBranch();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(EMPTY_PAGE);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(400);
  const [status, setStatus] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await searchTransfers({
        page,
        size: pageSize,
        search: debouncedSearch || undefined,
        status,
        dateFrom: dateRange?.[0]?.format('YYYY-MM-DD'),
        dateTo: dateRange?.[1]?.format('YYYY-MM-DD'),
      });
      setData(res || EMPTY_PAGE);
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to load stock transfers');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debouncedSearch, status, dateRange, message, activeBranchId]); // eslint-disable-line react-hooks/exhaustive-deps -- refetch when the working branch (X-Branch-Id) changes

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { setPage(0); }, [debouncedSearch, status, dateRange]);

  const columns = useMemo(() => [
    {
      title: 'Transfer #', dataIndex: 'transferNo', key: 'transferNo', width: 170, align: 'center', fixed: 'left',
      render: (text, r) => <RecordLink text={text} onClick={() => navigate(`/inventory/transfer/${r.id}`)} />,
    },
    { title: 'Date', dataIndex: 'transferDate', key: 'transferDate', width: 120, align: 'center', render: (d) => (d ? dayjs(d).format('DD-MMM-YYYY') : '—') },
    { title: 'From', dataIndex: 'fromBranchName', key: 'fromBranchName', width: 160, align: 'center' },
    { title: 'To', dataIndex: 'toBranchName', key: 'toBranchName', width: 160, align: 'center' },
    { title: 'Lines', dataIndex: 'lineCount', key: 'lineCount', width: 80, align: 'center' },
    { title: 'Qty', dataIndex: 'totalQty', key: 'totalQty', width: 120, align: 'center', render: (q) => <Text strong>{formatNumber(q || 0, 3)}</Text> },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 130, align: 'center',
      render: (s) => <StatusTag status={s} config={TRANSFER_STATUS_CONFIG} getLabel={getTransferStatusLabel} />,
    },
    { title: 'Challan #', dataIndex: 'challanNo', key: 'challanNo', width: 130, align: 'center', render: (v) => v || '—' },
    { title: 'Dispatched By', dataIndex: 'dispatchedByName', key: 'dispatchedByName', width: 150, align: 'center', render: (v) => v || '—' },
    {
      title: 'Actions', key: 'actions', width: 110, fixed: 'right', align: 'center',
      render: (_, r) => (
        <Space size="small">
          <ActionButton action="view" onClick={() => navigate(`/inventory/transfer/${r.id}`)} />
          {r.status === TRANSFER_STATUS.DRAFT && (
            <PermissionGuard module="inventory-transfer" operation="update">
              <ActionButton action="edit" onClick={() => navigate(`/inventory/transfer/${r.id}`)} />
            </PermissionGuard>
          )}
        </Space>
      ),
    },
  ], [navigate]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Stock Transfers" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        <PermissionGuard module="inventory-transfer" operation="add">
          <ActionButton action="create" text="New Transfer" onClick={() => navigate('/inventory/transfer/new')} />
        </PermissionGuard>
      </PageHeader>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            name="transferSearch"
            placeholder="Search transfer #, challan, transporter"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 300 }}
          />
          <Select
            aria-label="Status"
            placeholder="Status"
            style={{ width: 160 }}
            allowClear
            options={TRANSFER_STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />
          <RangePicker value={dateRange} onChange={setDateRange} format="DD-MMM-YYYY" allowClear />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
        </Space>
        <Table
          rowKey="id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={data.content || []}
          scroll={{ x: 1250 }}
          pagination={{
            current: (data.pageNumber ?? 0) + 1,
            pageSize: data.pageSize || pageSize,
            total: data.totalElements || 0,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} transfers`,
            onChange: (p, s) => { setPage(p - 1); setPageSize(s); },
          }}
          locale={{ emptyText: <EmptyState title="No stock transfers" description="Move stock between branches with a new transfer" /> }}
        />
      </Card>
    </div>
  );
};

export default StockTransferList;
