import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, Select, DatePicker, Row, Col, Modal } from 'antd';
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
import { getFabricQCList, deleteFabricQCDraft } from '../../../services/inventory/inventoryService';
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
  { label: 'Conditional Pass', value: QC_STATUS.CONDITIONAL_PASS },
  { label: 'Rejected', value: QC_STATUS.REJECTED },
  { label: 'Rejected (Back-up)', value: QC_STATUS.REJECTED_WITH_BACKUP },
  { label: 'Refer Back Pending', value: QC_STATUS.REFERRED_BACK_PENDING },
  { label: 'Referred Back', value: QC_STATUS.REFERRED_BACK },
];

const FabricQCList = ({ embedded = false }) => {
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
      const res = await getFabricQCList({
        search: searchText || undefined,
        status: statusFilter || undefined,
        dateStart: dateRange?.[0] ? dateRange[0].format('YYYY-MM-DD') : undefined,
        dateEnd: dateRange?.[1] ? dateRange[1].format('YYYY-MM-DD') : undefined,
      });
      setData(res.content || []);
      setApiStats(res.stats || null);
    } catch {
      message.error('Failed to load fabric QC list');
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
          await deleteFabricQCDraft(record.id);
          message.success(`${record.qcNumber} deleted`);
          loadData();
        } catch (err) {
          message.error(err?.message || 'Failed to delete QC');
        }
      },
    });
  }, [modal, message, loadData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    let result = data;
    if (statusFilter) result = result.filter((r) => r.status === statusFilter);
    if (searchText) {
      const s = searchText.toLowerCase();
      result = result.filter(
        (r) => r.qcNumber.toLowerCase().includes(s) || r.grnNumber.toLowerCase().includes(s) || r.fabricDescription.toLowerCase().includes(s),
      );
    }
    if (dateRange?.[0] && dateRange?.[1]) {
      const from = dateRange[0].startOf('day');
      const to = dateRange[1].endOf('day');
      result = result.filter((r) => {
        if (!r.inspectionDate) return false;
        const dt = dayjs(r.inspectionDate);
        return dt.isAfter(from) && dt.isBefore(to);
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
        passed: apiStats.passed || 0,
        failed: apiStats.failed || 0,
      };
    }
    // Conditional Pass counts as "passed" (approver signed off, just with qualifications);
    // exclude it from "failed" even if its underlying overallResult is Fail.
    const passed = filteredData.filter(
      (r) => r.overallResult === 'Pass' || r.status === QC_STATUS.CONDITIONAL_PASS,
    ).length;
    const failed = filteredData.filter(
      (r) => r.overallResult === 'Fail' && r.status !== QC_STATUS.CONDITIONAL_PASS,
    ).length;
    return { total: filteredData.length, passed, failed };
  }, [apiStats, filteredData]);

  const columns = useMemo(
    () => [
      { title: 'QC Number', dataIndex: 'qcNumber', key: 'qcNumber', width: 160, render: (text, record) => <RecordLink text={text} onClick={() => setViewDrawer({ open: true, record })} /> },
      { title: 'GRN Number', dataIndex: 'grnNumber', key: 'grnNumber', width: 160 },
      { title: 'Fabric Description', dataIndex: 'fabricDescription', key: 'fabricDescription', width: 220, ellipsis: true },
      { title: 'Roll Count', dataIndex: 'rollCount', key: 'rollCount', width: 100, align: 'center' },
      { title: 'Inspector', dataIndex: 'inspector', key: 'inspector', width: 150 },
      { title: 'Date', dataIndex: 'inspectionDate', key: 'inspectionDate', width: 130, render: (val) => formatDate(val) },
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
                <ActionButton action="edit" onClick={() => navigate(`/inventory/qc/fabric/${record.id}`)} />
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
        <Col xs={24} sm={8}><StatCard title="Passed" value={stats.passed} color="var(--success-color)" icon={<CheckCircleOutlined />} /></Col>
        <Col xs={24} sm={8}><StatCard title="Failed" value={stats.failed} color="var(--error-color)" icon={<CloseCircleOutlined />} /></Col>
      </Row>

      <Card>
        <Space wrap style={{ marginBottom: 16 }}>
          <Input placeholder="Search QC / GRN / Fabric..." prefix={<SearchOutlined />} style={{ width: 260 }} value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear />
          <Select placeholder="Status" style={{ width: 180 }} allowClear options={STATUS_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
          <RangePicker style={{ width: 280 }} value={dateRange} onChange={setDateRange} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          scroll={{ x: 1160 }}
          pagination={getTablePagination({ pageSize: 10 }, 'inspections')}
          locale={{ emptyText: <EmptyState title="No fabric QC inspections found" description="Create a new inspection to get started" /> }}
        />
      </Card>
      <QCViewModal
        open={viewDrawer.open}
        onClose={() => setViewDrawer({ open: false, record: null })}
        record={viewDrawer.record}
        type="fabric"
      />
    </>
  );

  if (embedded) return content;

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader title="Fabric Quality Control">
        <PermissionGuard module="inventory" operation="add">
          <ActionButton action="create" text="New Inspection" onClick={() => navigate('/inventory/qc/fabric/new')} />
        </PermissionGuard>
      </PageHeader>
      {content}
    </div>
  );
};

export default FabricQCList;
