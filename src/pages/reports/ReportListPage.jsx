import { useState, useEffect, useMemo, useCallback } from 'react';
import { Row, Col, Input, Spin, Empty, Typography, Card, Tag, Space, App } from 'antd';
import { SearchOutlined, StarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import ModuleReportCard from './components/ModuleReportCard';
import { getReportDefinitions, getSavedReports } from '../../services/reportService';
import { getModuleColor } from './components/ModuleReportCard';

const { Text } = Typography;

const ReportListPage = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [definitions, setDefinitions] = useState([]);
  const [savedReports, setSavedReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [defs, saved] = await Promise.all([
          getReportDefinitions(),
          getSavedReports().catch(() => []),
        ]);
        if (!cancelled) {
          setDefinitions(defs || []);
          setSavedReports(saved || []);
        }
      } catch {
        message.error('Failed to load reports');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredDefs = useMemo(() => {
    if (!search.trim()) return definitions;
    const lower = search.toLowerCase();
    return definitions.filter(
      (d) =>
        d.displayName?.toLowerCase().includes(lower) ||
        d.description?.toLowerCase().includes(lower)
    );
  }, [definitions, search]);

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
    [navigate]
  );

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Reports">
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search reports..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          style={{ width: 280 }}
        />
      </PageHeader>

      {/* Saved Reports Quick Access */}
      {savedReports.length > 0 && (
        <Card size="small" title={<Space><StarOutlined />Saved Reports</Space>} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {savedReports.map((sr) => (
              <Tag
                key={sr.id}
                color="processing"
                style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13, flexShrink: 0 }}
                onClick={() => navigate(`/reports/builder/${sr.reportDefinitionId}?saved=${sr.id}`)}
              >
                {sr.name}
              </Tag>
            ))}
          </div>
        </Card>
      )}

      {/* Reports grouped by module */}
      {grouped.length === 0 ? (
        <Empty description="No reports found" style={{ marginTop: 80 }} />
      ) : (
        grouped.map(([module, reports]) => (
          <div key={module} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Tag color={getModuleColor(module)}>{module.replace(/_/g, ' ')}</Tag>
              <Text type="secondary">{reports.length} report{reports.length !== 1 ? 's' : ''}</Text>
            </div>
            <Row gutter={[16, 16]}>
              {reports.map((report) => (
                <Col xs={24} sm={12} lg={8} key={report.id}>
                  <ModuleReportCard report={report} onOpen={handleOpen} />
                </Col>
              ))}
            </Row>
          </div>
        ))
      )}
    </div>
  );
};

export default ReportListPage;
