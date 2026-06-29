import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, DatePicker, Row, Col } from 'antd';
import { SearchOutlined, ScissorOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import StatCard from '../../../components/StatCard';
import RecordLink from '../../../components/RecordLink';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { getFabricIssueList, getApprovedCuttingPOs } from '../../../services/inventory/inventoryService';
import { formatNumber } from '../../../utils/formatters';
import { generateFabricIssueSlipPdf } from '../../../utils/issueSlipPdfGenerator';
import IssueViewDrawer from './IssueViewDrawer';

const { RangePicker } = DatePicker;

const FabricIssueList = ({ embedded = false }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [pendingCuttingPOCount, setPendingCuttingPOCount] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [viewDrawer, setViewDrawer] = useState({ open: false, record: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFabricIssueList({ search: searchText });
      setData(res.content || []);
      setTotalElements(res.totalElements ?? (res.content || []).length);
    } catch {
      message.error('Failed to load fabric issues');
    } finally {
      setLoading(false);
    }
  }, [searchText, message]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    getApprovedCuttingPOs()
      .then((res) => setPendingCuttingPOCount(res.totalElements ?? (res.content || []).length))
      .catch(() => { /* non-blocking */ });
  }, []);

  const filtered = useMemo(() => {
    const q = (searchText || '').toLowerCase();
    let out = data;
    if (q) {
      out = out.filter((d) =>
        (d.issueNumber || '').toLowerCase().includes(q)
        || (d.cuttingPO || '').toLowerCase().includes(q)
        || (d.style || '').toLowerCase().includes(q)
        || (d.fabric || '').toLowerCase().includes(q),
      );
    }
    if (dateRange?.[0] && dateRange?.[1]) {
      out = out.filter((d) => {
        const dt = dayjs(d.issueDate);
        return dt.isAfter(dateRange[0].startOf('day')) && dt.isBefore(dateRange[1].endOf('day'));
      });
    }
    return out;
  }, [data, searchText, dateRange]);

  const columns = useMemo(() => [
    { title: 'Issue #', dataIndex: 'issueNumber', key: 'issueNumber', width: 160, align: 'center', render: (val, record) => <RecordLink text={val} onClick={() => setViewDrawer({ open: true, record })} /> },
    { title: 'Date', dataIndex: 'issueDate', key: 'issueDate', width: 120, align: 'center', render: (v) => dayjs(v).format('DD-MMM-YYYY') },
    { title: 'Cutting PO', dataIndex: 'cuttingPO', key: 'cuttingPO', width: 170, align: 'center' },
    { title: 'Style', dataIndex: 'style', key: 'style', width: 130, align: 'center' },
    { title: 'Fabric', dataIndex: 'fabric', key: 'fabric', width: 180, align: 'center', ellipsis: true },
    { title: 'Rolls', dataIndex: 'rollsIssued', key: 'rollsIssued', width: 80, align: 'center' },
    { title: 'Issued Qty', dataIndex: 'totalWeight', key: 'totalWeight', width: 140, align: 'center', render: (v, r) => `${formatNumber(v, 1)} ${r.uom || 'kg'}` },
    { title: 'BOM Req', dataIndex: 'bomRequired', key: 'bomRequired', width: 130, align: 'center', render: (v, r) => `${formatNumber(v, 1)} ${r.uom || 'kg'}` },
    {
      title: 'Actions', key: 'actions', width: 110, fixed: 'right', align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <ActionButton action="view" size="small" onClick={() => setViewDrawer({ open: true, record })} />
          {hasPermission('inventory-issue', 'update') && (
            <ActionButton action="edit" size="small" onClick={() => navigate(`/inventory/issue/fabric/${record.id}`)} />
          )}
          <ActionButton action="print" size="small" onClick={() => generateFabricIssueSlipPdf(record)} />
        </Space>
      ),
    },
  ], [navigate]);

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
        <Col xs={12} sm={12} md={12}>
          <StatCard title="Total Issues" value={totalElements} color="var(--primary-color)" icon={<ScissorOutlined />} />
        </Col>
        <Col xs={12} sm={12} md={12}>
          <StatCard title="Pending Issues" value={pendingCuttingPOCount} color="var(--warning-color)" icon={<ClockCircleOutlined />} />
        </Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input
            placeholder="Search issues..."
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <RangePicker style={{ width: 280 }} value={dateRange} onChange={setDateRange} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          scroll={{ x: 1300 }}
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
        {hasPermission('inventory-issue', 'add') && (
          <ActionButton action="create" text="New Fabric Issue" onClick={() => navigate('/inventory/issue/fabric/new')} />
        )}
      </PageHeader>
      {content}
    </div>
  );
};

export default FabricIssueList;
