import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Card, Row, Col, Button, Space, Spin, App } from 'antd';
import { PlayCircleOutlined, SaveOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ReportFieldSelector from './components/ReportFieldSelector';
import ReportFilterBar from './components/ReportFilterBar';
import ReportResultsTable from './components/ReportResultsTable';
import ReportExportBar from './components/ReportExportBar';
import SaveReportDrawer from './components/SaveReportDrawer';
import {
  getReportDefinition,
  executeReport,
  exportReport,
  getSavedReports,
} from '../../services/reportService';

const ReportBuilderPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { message } = App.useApp();

  const [definition, setDefinition] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Config state
  const [selectedFields, setSelectedFields] = useState([]);
  const [filterValues, setFilterValues] = useState({});
  const [sortConfig, setSortConfig] = useState(null);

  // Results state
  const [results, setResults] = useState({ columns: [], data: [] });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // Load definition + optionally restore saved config
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const def = await getReportDefinition(id);
        if (cancelled) return;
        setDefinition(def);

        // Pre-select default fields
        const defaults = (def.fields || [])
          .filter((f) => f.isDefault)
          .map((f) => f.fieldCode);
        setSelectedFields(defaults);

        // Restore saved config if ?saved= param
        const savedId = searchParams.get('saved');
        if (savedId) {
          const allSaved = await getSavedReports();
          const saved = allSaved?.find((s) => String(s.id) === savedId);
          if (saved && !cancelled) {
            if (saved.selectedFields?.length) setSelectedFields(saved.selectedFields);
            if (saved.filters) setFilterValues(saved.filters);
            if (saved.sortConfig) setSortConfig(saved.sortConfig);
          }
        }
      } catch {
        message.error('Failed to load report definition');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = useCallback((code, value) => {
    setFilterValues((prev) => ({ ...prev, [code]: value }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilterValues({});
  }, []);

  const handleGenerate = useCallback(async (page = 1, pageSize = 20, sorter = sortConfig) => {
    setExecuting(true);
    try {
      const res = await executeReport({
        reportDefId: Number(id),
        selectedFieldCodes: selectedFields,
        filters: filterValues,
        sortColumn: sorter?.field || null,
        sortDirection: sorter?.direction || null,
        page: page - 1,
        size: pageSize,
      });
      setResults({ columns: res.columns || [], data: res.rows || [] });
      setPagination({ current: page, pageSize, total: res.totalRows || 0 });
    } catch {
      // Error shown by axiosInstance
    } finally {
      setExecuting(false);
    }
  }, [id, selectedFields, filterValues, sortConfig]);

  const handleTableChange = useCallback((pag, _filters, sorter) => {
    const newSort = sorter?.field
      ? { field: sorter.field, direction: sorter.order === 'ascend' ? 'asc' : 'desc' }
      : null;
    setSortConfig(newSort);
    handleGenerate(pag.current, pag.pageSize, newSort);
  }, [handleGenerate]);

  const handleExport = useCallback(async (format) => {
    setExporting(true);
    try {
      const blob = await exportReport({
        reportDefId: Number(id),
        selectedFieldCodes: selectedFields,
        filters: filterValues,
        sortColumn: sortConfig?.field || null,
        sortDirection: sortConfig?.direction || null,
        format,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'EXCEL' ? 'xlsx' : format.toLowerCase();
      a.download = `${definition?.displayName || 'report'}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success(`${format} export downloaded`);
    } catch {
      // Error shown by axiosInstance
    } finally {
      setExporting(false);
    }
  }, [id, selectedFields, filterValues, sortConfig, definition?.displayName, message]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={definition?.displayName || 'Report'}
        subtitle={definition?.description}
        backPath="/reports/list"
      />

      {/* Config section */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} md={8}>
          <ReportFieldSelector
            fields={definition?.fields || []}
            selectedFields={selectedFields}
            onChange={setSelectedFields}
          />
        </Col>
        <Col xs={24} md={16}>
          <ReportFilterBar
            filters={definition?.filters || []}
            values={filterValues}
            onChange={handleFilterChange}
            onClear={handleClearFilters}
            reportDefId={id}
          />
        </Col>
      </Row>

      {/* Action bar */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Space>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={() => handleGenerate()}
              loading={executing}
              disabled={!selectedFields.length}
            >
              Generate Report
            </Button>
            <ReportExportBar onExport={handleExport} loading={exporting} />
          </Space>
          <Button icon={<SaveOutlined />} onClick={() => setDrawerOpen(true)}>
            Save Report
          </Button>
        </div>
      </Card>

      {/* Results */}
      <ReportResultsTable
        columns={results.columns}
        data={results.data}
        loading={executing}
        pagination={pagination}
        onTableChange={handleTableChange}
      />

      <SaveReportDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        reportDefId={Number(id)}
        selectedFields={selectedFields}
        appliedFilters={filterValues}
        sortConfig={sortConfig}
        onSaved={() => message.success('Report configuration saved')}
      />
    </div>
  );
};

export default ReportBuilderPage;
