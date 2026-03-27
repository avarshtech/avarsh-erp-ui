import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, Select, Row, Col } from 'antd';
import {
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  DatabaseOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import StatCard from '../../../components/StatCard';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { STOCK_STATUS, STOCK_STATUS_LABELS } from '../../../utils/inventoryConstants';
import { getFabricStock } from '../../../services/inventoryService';
import { formatNumber } from '../../../utils/formatters';
import getFabricStockColumns from './FabricStockColumns';

const STATUS_OPTIONS = Object.entries(STOCK_STATUS).map(([, value]) => ({
  label: STOCK_STATUS_LABELS[value] || value,
  value,
}));

const FabricStockRegister = ({ embedded = false }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [shadeLotFilter, setShadeLotFilter] = useState(undefined);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFabricStock({ search: searchText, status: statusFilter, shadeLot: shadeLotFilter });
      setData(res.content || []);
    } catch {
      message.error('Failed to load fabric stock');
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, shadeLotFilter, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const columns = useMemo(() => getFabricStockColumns(), []);

  const shadeLotOptions = useMemo(() => {
    const lots = [...new Set(data.map((r) => r.shadeLot).filter(Boolean))];
    return lots.map((lot) => ({ label: lot, value: lot }));
  }, [data]);

  const stats = useMemo(() => {
    const totalWeight = data.reduce((sum, r) => sum + (r.weight || 0), 0);
    const inStock = data.filter((r) => r.status === STOCK_STATUS.IN_STOCK).length;
    const reserved = data.filter((r) => r.status === STOCK_STATUS.RESERVED).length;
    const onHold = data.filter((r) => r.status === STOCK_STATUS.ON_HOLD).length;
    return { total: data.length, totalWeight, inStock, reserved, onHold };
  }, [data]);

  const content = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} lg={4}>
          <StatCard title="Total Rolls" value={stats.total} color="var(--primary-color)" icon={<DatabaseOutlined />} />
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <StatCard title="Total Weight (kg)" value={formatNumber(stats.totalWeight, 1)} color="var(--primary-color)" icon={<DashboardOutlined />} />
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <StatCard title="In Stock" value={stats.inStock} color="var(--success-color)" icon={<CheckCircleOutlined />} />
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <StatCard title="Reserved" value={stats.reserved} color="var(--primary-color)" icon={<ClockCircleOutlined />} />
        </Col>
        <Col xs={12} sm={8} lg={5}>
          <StatCard title="On Hold" value={stats.onHold} color="var(--warning-color)" icon={<ExclamationCircleOutlined />} />
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder="Search rolls..." prefix={<SearchOutlined />} style={{ width: 250 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select placeholder="Status" style={{ width: 150 }} allowClear options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <Select placeholder="Shade Lot" style={{ width: 160 }} allowClear options={shadeLotOptions} value={shadeLotFilter} onChange={setShadeLotFilter} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1600 }}
          pagination={getTablePagination({ pageSize: 25 }, 'rolls')}
          locale={{ emptyText: <EmptyState title="No fabric stock found" description="Stock will appear here once GRNs are confirmed" /> }}
        />
      </Card>
    </>
  );

  if (embedded) return content;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Fabric Stock Register">
        <ActionButton action="view" text="Shade Lot View" onClick={() => navigate('/inventory/fabric-stock/shade-lots')} />
      </PageHeader>
      {content}
    </div>
  );
};

export default FabricStockRegister;
