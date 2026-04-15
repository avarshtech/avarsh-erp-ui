import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, Select, Row, Col } from 'antd';
import {
  SearchOutlined,
  AppstoreOutlined,
  NumberOutlined,
  DollarCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import StatCard from '../../../components/StatCard';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { getAccessoriesStock } from '../../../services/inventory/inventoryService';
import { formatNumber } from '../../../utils/formatters';
import getAccessoriesStockColumns from './AccessoriesStockColumns';
import AccessoriesStockViewDrawer from './AccessoriesStockViewDrawer';

const CATEGORY_OPTIONS = [
  { label: 'Buttons', value: 'Buttons' },
  { label: 'Zippers', value: 'Zippers' },
  { label: 'Labels', value: 'Labels' },
  { label: 'Thread', value: 'Thread' },
  { label: 'Elastic', value: 'Elastic' },
  { label: 'Interlining', value: 'Interlining' },
  { label: 'Packaging', value: 'Packaging' },
];

const AccessoriesStockRegister = ({ embedded = false }) => {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [apiStats, setApiStats] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [drawer, setDrawer] = useState({ open: false, record: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAccessoriesStock({
        search: searchText || undefined,
        category: categoryFilter || undefined,
      });
      setData(res.content || []);
      setApiStats(res.stats || null);
    } catch {
      message.error('Failed to load accessories stock');
    } finally {
      setLoading(false);
    }
  }, [searchText, categoryFilter, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = useMemo(() => getAccessoriesStockColumns(), []);

  // Stats sourced from the paginated response. See
  // AccessoriesStockService.search() for the server-side computation.
  const stats = apiStats || { totalItems: 0, totalQuantity: 0, totalValue: 0 };

  const content = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <StatCard title="Total Items" value={stats.totalItems} color="var(--primary-color)" icon={<AppstoreOutlined />} />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard title="Total Quantity" value={formatNumber(stats.totalQuantity)} color="var(--success-color)" icon={<NumberOutlined />} />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard title="Total Value (₹)" value={formatNumber(stats.totalValue, 0)} color="var(--warning-color)" icon={<DollarCircleOutlined />} />
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder="Search items..." prefix={<SearchOutlined />} style={{ width: 250 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select placeholder="Category" style={{ width: 160 }} allowClear options={CATEGORY_OPTIONS} value={categoryFilter} onChange={setCategoryFilter} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1240 }}
          pagination={getTablePagination({ pageSize: 25 }, 'items')}
          onRow={(record) => ({
            onClick: () => setDrawer({ open: true, record }),
            style: { cursor: 'pointer' },
          })}
          locale={{ emptyText: <EmptyState title="No accessories stock found" description="Stock will appear here once GRNs are confirmed" /> }}
        />
      </Card>

      <AccessoriesStockViewDrawer
        open={drawer.open}
        record={drawer.record}
        onClose={() => setDrawer({ open: false, record: null })}
      />
    </>
  );

  if (embedded) return content;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Accessories Stock Register" />
      {content}
    </div>
  );
};

export default AccessoriesStockRegister;
