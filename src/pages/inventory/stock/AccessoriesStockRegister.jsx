import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, Select, Row, Col } from 'antd';
import {
  SearchOutlined,
  AppstoreOutlined,
  NumberOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import StatCard from '../../../components/StatCard';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { getAccessoriesStock } from '../../../services/inventory/inventoryService';
import { formatNumber } from '../../../utils/formatters';
import getAccessoriesStockColumns from './AccessoriesStockColumns';
import SizeColorMatrix from './SizeColorMatrix';

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
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(undefined);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAccessoriesStock({ search: searchText, category: categoryFilter });
      setData(res.content || []);
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

  const stats = useMemo(() => {
    const totalQty = data.reduce((sum, r) => sum + (r.totalQty || 0), 0);
    const categories = new Set(data.map((r) => r.category)).size;
    return { total: data.length, totalQty, categories };
  }, [data]);

  const expandedRowRender = useCallback((record) => (
    <div style={{ padding: '8px 16px' }}>
      <SizeColorMatrix sizeColorMatrix={record.sizeColorMatrix} />
    </div>
  ), []);

  const content = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <StatCard title="Total Items" value={stats.total} color="var(--primary-color)" icon={<AppstoreOutlined />} />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard title="Total Quantity" value={formatNumber(stats.totalQty)} color="var(--primary-color)" icon={<NumberOutlined />} />
        </Col>
        <Col xs={12} sm={8}>
          <StatCard title="Categories" value={stats.categories} color="var(--success-color)" icon={<TagsOutlined />} />
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
          scroll={{ x: 1400 }}
          pagination={getTablePagination({ pageSize: 25 }, 'items')}
          expandable={{ expandedRowRender }}
          locale={{ emptyText: <EmptyState title="No accessories stock found" description="Stock will appear here once GRNs are confirmed" /> }}
        />
      </Card>
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
