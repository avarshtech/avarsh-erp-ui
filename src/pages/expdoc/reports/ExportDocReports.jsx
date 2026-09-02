import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Alert, App, Card, Checkbox, Segmented, Space, Table, Tooltip, Typography } from 'antd';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import { FormSelect } from '../../../components/form';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../utils/paginationConfig';
import { DOC_TYPE, DOC_TYPE_LABELS } from '../../../utils/expDocConstants';
import { listShipmentOptions } from '../../../services/expdoc/expDocService';
import { buildReports } from './reportDefinitions';

const { Text } = Typography;

/**
 * The seven §22 reports on one screen.
 *
 * One screen with a report selector rather than seven near-identical pages: the PRD
 * asks for the same filter bar, the same server-side paging and the same permission
 * behaviour on all of them, and seven copies is how those stop being the same.
 */
const ExportDocReports = () => {
  const { message } = App.useApp();
  // Built once: the definitions close over nothing that changes.
  const reports = useMemo(() => buildReports(), []);
  const [reportKey, setReportKey] = useState(() => buildReports()[0].key);
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 15, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [docType, setDocType] = useState();
  const [shipmentId, setShipmentId] = useState();
  const [outsideOnly, setOutsideOnly] = useState(false);
  const [gapsOnly, setGapsOnly] = useState(false);
  const [shipments, setShipments] = useState([]);

  const report = useMemo(() => reports.find((r) => r.key === reportKey), [reports, reportKey]);

  const pagRef = useRef(pagination);
  useEffect(() => { pagRef.current = pagination; }, [pagination]);

  useEffect(() => {
    listShipmentOptions().then((s) => {
      setShipments(s);
      // The carton list needs a shipment to mean anything, so it opens on one.
      setShipmentId((cur) => cur ?? s[0]?.value);
    }).catch(() => setShipments([]));
  }, []);

  const fetchData = useCallback(async (page, pageSize) => {
    const current = pagRef.current;
    const nextPage = page || current.current;
    const nextSize = pageSize || current.pageSize;
    setLoading(true);
    try {
      const params = { page: nextPage - 1, size: nextSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (report.filters.includes('docType') && docType) params.docType = docType;
      if (report.filters.includes('shipment')) params.shipmentId = shipmentId;
      if (report.filters.includes('outsideToleranceOnly') && outsideOnly) params.outsideToleranceOnly = true;
      if (report.filters.includes('gapsOnly') && gapsOnly) params.gapsOnly = true;
      const res = await report.fetch(params);
      setRows(res.content || []);
      setMeta(res);
      setPagination((p) => ({ ...p, current: nextPage, pageSize: nextSize, total: res.totalElements || 0 }));
    } catch (e) {
      message.error(e.message || 'Failed to run the report');
      setRows([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, [report, debouncedSearch, docType, shipmentId, outsideOnly, gapsOnly, message]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const filters = useMemo(() => {
    const list = [];
    if (report.filters.includes('docType')) {
      list.push({
        key: 'docType',
        type: 'select',
        span: { xs: 12, sm: 8, md: 5, lg: 4 },
        props: {
          placeholder: 'Document',
          value: docType,
          onChange: setDocType,
          options: Object.values(DOC_TYPE).map((d) => ({ value: d, label: DOC_TYPE_LABELS[d] })),
        },
      });
    }
    return list;
  }, [report, docType]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Export Documentation Reports"
        subtitle="Every figure here is read from the documents themselves, so a report can never state a number the document does not"
      >
        <Tooltip title="Server-side Excel export arrives with the API phase; the reports are paged at the source and ready for it.">
          <span><ActionButton action="custom" text="Excel" disabled /></span>
        </Tooltip>
      </PageHeader>

      <Card style={{ marginBottom: 16 }} styles={{ body: { paddingBottom: 12 } }}>
        {/* Full width: seven reports read as a tab strip across the card rather than
            a cluster hugging the left edge. */}
        <Segmented
          block
          options={reports.map((r) => ({ value: r.key, label: r.label }))}
          value={reportKey}
          onChange={(k) => { setReportKey(k); setPagination((p) => ({ ...p, current: 1 })); }}
          style={{ marginBottom: 10, width: '100%' }}
        />
        <div><Text type="secondary" style={{ fontSize: 12 }}>{report.blurb}</Text></div>
      </Card>

      {/* The invoice register's whole purpose is the gapless series, so a gap is an
          alert rather than a column someone has to notice. */}
      {reportKey === 'INVOICE_REGISTER' && meta && meta.seriesIsGapless === false && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title="The approved invoice series has gaps"
          description={meta.gaps
            .map((g) => `${g.fy}: ${g.missing} number(s) missing between ${g.after} and ${g.before}`)
            .join(' · ')}
        />
      )}
      {reportKey === 'INVOICE_REGISTER' && meta?.seriesIsGapless && rows.length > 0 && (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
          title="The approved series is gapless"
          description="Every allocated number is present and in sequence."
        />
      )}
      {reportKey === 'TEMPLATE_COVERAGE' && meta?.overrides?.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={`${meta.overrides.length} document(s) use an overridden template`}
          description={meta.overrides.map((o) => `${o.docNo} (${o.reason || 'no reason recorded'})`).join(' · ')}
        />
      )}

      <Card>
        <Space wrap size={12} style={{ marginBottom: 12 }}>
          {report.filters.includes('shipment') && (
            <div style={{ minWidth: 260 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Shipment</Text>
              <FormSelect
                variant="default"
                allowClear={false}
                style={{ width: '100%' }}
                value={shipmentId}
                onChange={setShipmentId}
                options={shipments}
                placeholder="Pick a shipment"
              />
            </div>
          )}
          {report.filters.includes('outsideToleranceOnly') && (
            <Checkbox checked={outsideOnly} onChange={(e) => setOutsideOnly(e.target.checked)}>
              Outside tolerance only
            </Checkbox>
          )}
          {report.filters.includes('gapsOnly') && (
            <Checkbox checked={gapsOnly} onChange={(e) => setGapsOnly(e.target.checked)}>
              Gaps only
            </Checkbox>
          )}
        </Space>

        {report.filters.includes('search') && (
          <SearchFilterBar
            searchText={searchText}
            onSearchChange={setSearchText}
            searchPlaceholder="Search"
            filters={filters}
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          columns={report.columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: report.scroll }}
          onChange={(pag) => fetchData(pag.current, pag.pageSize)}
          pagination={getTablePagination(pagination, 'rows')}
          locale={{
            emptyText: (
              <EmptyState
                title="Nothing to report yet"
                description={report.requiresShipment && !shipmentId
                  ? 'Pick a shipment to list its cartons.'
                  : 'No rows match. Build a packing list or an invoice and the figures appear here.'}
                showAction={false}
              />
            ),
          }}
        />
        {reportKey === 'CARTON_MASTER' && meta?.cartonRangeLabel && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {`${meta.shipmentNo} · cartons ${meta.cartonRangeLabel} · only this page is expanded, so a shipment of any size opens instantly.`}
          </Text>
        )}
      </Card>
    </div>
  );
};

export default ExportDocReports;
