import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, Select, DatePicker, Row, Col, Typography } from 'antd';
import { SearchOutlined, FileTextOutlined, SwapOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PermissionGuard from '../../../components/PermissionGuard';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import StatCard from '../../../components/StatCard';
import RecordLink from '../../../components/RecordLink';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { getAdjustmentList } from '../../../services/inventory/inventoryService';
import { getAllCategories, getAllSubCategories } from '../../../services/master/masterDataService';
import { useStore } from '../../../context/StoreContext';
import { formatNumber } from '../../../utils/formatters';
import AdjustmentViewDrawer from './AdjustmentViewDrawer';

const { RangePicker } = DatePicker;
const { Text } = Typography;

const fyStart = (today = dayjs()) => (today.month() + 1 >= 4 ? today.startOf('year').month(3) : today.subtract(1, 'year').startOf('year').month(3)).startOf('day');
const fyEnd = (today = dayjs()) => fyStart(today).add(1, 'year').subtract(1, 'day').endOf('day');

const unwrapList = (res) => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.content)) return res.content;
  if (Array.isArray(res?.data?.content)) return res.data.content;
  return [];
};

const StockAdjustmentList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const store = useStore();
  const { categories: storeCategories, subCategories: storeSubCategories } = store;

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [categoryId, setCategoryId] = useState(undefined);
  const [subCategoryId, setSubCategoryId] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [viewDrawer, setViewDrawer] = useState({ open: false, record: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const listRes = await getAdjustmentList();
      setData(listRes.content || []);
    } catch {
      message.error('Failed to load adjustments');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { loadData(); }, [loadData]);

  // Hydrate StoreContext on mount if master lists haven't been cached yet
  // (e.g., user navigates here directly without visiting MasterDashboard first).
  useEffect(() => {
    if (!storeCategories || storeCategories.length === 0) {
      getAllCategories()
        .then((res) => store.setData('categories', unwrapList(res)))
        .catch(() => {});
    }
    if (!storeSubCategories || storeSubCategories.length === 0) {
      getAllSubCategories()
        .then((res) => store.setData('subCategories', unwrapList(res)))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subCategoryOptions = useMemo(() => {
    const list = storeSubCategories || [];
    const scoped = categoryId ? list.filter((s) => s.categoryId === categoryId) : list;
    return scoped.map((s) => ({ value: s.id, label: s.name }));
  }, [storeSubCategories, categoryId]);

  const filtered = useMemo(() => {
    let list = data;
    if (categoryId) list = list.filter((a) => a.categoryId === categoryId);
    if (subCategoryId) list = list.filter((a) => a.subCategoryId === subCategoryId);
    if (dateRange && dateRange[0] && dateRange[1]) {
      const [from, to] = dateRange;
      list = list.filter((a) => {
        const d = dayjs(a.adjustmentDate);
        return d.isAfter(from.startOf('day').subtract(1, 'ms')) && d.isBefore(to.endOf('day').add(1, 'ms'));
      });
    }
    if (searchText) {
      const s = searchText.toLowerCase();
      list = list.filter((a) =>
        a.adjustmentNumber?.toLowerCase().includes(s) ||
        a.adjustedBy?.toLowerCase().includes(s),
      );
    }
    return list;
  }, [data, categoryId, subCategoryId, dateRange, searchText]);

  const stats = useMemo(() => {
    const start = fyStart();
    const end = fyEnd();
    const inFy = filtered.filter((a) => {
      const d = dayjs(a.adjustmentDate);
      return d.isAfter(start.subtract(1, 'ms')) && d.isBefore(end.add(1, 'ms'));
    });
    const totalVariance = filtered.reduce((sum, a) => sum + Math.abs(a.totalVarianceQty || 0), 0);
    return { totalFy: inFy.length, totalVariance };
  }, [filtered]);

  const categoryOptions = useMemo(
    () => (storeCategories || []).map((c) => ({ value: c.id, label: c.name })),
    [storeCategories],
  );

  const handleCategoryChange = (v) => {
    setCategoryId(v);
    setSubCategoryId(undefined);
  };

  const columns = useMemo(() => [
    {
      title: 'Adjustment #', dataIndex: 'adjustmentNumber', key: 'adjustmentNumber', width: 170, align: 'center',
      render: (text, record) => <RecordLink text={text} onClick={() => setViewDrawer({ open: true, record })} />,
    },
    { title: 'Date', dataIndex: 'adjustmentDate', key: 'adjustmentDate', width: 120, align: 'center', render: (d) => dayjs(d).format('DD-MMM-YYYY') },
    { title: 'Category', dataIndex: 'categoryName', key: 'categoryName', width: 130, align: 'center' },
    { title: 'Items', dataIndex: 'items', key: 'itemsCount', width: 80, align: 'center', render: (items) => items?.length || 0 },
    {
      title: 'Total Variance', key: 'totalVarianceQty', width: 160, align: 'center',
      render: (_, r) => {
        const q = r.totalVarianceQty || 0;
        return (
          <Text strong style={{ color: q < 0 ? 'var(--error-color)' : q > 0 ? 'var(--success-color)' : undefined }}>
            {q >= 0 ? '+' : ''}{formatNumber(q, 2)} <Text type="secondary">{r.uom}</Text>
          </Text>
        );
      },
    },
    { title: 'Adjusted By', dataIndex: 'adjustedBy', key: 'adjustedBy', width: 160, align: 'center' },
    {
      title: 'Actions', key: 'actions', width: 110, fixed: 'right', align: 'center',
      render: (_, record) => (
        <Space size="small">
          <ActionButton action="view" onClick={() => setViewDrawer({ open: true, record })} />
        </Space>
      ),
    },
  ], []);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Stock Adjustments" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        <PermissionGuard module="inventory-adjustment" operation="add">
          <ActionButton action="create" text="New Adjustment" onClick={() => navigate('/inventory/adjustment/new')} />
        </PermissionGuard>
      </PageHeader>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12}>
          <StatCard title="Total Adjustments" value={stats.totalFy} color="var(--primary-color)" icon={<FileTextOutlined />} />
        </Col>
        <Col xs={12} sm={12}>
          <StatCard title="Total Variance" value={formatNumber(stats.totalVariance, 2)} color="var(--warning-color)" icon={<SwapOutlined />} />
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder="Search adjustments..." prefix={<SearchOutlined />} style={{ width: 260 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select placeholder="Category" style={{ width: 180 }} allowClear options={categoryOptions} value={categoryId} onChange={handleCategoryChange} />
          <Select placeholder="Sub-Category" style={{ width: 180 }} allowClear options={subCategoryOptions} value={subCategoryId} onChange={setSubCategoryId} disabled={!categoryId} />
          <RangePicker style={{ width: 280 }} value={dateRange} onChange={setDateRange} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={getTablePagination({ pageSize: 10 }, 'adjustments')}
          locale={{ emptyText: <EmptyState title="No adjustments found" description="Create a new stock adjustment to get started" /> }}
        />
      </Card>

      <AdjustmentViewDrawer
        open={viewDrawer.open}
        onClose={() => setViewDrawer({ open: false, record: null })}
        record={viewDrawer.record}
      />
    </div>
  );
};

export default StockAdjustmentList;
