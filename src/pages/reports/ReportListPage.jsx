import { useState, useEffect, useMemo, useCallback } from 'react';
import { Row, Col, Input, Skeleton, Card, Tag, Space, Segmented, Button, App } from 'antd';
import {
  SearchOutlined,
  BarChartOutlined,
  StarOutlined,
  AppstoreOutlined,
  ClockCircleOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import StatCard from '../../components/StatCard';
import EmptyState from '../../components/EmptyState';
import ModuleReportCard from './components/ModuleReportCard';
import ReportModuleNav from './components/ReportModuleNav';
import ReportsBreadcrumb from './components/ReportsBreadcrumb';
import ReportDesignerDrawer from './components/ReportDesignerDrawer';
import PermissionGuard from '../../components/PermissionGuard';
import useResponsive from '../../hooks/useResponsive';
import {
  getReportDefinitions, getSavedReports, deleteReportDefinition,
} from '../../services/core/reportService';
import {
  getFilteredReportNavOptions, getModuleColor, getModuleLabel,
} from '../../utils/reportConstants';
import { hasModuleAccess, hasPermission } from '../../utils/permissions';

const ReportListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const { isMobileOrTablet } = useResponsive();

  const [definitions, setDefinitions] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState(null);
  const [designerOpen, setDesignerOpen] = useState(false);
  const [editingReport, setEditingReport] = useState(null);
  const navOptions = useMemo(() => getFilteredReportNavOptions(hasModuleAccess), []);
  const canAddReports = hasPermission('reports', 'add');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [defs, saved] = await Promise.all([
        getReportDefinitions(),
        getSavedReports().catch(() => []),
      ]);
      setDefinitions(defs || []);
      setSavedReports(saved || []);
    } catch {
      message.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { reload(); }, [reload]);

  const handleCreate = useCallback(() => {
    setEditingReport(null);
    setDesignerOpen(true);
  }, []);

  const handleEdit = useCallback((report) => {
    setEditingReport(report);
    setDesignerOpen(true);
  }, []);

  const closeDesigner = useCallback(() => {
    setDesignerOpen(false);
    setEditingReport(null);
  }, []);

  const handleDelete = useCallback(async (report) => {
    try {
      await deleteReportDefinition(report.id);
      message.success('Report deleted');
      reload();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete the report');
    }
  }, [message, reload]);

  // Module counts for the left nav
  const moduleCounts = useMemo(() => {
    const counts = {};
    definitions.forEach((d) => {
      const mod = d.module || 'OTHER';
      counts[mod] = (counts[mod] || 0) + 1;
    });
    return counts;
  }, [definitions]);

  const uniqueModuleCount = useMemo(
    () => Object.keys(moduleCounts).length,
    [moduleCounts],
  );

  // Filter definitions by selected module + search
  const filteredDefs = useMemo(() => {
    let result = definitions;
    if (selectedModule) {
      result = result.filter((d) => d.module === selectedModule);
    }
    if (search.trim()) {
      const lower = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.displayName?.toLowerCase().includes(lower) ||
          d.description?.toLowerCase().includes(lower),
      );
    }
    return result;
  }, [definitions, selectedModule, search]);

  // Group filtered definitions by module
  const grouped = useMemo(() => {
    const map = {};
    filteredDefs.forEach((d) => {
      const mod = d.module || 'OTHER';
      if (!map[mod]) map[mod] = [];
      map[mod].push(d);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredDefs]);

  const handleOpen = useCallback(
    (id) => navigate(`/reports/builder/${id}`),
    [navigate],
  );

  const handleNavChange = useCallback(
    (value) => {
      if (value !== location.pathname) navigate(value);
    },
    [navigate, location.pathname],
  );

  // Breadcrumb items
  const breadcrumbItems = useMemo(
    () => selectedModule ? [selectedModule.replace(/_/g, ' ')] : ['All Reports'],
    [selectedModule],
  );

  // Skeleton loading
  if (loading) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="Reports" subtitle="Explore and generate reports across all modules">
          <Segmented
            options={navOptions}
            value="/reports/list"
            disabled
          />
        </PageHeader>

        {/* Skeleton stat cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          {[1, 2, 3, 4].map((i) => (
            <Col xs={12} sm={12} md={6} key={i}>
              <StatCard loading />
            </Col>
          ))}
        </Row>

        {/* Skeleton content */}
        <div style={{ display: 'flex', gap: 16 }}>
          {!isMobileOrTablet && (
            <div style={{ width: 248, flexShrink: 0 }}>
              <Card styles={{ body: { padding: 16 } }}>
                <Skeleton active paragraph={{ rows: 10 }} />
              </Card>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <Row gutter={[16, 16]}>
              {[1, 2, 3].map((i) => (
                <Col xs={24} sm={12} lg={8} key={i}>
                  <Card styles={{ body: { padding: 20 } }}>
                    <Skeleton active paragraph={{ rows: 3 }} />
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 112px)', overflow: 'hidden' }}>
      {/* Header with segmented navigation */}
      <div style={{ flexShrink: 0 }}>
        <PageHeader title="Reports" subtitle="Explore and generate reports across all modules">
          <Segmented
            options={navOptions}
            value={location.pathname}
            onChange={handleNavChange}
          />
        </PageHeader>

        {/* Stat cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={12} md={6}>
            <StatCard
              title="Total Reports"
              value={definitions.length}
              icon={<BarChartOutlined />}
              color="var(--primary-color)"
            />
          </Col>
          <Col xs={12} sm={12} md={6}>
            <StatCard
              title="Saved Configs"
              value={savedReports.length}
              icon={<StarOutlined />}
              color="var(--warning-color)"
            />
          </Col>
          <Col xs={12} sm={12} md={6}>
            <StatCard
              title="Modules"
              value={uniqueModuleCount}
              icon={<AppstoreOutlined />}
              color="var(--success-color)"
            />
          </Col>
          <Col xs={12} sm={12} md={6}>
            <StatCard
              title="Saved Reports"
              value={savedReports.length > 0 ? savedReports.length : '—'}
              icon={<ClockCircleOutlined />}
              color="var(--info-color)"
            />
          </Col>
        </Row>
      </div>

      {/* Two-panel layout */}
      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Left navigation panel — desktop only */}
        {!isMobileOrTablet && (
          <ReportModuleNav
            moduleCounts={moduleCounts}
            selectedModule={selectedModule}
            onSelect={setSelectedModule}
          />
        )}

        {/* Right content area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {/* Breadcrumb + search bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: 12,
              marginBottom: 12,
              borderBottom: '1px solid var(--border-color)',
              flexWrap: 'wrap',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <ReportsBreadcrumb items={breadcrumbItems} />
            <Space wrap>
              <Input
                prefix={<SearchOutlined />}
                placeholder={selectedModule ? `Search in ${getModuleLabel(selectedModule)}...` : 'Search all reports...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                style={{ width: 280, flexShrink: 0 }}
              />
              <PermissionGuard module="reports" operation="add">
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  New Report
                </Button>
              </PermissionGuard>
            </Space>
          </div>

          {/* Mobile module selector */}
          {isMobileOrTablet && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, flexShrink: 0 }}>
              <Tag
                color={selectedModule === null ? 'processing' : undefined}
                style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13, flexShrink: 0 }}
                onClick={() => setSelectedModule(null)}
              >
                All
              </Tag>
              {Object.keys(moduleCounts).sort().map((mod) => (
                <Tag
                  key={mod}
                  color={selectedModule === mod ? getModuleColor(mod) : undefined}
                  style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13, flexShrink: 0 }}
                  onClick={() => setSelectedModule(mod === selectedModule ? null : mod)}
                >
                  {mod.replace(/_/g, ' ')} ({moduleCounts[mod]})
                </Tag>
              ))}
            </div>
          )}

          {/* Scrollable content */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
            {/* Saved Reports quick access — show when "All" is selected */}
            {selectedModule === null && savedReports.length > 0 && (
              <Card
                size="small"
                title={<Space><StarOutlined />Saved Reports</Space>}
                style={{ marginBottom: 16 }}
              >
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {savedReports.map((sr) => (
                    <Tag
                      key={sr.id}
                      color="processing"
                      style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13, flexShrink: 0 }}
                      onClick={() => navigate(`/reports/builder/${sr.reportDefId}?saved=${sr.id}`)}
                    >
                      {sr.savedName || sr.name || 'Untitled'}
                    </Tag>
                  ))}
                </div>
              </Card>
            )}

            {/* Report cards grouped by module */}
            {grouped.length === 0 ? (
              <EmptyState
                title="No reports found"
                description={search
                  ? 'Try a different search term'
                  : 'Design a report by picking a data source and the columns you need.'}
                style={{ marginTop: 60 }}
                showAction={!search && canAddReports}
                onAction={handleCreate}
                actionLabel="Create your first report"
              />
            ) : (
              grouped.map(([module, reports]) => (
                <div key={module} style={{ marginBottom: 24 }}>
                  {/* Module group header — only shown when viewing "All" */}
                  {selectedModule === null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <Tag color={getModuleColor(module)}>{getModuleLabel(module)}</Tag>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {reports.length} report{reports.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  <Row gutter={[16, 16]}>
                    {reports.map((report) => (
                      <Col xs={24} sm={12} lg={8} key={report.id}>
                        <ModuleReportCard
                          report={report}
                          onOpen={handleOpen}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      </Col>
                    ))}
                  </Row>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <ReportDesignerDrawer
        open={designerOpen}
        editingReport={editingReport}
        onClose={closeDesigner}
        onSaved={() => { closeDesigner(); reload(); }}
      />
    </div>
  );
};

export default ReportListPage;
