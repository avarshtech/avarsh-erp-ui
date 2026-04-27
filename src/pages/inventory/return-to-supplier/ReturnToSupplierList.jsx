import { useState, useEffect, useMemo, useCallback } from 'react';
import { App, Card, Table, DatePicker, Input, Space, Button } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { searchReturns } from '../../../services/inventory/returnToSupplierService';
import ReturnToSupplierDetailDrawer from './ReturnToSupplierDetailDrawer';
import { formatCurrency } from '../../../utils/formatters';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';

const { RangePicker } = DatePicker;

const ReturnToSupplierList = ({ returnType, refreshKey }) => {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ content: [], totalElements: 0, number: 0, size: 20 });
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(400);
  const [dateRange, setDateRange] = useState(null);
  const [drawerId, setDrawerId] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        size: pageSize,
        returnType,
        returnNumber: debouncedSearch || undefined,
        fromDate: dateRange?.[0]?.format('YYYY-MM-DD'),
        toDate: dateRange?.[1]?.format('YYYY-MM-DD'),
      };
      const res = await searchReturns(params);
      setData(res);
    } catch (e) {
      message.error(e?.response?.data?.message || 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, returnType, debouncedSearch, dateRange, message]);

  useEffect(() => { fetchData(); }, [fetchData, refreshKey]);

  // Reset pagination whenever filters change so the user lands on page 1
  useEffect(() => { setPage(0); }, [returnType, debouncedSearch, dateRange]);

  const columns = useMemo(() => {
    const NOWRAP_CELL = { style: { whiteSpace: 'nowrap' } };
    const base = [
      { title: 'Return DC #', dataIndex: 'returnNumber', width: 180, fixed: 'left' },
      { title: 'Date', dataIndex: 'returnDate', width: 130, render: (v) => (v ? dayjs(v).format('DD-MMM-YYYY') : '—') },
      { title: 'PO Number', dataIndex: 'poNumber', width: 170 },
      { title: 'Supplier', dataIndex: 'supplierName', width: 220 },
      { title: 'GRN Ref', dataIndex: 'grnRef', width: 200 },
      { title: 'Debit Note #', width: 180, render: (_, r) => r.debitNote?.debitNoteNumber || '—' },
      { title: 'Subtotal', dataIndex: 'subtotal', width: 140, render: (v) => formatCurrency(v) },
      { title: 'Tax', dataIndex: 'taxTotal', width: 130, render: (v) => formatCurrency(v) },
      { title: 'Grand Total', dataIndex: 'grandTotal', width: 150, render: (v) => formatCurrency(v) },
      { title: 'Prepared By', dataIndex: 'preparedByName', width: 160 },
    ];
    return base.map((c) => ({
      align: 'center',
      ellipsis: false,
      ...c,
      onCell: () => NOWRAP_CELL,
      onHeaderCell: () => NOWRAP_CELL,
    }));
  }, []);

  return (
    <>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            placeholder="Search Return DC #"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{ width: 260 }}
          />
          <RangePicker
            value={dateRange}
            onChange={(v) => setDateRange(v)}
            format="DD-MMM-YYYY"
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
        </Space>
      </Card>

      <Table
        size="small"
        loading={loading}
        columns={columns}
        dataSource={data.content.map((r) => ({ ...r, key: r.id }))}
        scroll={{ x: 'max-content' }}
        onRow={(r) => ({
          onClick: () => setDrawerId(r.id),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: data.number + 1,
          pageSize: data.size,
          total: data.totalElements,
          showSizeChanger: true,
          onChange: (p, s) => { setPage(p - 1); setPageSize(s); },
        }}
      />

      <ReturnToSupplierDetailDrawer
        returnId={drawerId}
        open={Boolean(drawerId)}
        onClose={() => setDrawerId(null)}
      />
    </>
  );
};

export default ReturnToSupplierList;
