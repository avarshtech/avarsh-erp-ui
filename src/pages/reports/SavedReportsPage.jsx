import { useState, useEffect, useCallback, useMemo } from 'react';
import { Table, Button, Space, Row, Col, Input, Select, Tag, Skeleton, Card, Segmented, App } from 'antd';
import { EyeOutlined, DeleteOutlined, SearchOutlined, StarOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import ReportsBreadcrumb from './components/ReportsBreadcrumb';
import { getSavedReports, deleteSavedReport } from '../../services/reportService';
import { formatDate } from '../../utils/formatters';
import { getFilteredReportNavOptions, getModuleColor } from '../../utils/reportConstants';
import { hasModuleAccess } from '../../utils/permissions';

const SavedReportsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { message, modal } = App.useApp();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const navOptions = useMemo(() => getFilteredReportNavOptions(hasModuleAccess), []);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const saved = await getSavedReports();
      setData(saved || []);
    } catch {
      message.error('Failed to load saved reports');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpen = useCallback(
    (record) => {
      navigate(`/reports/builder/${record.reportDefId}?saved=${record.id}`);
    },
    [navigate],
  );

  const handleDelete = useCallback(
    (record) => {
      modal.confirm({
        title: 'Delete Saved Report',
        content: `Are you sure you want to delete "${record.savedName}"? This cannot be undone.`,
        okText: 'Delete',
        okButtonProps: { danger: true },
        onOk: async () => {
          setDeletingId(record.id);
          try {
            await deleteSavedReport(record.id);
            message.success('Saved report deleted');
            fetchData();
          } catch {
            // Error shown by axiosInstance
          } finally {
            setDeletingId(null);
          }
        },
      });
    },
    [modal, message, fetchData],
  );

  const handleNavChange = useCallback(
    (value) => {
      if (value !== location.pathname) navigate(value);
    },
    [navigate, location.pathname],
  );

  // Unique modules for filter dropdown
  const moduleOptions = useMemo(() => {
    const modules = [...new Set(data.map((d) => d.reportName).filter(Boolean))];
    return modules.sort().map((m) => ({ label: m, value: m }));
  }, [data]);

  // Unique module count
  const uniqueModules = useMemo(
    () => new Set(data.map((d) => d.reportName).filter(Boolean)).size,
    [data],
  );

  // Filtered data
  const filteredData = useMemo(() => {
    let result = data;
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.savedName?.toLowerCase().includes(lower) ||
          d.reportName?.toLowerCase().includes(lower),
      );
    }
    if (moduleFilter) {
      result = result.filter((d) => d.reportName === moduleFilter);
    }
    return result;
  }, [data, search, moduleFilter]);

  const columns = useMemo(
    () => [
      {
        title: 'Report Name',
        dataIndex: 'savedName',
        key: 'savedName',
        ellipsis: true,
        sorter: (a, b) => (a.savedName || '').localeCompare(b.savedName || ''),
      },
      {
        title: 'Report Type',
        dataIndex: 'reportName',
        key: 'reportName',
        ellipsis: true,
        render: (val) => val ? <Tag color={getModuleColor(val)}>{val}</Tag> : '—',
        sorter: (a, b) => (a.reportName || '').localeCompare(b.reportName || ''),
      },
      {
        title: 'Created',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 140,
        render: (val) => formatDate(val),
        sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      },
      {
        title: 'Actions',
        key: 'actions',
        width: 120,
        fixed: 'right',
        render: (_, record) => (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleOpen(record)}
            >
              Open
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              loading={deletingId === record.id}
            />
          </Space>
        ),
      },
    ],
    [handleOpen, handleDelete, deletingId],
  );

  // Skeleton loading
  if (loading) {
    return (
      <div>
        <PageHeader title="Reports">
          <Segmented options={navOptions} value="/reports/saved" disabled />
        </PageHeader>
        <ReportsBreadcrumb items={['Saved Reports']} />
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {[1, 2].map((i) => (
            <Col xs={12} sm={12} md={6} key={i}>
              <StatCard loading />
            </Col>
          ))}
        </Row>
        <Card styles={{ body: { padding: 16 } }}>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reports">
        <Segmented
          options={navOptions}
          value={location.pathname}
          onChange={handleNavChange}
        />
      </PageHeader>

      <ReportsBreadcrumb items={['Saved Reports']} />

      {/* Stat cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={12} md={6}>
          <StatCard
            title="Total Saved"
            value={data.length}
            icon={<StarOutlined />}
            color="var(--warning-color)"
          />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <StatCard
            title="Report Types"
            value={uniqueModules}
            icon={<AppstoreOutlined />}
            color="var(--success-color)"
          />
        </Col>
      </Row>

      {/* Search + Filter bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search saved reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
        <Select
          placeholder="Filter by type"
          options={moduleOptions}
          value={moduleFilter}
          onChange={setModuleFilter}
          allowClear
          style={{ width: 200 }}
        />
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="id"
        size="middle"
        sticky
        scroll={{ x: 'max-content' }}
        pagination={{
          showSizeChanger: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} reports`,
        }}
        locale={{
          emptyText: (
            <EmptyState
              title="No saved reports"
              description={search || moduleFilter
                ? 'Try adjusting your search or filters'
                : 'Generate and save a report to see it here.'}
            />
          ),
        }}
      />
    </div>
  );
};

export default SavedReportsPage;
