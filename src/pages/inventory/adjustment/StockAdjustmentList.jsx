import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, Select, Tag, Row, Col } from 'antd';
import { SearchOutlined, FileTextOutlined, ClockCircleOutlined, DollarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission } from '../../../utils/permissions';
import PermissionGuard from '../../../components/PermissionGuard';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import StatCard from '../../../components/StatCard';
import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import CurrencyDisplay from '../../../components/CurrencyDisplay';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { ADJUSTMENT_STATUS, getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { ADJUSTMENT_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getAdjustmentList } from '../../../services/inventoryService';
import { formatNumber } from '../../../utils/formatters';
import AdjustmentViewDrawer from './AdjustmentViewDrawer';

const STATUS_OPTIONS = Object.entries(ADJUSTMENT_STATUS).map(([, value]) => ({
  label: getInventoryStatusLabel(value),
  value,
}));

const TYPE_OPTIONS = [
  { label: 'Fabric', value: 'Fabric' },
  { label: 'Accessories', value: 'Accessories' },
];

const StockAdjustmentList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [viewDrawer, setViewDrawer] = useState({ open: false, record: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAdjustmentList();
      setData(res.content || []);
    } catch {
      message.error('Failed to load adjustments');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    let list = data;
    if (typeFilter) list = list.filter((a) => a.type === typeFilter);
    if (statusFilter) list = list.filter((a) => a.status === statusFilter);
    if (searchText) {
      const s = searchText.toLowerCase();
      list = list.filter((a) => a.adjustmentNumber.toLowerCase().includes(s) || a.countedBy.toLowerCase().includes(s));
    }
    return list;
  }, [data, typeFilter, statusFilter, searchText]);

  const stats = useMemo(() => {
    const pending = data.filter((a) => a.status === ADJUSTMENT_STATUS.PENDING_APPROVAL).length;
    const totalVariance = data.reduce((sum, a) => sum + (a.totalVarianceValue || 0), 0);
    return { total: data.length, pending, totalVariance };
  }, [data]);

  const columns = useMemo(() => [
    { title: 'Adjustment #', dataIndex: 'adjustmentNumber', key: 'adjustmentNumber', width: 160, render: (text, record) => <RecordLink text={text} onClick={() => setViewDrawer({ open: true, record })} /> },
    { title: 'Date', dataIndex: 'adjustmentDate', key: 'adjustmentDate', width: 120, render: (d) => dayjs(d).format('DD-MMM-YYYY') },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 120, render: (t) => <Tag color={t === 'Fabric' ? 'blue' : 'purple'}>{t}</Tag> },
    { title: 'Items', dataIndex: 'items', key: 'itemsCount', width: 80, align: 'center', render: (items) => items?.length || 0 },
    { title: 'Total Variance', dataIndex: 'totalVarianceValue', key: 'totalVarianceValue', width: 160, render: (val) => <CurrencyDisplay amount={val} color={val < 0 ? 'var(--error-color)' : 'var(--success-color)'} /> },
    { title: 'Counted By', dataIndex: 'countedBy', key: 'countedBy', width: 150 },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 150, render: (s) => <StatusTag status={s} config={ADJUSTMENT_STATUS_CONFIG} getLabel={getInventoryStatusLabel} /> },
    { title: 'Approver', dataIndex: 'approver', key: 'approver', width: 150, render: (v) => v || '\u2014' },
    {
      title: 'Actions', key: 'actions', width: 100, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <ActionButton action="view" onClick={() => setViewDrawer({ open: true, record })} />
          {record.status === ADJUSTMENT_STATUS.DRAFT && hasPermission('inventory', 'edit') && (
            <ActionButton action="edit" onClick={() => navigate(`/inventory/adjustment/${record.id}`)} />
          )}
        </Space>
      ),
    },
  ], [navigate, setViewDrawer]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Stock Adjustments" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        <PermissionGuard module="inventory" operation="add">
          <ActionButton action="create" text="New Adjustment" onClick={() => navigate('/inventory/adjustment/new')} />
        </PermissionGuard>
      </PageHeader>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}><StatCard title="Total Adjustments" value={stats.total} color="var(--primary-color)" icon={<FileTextOutlined />} /></Col>
        <Col xs={12} sm={8}><StatCard title="Pending Approval" value={stats.pending} color="var(--warning-color)" icon={<ClockCircleOutlined />} /></Col>
        <Col xs={12} sm={8}><StatCard title="Total Variance" value={formatNumber(Math.abs(stats.totalVariance), 2)} prefix="₹" color={stats.totalVariance < 0 ? 'var(--error-color)' : 'var(--success-color)'} icon={<DollarOutlined />} /></Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder="Search adjustments..." prefix={<SearchOutlined />} style={{ width: 250 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select placeholder="Status" style={{ width: 170 }} allowClear options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <Select placeholder="Type" style={{ width: 150 }} allowClear options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          scroll={{ x: 1200 }}
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
