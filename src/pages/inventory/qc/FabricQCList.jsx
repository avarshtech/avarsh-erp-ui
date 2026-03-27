import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Space, Input, Select, DatePicker, Row, Col } from 'antd';
import {
  SearchOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
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
import { getFabricQCList } from '../../../services/inventoryService';
import { formatDate } from '../../../utils/formatters';
import QCViewDrawer from './QCViewDrawer';

const { RangePicker } = DatePicker;

const STATUS_OPTIONS = [
  { label: 'Passed', value: QC_STATUS.PASSED },
  { label: 'Failed', value: QC_STATUS.FAILED },
  { label: 'Conditional', value: QC_STATUS.CONDITIONAL },
  { label: 'Pending Approval', value: QC_STATUS.PENDING_APPROVAL },
  { label: 'In Progress', value: QC_STATUS.IN_PROGRESS },
  { label: 'Approved', value: QC_STATUS.APPROVED },
  { label: 'Rejected', value: QC_STATUS.REJECTED },
];

const FabricQCList = ({ embedded = false }) => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [viewDrawer, setViewDrawer] = useState({ open: false, record: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getFabricQCList();
      setData(res.content || []);
    } catch {
      message.error('Failed to load fabric QC list');
    } finally {
      setLoading(false);
    }
  }, [message]);

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
    return result;
  }, [data, statusFilter, searchText]);

  const stats = useMemo(() => {
    const passed = data.filter((r) => r.overallResult === 'Pass').length;
    const failed = data.filter((r) => r.overallResult === 'Fail').length;
    return { total: data.length, passed, failed };
  }, [data]);

  const columns = useMemo(
    () => [
      { title: 'QC Number', dataIndex: 'qcNumber', key: 'qcNumber', width: 160, render: (text, record) => <RecordLink text={text} onClick={() => setViewDrawer({ open: true, record })} /> },
      { title: 'GRN Number', dataIndex: 'grnNumber', key: 'grnNumber', width: 160 },
      { title: 'Fabric Description', dataIndex: 'fabricDescription', key: 'fabricDescription', width: 220, ellipsis: true },
      { title: 'Roll Count', dataIndex: 'rollCount', key: 'rollCount', width: 100, align: 'center' },
      { title: 'Defect Points', dataIndex: 'totalDefectPoints', key: 'totalDefectPoints', width: 120, align: 'center' },
      { title: 'Result', dataIndex: 'overallResult', key: 'overallResult', width: 140, render: (val) => { const color = val === 'Pass' ? 'green' : val === 'Fail' ? 'red' : 'orange'; return <StatusTag status={val} config={{ [val]: { color } }} />; } },
      { title: 'Inspector', dataIndex: 'inspector', key: 'inspector', width: 150 },
      { title: 'Date', dataIndex: 'inspectionDate', key: 'inspectionDate', width: 130, render: (val) => formatDate(val) },
      { title: 'Approval', dataIndex: 'approvalStatus', key: 'approvalStatus', width: 140, render: (val) => <StatusTag status={val} config={QC_STATUS_CONFIG} getLabel={getInventoryStatusLabel} size="small" /> },
      {
        title: 'Actions', key: 'actions', width: 100, fixed: 'right', align: 'center',
        render: (_, record) => (
          <Space size={4}>
            <ActionButton action="view" onClick={() => setViewDrawer({ open: true, record })} />
            <ActionButton action="edit" onClick={() => navigate(`/inventory/qc/fabric/${record.id}`)} />
          </Space>
        ),
      },
    ],
    [navigate, setViewDrawer],
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
          <RangePicker style={{ width: 280 }} />
        </Space>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          scroll={{ x: 1400 }}
          pagination={getTablePagination({ pageSize: 10 }, 'inspections')}
          locale={{ emptyText: <EmptyState title="No fabric QC inspections found" description="Create a new inspection to get started" /> }}
        />
      </Card>
      <QCViewDrawer
        open={viewDrawer.open}
        onClose={() => setViewDrawer({ open: false, record: null })}
        record={viewDrawer.record}
        type="fabric"
      />
    </>
  );

  if (embedded) return content;

  return (
    <div className="animate-fade-in-up">
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
