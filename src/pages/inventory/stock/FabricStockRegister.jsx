import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, Select, Row, Col } from 'antd';
import {
  SearchOutlined,
  AppstoreOutlined,
  TagsOutlined,
  DollarCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../../components/PageHeader';
import StatCard from '../../../components/StatCard';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { getFabricStock } from '../../../services/inventory/inventoryService';
import { formatNumber } from '../../../utils/formatters';
import getFabricStockColumns from './FabricStockColumns';
import FabricStockViewDrawer from './FabricStockViewDrawer';

const FabricStockRegister = ({ embedded = false }) => {
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [apiStats, setApiStats] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState(undefined);
  const [drawer, setDrawer] = useState({ open: false, record: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFabricStock({
        search: searchText || undefined,
        subCategory: subCategoryFilter || undefined,
      });
      setItems(res.content || []);
      setApiStats(res.stats || null);
    } catch {
      message.error('Failed to load fabric stock');
    } finally {
      setLoading(false);
    }
  }, [searchText, subCategoryFilter, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = useMemo(() => getFabricStockColumns(), []);

  const subCategoryOptions = useMemo(() => {
    const set = new Set(items.map((r) => r.subCategory).filter(Boolean));
    return Array.from(set).map((s) => ({ label: s, value: s }));
  }, [items]);

  // Stats come from the server-side paginated response (apiStats). Fallback to
  // zeros when the stats block is missing — UI still renders the cards cleanly.
  const stats = apiStats || { totalItems: 0, subCategoryCount: 0, subCategoryValue: 0 };

  const content = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <StatCard title="Total Fabric Items" value={stats.totalItems} color="var(--primary-color)" icon={<AppstoreOutlined />} />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard title="Sub Category Count" value={stats.subCategoryCount} color="var(--success-color)" icon={<TagsOutlined />} />
        </Col>
        <Col xs={24} sm={8}>
          <StatCard title="Sub Category Value (₹)" value={formatNumber(stats.subCategoryValue, 0)} color="var(--warning-color)" icon={<DollarCircleOutlined />} />
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="Search item code / description / GRN..."
            prefix={<SearchOutlined />}
            style={{ width: 320 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Select
            placeholder="Sub Category"
            style={{ width: 180 }}
            allowClear
            options={subCategoryOptions}
            value={subCategoryFilter}
            onChange={setSubCategoryFilter}
          />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={items}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={getTablePagination({ pageSize: 25 }, 'items')}
          onRow={(record) => ({
            onClick: () => setDrawer({ open: true, record }),
            style: { cursor: 'pointer' },
          })}
          locale={{ emptyText: <EmptyState title="No fabric stock found" description="Stock will appear here once GRNs are confirmed" /> }}
        />
      </Card>

      <FabricStockViewDrawer
        open={drawer.open}
        record={drawer.record}
        onClose={() => setDrawer({ open: false, record: null })}
      />
    </>
  );

  if (embedded) return content;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Fabric Stock Register" />
      {content}
    </div>
  );
};

export default FabricStockRegister;
