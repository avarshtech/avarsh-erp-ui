import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, Select, DatePicker, Row, Col } from 'antd';
import { SearchOutlined, ScissorOutlined, SyncOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import StatCard from '../../../components/StatCard';
import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { ISSUE_STATUS, ISSUE_STATUS_LABELS, getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { ISSUE_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getFabricIssueList } from '../../../services/inventory/inventoryService';
import { formatNumber } from '../../../utils/formatters';
import IssueViewDrawer from './IssueViewDrawer';

const { RangePicker } = DatePicker;

const STATUS_OPTIONS = Object.entries(ISSUE_STATUS).map(([, value]) => ({
  label: ISSUE_STATUS_LABELS[value] || value,
  value,
}));

const FabricIssueList = ({ embedded = false }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [viewDrawer, setViewDrawer] = useState({ open: false, record: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFabricIssueList({ search: searchText, status: statusFilter });
      setData(res.content || []);
    } catch {
      message.error('Failed to load fabric issues');
    } finally {
      setLoading(false);
    }
  }, [searchText, statusFilter, message]);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => {
    const active = data.filter((d) => d.status === ISSUE_STATUS.ISSUED || d.status === ISSUE_STATUS.PARTIAL).length;
    const totalWeight = data.reduce((sum, d) => sum + (d.totalWeight || 0), 0);
    return { total: data.length, active, totalWeight };
  }, [data]);

  const filtered = useMemo(() => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return data;
    return data.filter((d) => {
      const dt = dayjs(d.issueDate);
      return dt.isAfter(dateRange[0].startOf('day')) && dt.isBefore(dateRange[1].endOf('day'));
    });
  }, [data, dateRange]);

  const columns = useMemo(() => [
    { title: 'Issue #', dataIndex: 'issueNumber', key: 'issueNumber', width: 140, render: (val, record) => <RecordLink text={val} onClick={() => setViewDrawer({ open: true, record })} /> },
    { title: 'Date', dataIndex: 'issueDate', key: 'issueDate', width: 110, render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Production Order', dataIndex: 'productionOrder', key: 'productionOrder', width: 150 },
    { title: 'Style', dataIndex: 'style', key: 'style', width: 120 },
    { title: 'Fabric', dataIndex: 'fabric', key: 'fabric', width: 160, ellipsis: true },
    { title: 'Rolls', dataIndex: 'rollsIssued', key: 'rollsIssued', width: 80, align: 'center' },
    { title: 'Total Wt (kg)', dataIndex: 'totalWeight', key: 'totalWeight', width: 110, align: 'right', render: (v) => formatNumber(v, 1) },
    { title: 'BOM Req (kg)', dataIndex: 'bomRequired', key: 'bomRequired', width: 110, align: 'right', render: (v) => formatNumber(v, 1) },
    {
      title: 'Variance', key: 'variance', width: 100, align: 'right',
      render: (_, r) => {
        const variance = (r.totalWeight || 0) - (r.bomRequired || 0);
        const pct = r.bomRequired ? Math.abs(variance / r.bomRequired) * 100 : 0;
        const color = pct <= 5 ? 'var(--success-color)' : 'var(--error-color)';
        return <span style={{ color, fontWeight: 600 }}>{variance >= 0 ? '+' : ''}{formatNumber(variance, 1)}</span>;
      },
    },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 140, render: (status) => <StatusTag status={status} config={ISSUE_STATUS_CONFIG} getLabel={getInventoryStatusLabel} /> },
    {
      title: 'Actions', key: 'actions', width: 100, fixed: 'right', align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <ActionButton action="view" size="small" onClick={() => setViewDrawer({ open: true, record })} />
          {hasPermission('inventory', 'edit') && record.status === ISSUE_STATUS.DRAFT && (
            <ActionButton action="edit" size="small" onClick={() => navigate(`/inventory/issue/fabric/${record.id}`)} />
          )}
        </Space>
      ),
    },
  ], [navigate, setViewDrawer]);

  const drawer = (
    <IssueViewDrawer
      open={viewDrawer.open}
      onClose={() => setViewDrawer({ open: false, record: null })}
      record={viewDrawer.record}
      type="fabric"
    />
  );

  const content = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}><StatCard title="Total Issues" value={stats.total} color="var(--primary-color)" icon={<ScissorOutlined />} /></Col>
        <Col xs={12} sm={8}><StatCard title="Active Issues" value={stats.active} color="var(--warning-color)" icon={<SyncOutlined />} /></Col>
        <Col xs={12} sm={8}><StatCard title="Total Weight Issued" value={formatNumber(stats.totalWeight, 1)} suffix="kg" color="var(--success-color)" icon={<DatabaseOutlined />} /></Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder="Search issues..." prefix={<SearchOutlined />} style={{ width: 250 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select placeholder="Status" style={{ width: 170 }} allowClear options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <RangePicker style={{ width: 280 }} value={dateRange} onChange={setDateRange} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={getTablePagination({ pageSize: 10 }, 'fabric issues')}
          locale={{ emptyText: <EmptyState title="No fabric issues found" description="Create a new fabric issue to get started" /> }}
        />
      </Card>
      {drawer}
    </>
  );

  if (embedded) return content;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Fabric Issue">
        {hasPermission('inventory', 'add') && (
          <ActionButton action="create" text="New Issue" onClick={() => navigate('/inventory/issue/fabric/new')} />
        )}
      </PageHeader>
      {content}
    </div>
  );
};

export default FabricIssueList;
