import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, DatePicker, Row, Col, Tag } from 'antd';
import { SearchOutlined, AppstoreOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission } from '../../../utils/permissions';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import StatCard from '../../../components/StatCard';
import RecordLink from '../../../components/RecordLink';
import EmptyState from '../../../components/EmptyState';
import { getTablePagination } from '../../../utils/paginationConfig';
import { listIssues, getIssueWorkOrders } from '../../../services/inventory/materialIssueService';
import { formatNumber } from '../../../utils/formatters';
import { generateAccessoriesIssueSlipPdf } from '../../../utils/issueSlipPdfGenerator';
import IssueViewDrawer from './IssueViewDrawer';
import CancelIssueModal from './CancelIssueModal';

const { RangePicker } = DatePicker;

const AccessoriesIssueList = ({ embedded = false }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [totalElements, setTotalElements] = useState(0);
  const [pendingWOCount, setPendingWOCount] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [viewDrawer, setViewDrawer] = useState({ open: false, record: null });
  const [cancelModal, setCancelModal] = useState({ open: false, record: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listIssues('ACCESSORY', { search: searchText });
      setData(res.content || []);
      setTotalElements(res.totalElements ?? (res.content || []).length);
    } catch {
      message.error('Failed to load accessories issues');
    } finally {
      setLoading(false);
    }
  }, [searchText, message]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    getIssueWorkOrders()
      .then((res) => setPendingWOCount(res.totalElements ?? (res.content || []).length))
      .catch(() => { /* non-blocking */ });
  }, []);

  const filtered = useMemo(() => {
    const q = (searchText || '').toLowerCase();
    let out = data;
    if (q) {
      out = out.filter((d) =>
        (d.issueNumber || '').toLowerCase().includes(q)
        || (d.workOrder || '').toLowerCase().includes(q)
        || (d.style || '').toLowerCase().includes(q),
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
    { title: 'Work Order', dataIndex: 'workOrder', key: 'workOrder', width: 160, align: 'center' },
    { title: 'Style', dataIndex: 'style', key: 'style', width: 130, align: 'center' },
    { title: 'Items', dataIndex: 'itemsCount', key: 'itemsCount', width: 80, align: 'center' },
    {
      title: 'Total Qty', dataIndex: 'totalQty', key: 'totalQty', width: 160, align: 'center',
      render: (_, record) => {
        const byUom = (record.items || []).reduce((acc, it) => {
          const uom = it.uom || '';
          acc[uom] = (acc[uom] || 0) + (Number(it.issuedQty) || 0);
          return acc;
        }, {});
        const entries = Object.entries(byUom);
        if (!entries.length) return formatNumber(record.totalQty);
        return entries
          .map(([uom, qty]) => `${formatNumber(qty)} ${uom}`)
          .join(' · ');
      },
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110, align: 'center',
      render: (s) => s === 'CANCELLED'
        ? <Tag color="default" style={{ textDecoration: 'line-through' }}>Cancelled</Tag>
        : <Tag color="success">Completed</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 120, fixed: 'right', align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <ActionButton action="view" size="small" onClick={() => setViewDrawer({ open: true, record })} />
          {record.status !== 'CANCELLED' && (
            <ActionButton action="print" size="small" onClick={() => generateAccessoriesIssueSlipPdf(record)} />
          )}
          {record.status !== 'CANCELLED' && hasPermission('inventory-issue', 'update') && (
            <ActionButton action="cancel" size="small" onClick={() => setCancelModal({ open: true, record })} />
          )}
        </Space>
      ),
    },
  ], []);

  const drawer = (
    <>
      <IssueViewDrawer
        open={viewDrawer.open}
        onClose={() => setViewDrawer({ open: false, record: null })}
        record={viewDrawer.record}
        type="accessories"
      />
      <CancelIssueModal
        open={cancelModal.open}
        record={cancelModal.record}
        onClose={() => setCancelModal({ open: false, record: null })}
        onCancelled={loadData}
      />
    </>
  );

  const content = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={12}>
          <StatCard title="Total Issues" value={totalElements} color="var(--primary-color)" icon={<AppstoreOutlined />} />
        </Col>
        <Col xs={12} sm={12} md={12}>
          <StatCard title="Pending Issues" value={pendingWOCount} color="var(--warning-color)" icon={<ClockCircleOutlined />} />
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
          scroll={{ x: 990 }}
          pagination={getTablePagination({ pageSize: 10 }, 'accessories issues')}
          locale={{ emptyText: <EmptyState title="No accessories issues found" description="Create a new accessories issue to get started" /> }}
        />
      </Card>
      {drawer}
    </>
  );

  if (embedded) return content;

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Accessories Issue">
        {hasPermission('inventory-issue', 'add') && (
          <ActionButton action="create" text="New Accessories Issue" onClick={() => navigate('/inventory/issue/accessories/new')} />
        )}
      </PageHeader>
      {content}
    </div>
  );
};

export default AccessoriesIssueList;
