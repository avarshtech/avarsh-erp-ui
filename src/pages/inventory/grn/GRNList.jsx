import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, DatePicker, Select, Row, Col } from 'antd';
import {
  SearchOutlined,
  InboxOutlined,
  ExperimentOutlined,
  DollarOutlined,
  UndoOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission } from '../../../utils/permissions';
import PermissionGuard from '../../../components/PermissionGuard';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import StatCard from '../../../components/StatCard';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { GRN_STATUS } from '../../../utils/inventoryConstants';
import { getGRNList, deleteDraftGRN } from '../../../services/inventory/inventoryService';
import getGRNListColumns from './GRNListColumns';
import GRNViewModal from './GRNViewModal';

const { RangePicker } = DatePicker;

const STATUS_OPTIONS = Object.entries(GRN_STATUS).map(([, value]) => ({
  label: value.replace(/_/g, ' '),
  value,
}));

const TYPE_OPTIONS = [
  { label: 'Fabric', value: 'Fabric' },
  { label: 'Accessories', value: 'Accessories' },
];

const GRNList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [apiStats, setApiStats] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [viewDrawer, setViewDrawer] = useState({ open: false, grn: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGRNList({
        search: searchText || undefined,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
        dateStart: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        dateEnd: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      });
      setData(res.content || []);
      setApiStats(res.stats || null);
    } catch {
      message.error('Failed to load GRN list');
    } finally {
      setLoading(false);
    }
  }, [searchText, typeFilter, statusFilter, dateRange, message]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleView = useCallback((record) => {
    setViewDrawer({ open: true, grn: record });
  }, []);

  const handleEdit = useCallback(
    (record) => {
      const prefix = record.type === 'Fabric' ? '/inventory/grn/fabric/edit' : '/inventory/grn/accessories/edit';
      navigate(`${prefix}/${record.id}`);
    },
    [navigate],
  );

  const handleDelete = useCallback(
    async (record) => {
      try {
        await deleteDraftGRN(record.id, record.type);
        message.success(`${record.grnNumber} deleted`);
        loadData();
      } catch (e) {
        message.error(e.message || 'Failed to delete GRN');
      }
    },
    [message, loadData],
  );

  const columns = useMemo(
    () => getGRNListColumns({ onView: handleView, onEdit: handleEdit, onDelete: handleDelete }),
    [handleView, handleEdit, handleDelete],
  );

  // Stats come from the paginated API response (computed server-side across
  // the full financial year). If the API hasn't returned them yet (first load
  // in flight, or older backend), we fall back to local counts over the
  // currently-loaded page so the cards never go blank.
  const stats = useMemo(() => {
    if (apiStats) {
      return {
        total: apiStats.totalGrns || 0,
        pendingQC: apiStats.pendingQc || 0,
        totalAmount: Number(apiStats.monthValue || 0),
        reversed: apiStats.reversed || 0,
      };
    }
    const pendingQC = data.filter((g) => g.status === GRN_STATUS.QC_PENDING).length;
    const reversed = data.filter((g) => g.status === GRN_STATUS.REVERSED).length;
    const totalAmount = data.reduce((sum, g) => sum + (g.totalAmount || 0), 0);
    return { total: data.length, pendingQC, totalAmount, reversed };
  }, [data, apiStats]);

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader title="Goods Received Notes" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        <PermissionGuard module="inventory" operation="add">
          <ActionButton action="create" text="New Fabric GRN" onClick={() => navigate('/inventory/grn/fabric/new')} />
          <ActionButton action="create" text="New Accessories GRN" onClick={() => navigate('/inventory/grn/accessories/new')} />
        </PermissionGuard>
      </PageHeader>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <StatCard title="Total GRNs" value={stats.total} color="var(--primary-color)" icon={<InboxOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="Pending QC" value={stats.pendingQC} color="var(--warning-color)" icon={<ExperimentOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="This Month Value" value={stats.totalAmount} prefix="₹" color="var(--success-color)" icon={<DollarOutlined />} />
        </Col>
        <Col xs={12} sm={6}>
          <StatCard title="Reversed" value={stats.reversed} color="var(--error-color)" icon={<UndoOutlined />} />
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder="Search GRN..." prefix={<SearchOutlined />} style={{ width: 250 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select placeholder="Type" style={{ width: 150 }} allowClear options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} />
          <Select placeholder="Status" style={{ width: 160 }} allowClear options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <RangePicker style={{ width: 280 }} value={dateRange} onChange={setDateRange} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={getTablePagination({ pageSize: 10 }, 'GRNs')}
          locale={{ emptyText: <EmptyState title="No GRNs found" description="Create a new GRN to get started" /> }}
        />
      </Card>

      <GRNViewModal
        open={viewDrawer.open}
        onClose={() => setViewDrawer((prev) => ({ ...prev, open: false }))}
        grn={viewDrawer.grn}
      />
    </div>
  );
};

export default GRNList;
