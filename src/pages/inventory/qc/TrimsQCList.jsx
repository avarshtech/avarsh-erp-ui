import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, Select, DatePicker, Row, Col } from 'antd';
import {
  SearchOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import { ActionButton } from '../../../components/buttons';
import StatCard from '../../../components/StatCard';
import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import EmptyState from '../../../components/EmptyState';
import PermissionGuard from '../../../components/PermissionGuard';
import { getTablePagination } from '../../../utils/paginationConfig';
import { QC_STATUS, getInventoryStatusLabel } from '../../../utils/inventoryConstants';
import { QC_STATUS_CONFIG } from '../../../utils/statusConfig';
import { getTrimsQCList, deleteTrimsQCDraft } from '../../../services/inventory/inventoryService';
import { formatDate } from '../../../utils/formatters';
import QCViewModal from './QCViewModal';

// Statuses whose records are still editable by the creator.
const EDITABLE_STATUSES = new Set([
  QC_STATUS.DRAFT,
  QC_STATUS.REJECTED,
  QC_STATUS.REFERRED_BACK,
]);

const { RangePicker } = DatePicker;

const STATUS_OPTIONS = [
  { label: 'Draft', value: QC_STATUS.DRAFT },
  { label: 'Pending Approval', value: QC_STATUS.PENDING_APPROVAL },
  { label: 'Approved', value: QC_STATUS.APPROVED },
  { label: 'Rejected', value: QC_STATUS.REJECTED },
  { label: 'Refer Back Pending', value: QC_STATUS.REFERRED_BACK_PENDING },
  { label: 'Referred Back', value: QC_STATUS.REFERRED_BACK },
];

/**
 * Accessories QC list — column set mirrors Fabric QC (D2 decision, further refined).
 *
 * Only the high-signal columns live in the table; all the detail fields
 * (buyer, style, DC #, qty ordered, qty received, stock status) are available
 * via the View / Edit modes. Keeps the list mobile-friendly and visually
 * consistent with the Fabric QC list.
 */
const TrimsQCList = ({ embedded = false }) => {
  const { message, modal } = App.useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [apiStats, setApiStats] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [viewDrawer, setViewDrawer] = useState({ open: false, record: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTrimsQCList({
        search: searchText || undefined,
        status: statusFilter || undefined,
        dateStart: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        dateEnd: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      });
      setData(res.content || []);
      setApiStats(res.stats || null);
    } catch {
      message.error('Failed to load accessories QC list');
    } finally {
      setLoading(false);
    }
  }, [message, searchText, statusFilter, dateRange]);

  const handleDelete = useCallback((record) => {
    modal.confirm({
      title: 'Delete QC inspection?',
      icon: <ExclamationCircleOutlined />,
      content: (
        <span>
          This will permanently delete <strong>{record.qcNumber}</strong>. Only draft QCs can be deleted; this action cannot be undone.
        </span>
      ),
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteTrimsQCDraft(record.id);
          message.success(`${record.qcNumber} deleted`);
          loadData();
        } catch (err) {
          message.error(err?.message || 'Failed to delete QC');
        }
      },
    });
  }, [modal, message, loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredData = useMemo(() => {
    let result = data;
    if (statusFilter) result = result.filter((r) => r.status === statusFilter);
    if (searchText) {
      const s = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          r.qcNumber?.toLowerCase().includes(s) ||
          r.grnNumber?.toLowerCase().includes(s) ||
          r.itemDescription?.toLowerCase().includes(s) ||
          r.category?.toLowerCase().includes(s),
      );
    }
    if (dateRange?.[0] && dateRange?.[1]) {
      result = result.filter((r) => {
        const raw = r.inspectionDate || r.date;
        if (!raw) return false;
        const dt = dayjs(raw);
        return dt.isAfter(dateRange[0].startOf('day')) && dt.isBefore(dateRange[1].endOf('day'));
      });
    }
    return result;
  }, [data, statusFilter, searchText, dateRange]);

  // Stats come from the paginated API response — server-side FY aggregates
  // that reflect the current filter set. Falls back to counting the currently
  // loaded rows until the first response arrives.
  const stats = useMemo(() => {
    if (apiStats) {
      return {
        total: apiStats.totalInspections || 0,
        approved: apiStats.approved || 0,
        rejected: apiStats.rejected || 0,
      };
    }
    const approved = filteredData.filter((r) => r.status === QC_STATUS.APPROVED).length;
    const rejected = filteredData.filter((r) => r.status === QC_STATUS.REJECTED).length;
    return { total: filteredData.length, approved, rejected };
  }, [apiStats, filteredData]);

  const columns = useMemo(
    () => [
      { title: 'QC Number', dataIndex: 'qcNumber', key: 'qcNumber', width: 160, render: (text, record) => <RecordLink text={text} onClick={() => setViewDrawer({ open: true, record })} /> },
      { title: 'GRN Number', dataIndex: 'grnNumber', key: 'grnNumber', width: 160 },
      { title: 'Item Description', dataIndex: 'itemDescription', key: 'itemDescription', width: 240, ellipsis: true },
      { title: 'Category', dataIndex: 'category', key: 'category', width: 140 },
      { title: 'Inspector', dataIndex: 'inspector', key: 'inspector', width: 150 },
      { title: 'Date', dataIndex: 'inspectionDate', key: 'inspectionDate', width: 130, render: (val, r) => formatDate(val || r.date) },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        width: 160,
        render: (val) => <StatusTag status={val} config={QC_STATUS_CONFIG} getLabel={getInventoryStatusLabel} size="small" />,
      },
      {
        title: 'Actions', key: 'actions', width: 140, fixed: 'right', align: 'center',
        render: (_, record) => {
          const canEdit = EDITABLE_STATUSES.has(record.status);
          const canDelete = record.status === QC_STATUS.DRAFT;
          return (
            <Space size={4}>
              <ActionButton action="view" onClick={() => setViewDrawer({ open: true, record })} />
              {canEdit && (
                <ActionButton action="edit" onClick={() => navigate(`/inventory/qc/trims/${record.id}`)} />
              )}
              {canDelete && (
                <ActionButton action="delete" onClick={() => handleDelete(record)} />
              )}
            </Space>
          );
        },
      },
    ],
    [navigate, handleDelete],
  );

  const content = (
    <>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}><StatCard title="Total Inspections" value={stats.total} color="var(--primary-color)" icon={<ExperimentOutlined />} /></Col>
        <Col xs={24} sm={8}><StatCard title="Approved" value={stats.approved} color="var(--success-color)" icon={<CheckCircleOutlined />} /></Col>
        <Col xs={24} sm={8}><StatCard title="Rejected" value={stats.rejected} color="var(--error-color)" icon={<CloseCircleOutlined />} /></Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder="Search QC / GRN / Item / Category..." prefix={<SearchOutlined />} style={{ width: 300 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select placeholder="Status" style={{ width: 180 }} allowClear options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <RangePicker style={{ width: 280 }} value={dateRange} onChange={setDateRange} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          scroll={{ x: 1240 }}
          pagination={getTablePagination({ pageSize: 10 }, 'inspections')}
          locale={{ emptyText: <EmptyState title="No accessories QC inspections found" description="Create a new inspection to get started" /> }}
        />
      </Card>
      <QCViewModal
        open={viewDrawer.open}
        onClose={() => setViewDrawer({ open: false, record: null })}
        record={viewDrawer.record}
        type="trims"
      />
    </>
  );

  if (embedded) return content;

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader title="Accessories Quality Control">
        <PermissionGuard module="inventory" operation="add">
          <ActionButton action="create" text="New Accessories Inspection" onClick={() => navigate('/inventory/qc/trims/new')} />
        </PermissionGuard>
      </PageHeader>
      {content}
    </div>
  );
};

export default TrimsQCList;
