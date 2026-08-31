import { useState, useEffect, useCallback, useMemo } from 'react';
import { App, Table, Card, Row, Col, Tag, Button, Space, Typography, Alert, Modal, Input } from 'antd';
import {
  FileProtectOutlined, FileTextOutlined, SendOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listInvoices, cancelInvoice, duplicateInvoice, getInvoice } from '../../../services/sr/srService';
import { hasPermission } from '../../../utils/permissions';
import {
  SAMPLE_INVOICE_STATUS, SAMPLE_INVOICE_STATUS_LABELS, getInvoiceStatusLabel,
  INVOICE_TYPES, INVOICE_TYPE_LABELS,
} from '../../../utils/sampleRequestConstants';
import { SAMPLE_INVOICE_STATUS_CONFIG } from '../../../utils/statusConfig';
import { printSampleInvoice } from '../../../utils/sampleInvoicePdfGenerator';
import StatCard from '../../../components/StatCard';
import StatusTag from '../../../components/StatusTag';
import RecordLink from '../../../components/RecordLink';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import { formatDate } from '../../../utils/formatters';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import useCompanyProfile from './useCompanyProfile';
import SampleInvoiceView from './SampleInvoiceView';

const { Text } = Typography;

/**
 * Invoices list (R2) — landing page of the invoice area, both types under one
 * menu: COMMERCIAL (customs doc before dispatch) and SAMPLE (chargeable, after
 * dispatch). Invoice Qty is the whole invoice (incl. manual swatch lines);
 * drafts show no number so the series never gains gaps. Cancel requires a
 * reason — shown on the view and logged to the activity trail.
 */
const SampleInvoiceList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const profile = useCompanyProfile();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [cancelState, setCancelState] = useState({ target: null, reason: '', saving: false });

  const canAdd = hasPermission('sample-invoices', 'add');
  const canUpdate = hasPermission('sample-invoices', 'update');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.invoiceType = typeFilter;
      if (dateRange?.length === 2) {
        params.dateFrom = dateRange[0].format('YYYY-MM-DD');
        params.dateTo = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await listInvoices(params);
      setRows(res.content);
      setStats(res.stats);
    } catch { message.error('Failed to load invoices'); } finally { setLoading(false); }
  }, [debouncedSearch, statusFilter, typeFilter, dateRange, message]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handlePrint = useCallback(async (record) => {
    const hide = message.loading('Preparing print…', 0);
    try {
      const full = await getInvoice(record.id);
      if (!printSampleInvoice(full, profile)) message.error('Pop-up blocked — allow pop-ups to print');
    } catch (e) {
      message.error(e.message || 'Failed to load invoice');
    } finally { hide(); }
  }, [profile, message]);

  // Cancel needs a MANDATORY reason (R2) — modal with required TextArea
  const handleCancel = useCallback((record) => {
    setCancelState({ target: record, reason: '', saving: false });
  }, []);

  const submitCancel = useCallback(async () => {
    const { target, reason } = cancelState;
    setCancelState((s) => ({ ...s, saving: true }));
    try {
      await cancelInvoice(target.id, reason.trim());
      message.success(`${target.invoiceNo} cancelled — linked SRs released`);
      setCancelState({ target: null, reason: '', saving: false });
      fetchData();
    } catch (e) {
      message.error(e.message || 'Failed to cancel');
      setCancelState((s) => ({ ...s, saving: false }));
    }
  }, [cancelState, message, fetchData]);

  const handleDuplicate = useCallback(async (record) => {
    try {
      const copy = await duplicateInvoice(record.id);
      message.success('Duplicated to a new draft');
      navigate(`/sample-requests/invoices/edit/${copy.id}`);
    } catch (e) { message.error(e.message || 'Failed to duplicate'); }
  }, [message, navigate]);

  const columns = useMemo(() => [
    {
      title: 'Invoice No', dataIndex: 'invoiceNo', key: 'invoiceNo', fixed: 'left', width: 175,
      // Issued/cancelled invoices open the read-only VIEW; only drafts go to the wizard
      render: (v, r) => (v
        ? (
          <span style={{ whiteSpace: 'nowrap' }}>
            <RecordLink text={v} onClick={() => setViewId(r.id)} />
          </span>
        )
        : <Tag onClick={() => navigate(`/sample-requests/invoices/edit/${r.id}`)} style={{ cursor: 'pointer' }}>DRAFT</Tag>),
    },
    {
      title: 'Type', dataIndex: 'invoiceType', key: 'invoiceType', width: 170,
      render: (t) => (
        <Tag color={t === INVOICE_TYPES.SAMPLE ? 'gold' : 'geekblue'} style={{ whiteSpace: 'nowrap', marginInlineEnd: 0 }}>
          {INVOICE_TYPE_LABELS[t] || t}
        </Tag>
      ),
    },
    {
      title: 'Date', dataIndex: 'invoiceDate', key: 'invoiceDate', width: 130,
      render: (d) => <span style={{ whiteSpace: 'nowrap' }}>{formatDate(d)}</span>,
    },
    { title: 'Consignee', dataIndex: 'consigneeName', key: 'consigneeName', width: 200, ellipsis: true, render: (v) => <Text strong>{v}</Text> },
    { title: 'Destination', dataIndex: 'destinationCountry', key: 'destinationCountry', width: 130 },
    { title: 'SRs / Styles', dataIndex: 'srCount', key: 'srCount', width: 110, align: 'center' },
    {
      title: 'Invoice Qty', dataIndex: 'totalQty', key: 'totalQty', width: 115, align: 'right',
      render: (v) => <Text strong>{v}</Text>,
    },
    { title: 'Curr.', dataIndex: 'currency', key: 'currency', width: 80, align: 'center' },
    {
      title: 'Declared Value', dataIndex: 'declaredValue', key: 'declaredValue', width: 135, align: 'right',
      render: (v) => (v == null ? <Text type="secondary">not entered</Text> : <Text strong>{v.toFixed(2)}</Text>),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 140,
      render: (s) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          <StatusTag status={s} config={SAMPLE_INVOICE_STATUS_CONFIG} getLabel={getInvoiceStatusLabel} />
        </span>
      ),
    },
    {
      title: 'Actions', key: 'actions', fixed: 'right', width: 200,
      // All actions are direct icon buttons (no grouped ⋮ menu)
      render: (_, record) => {
        const draft = record.status === SAMPLE_INVOICE_STATUS.DRAFT;
        return (
          <Space size="small">
            <ActionButton action="view" size="small" onClick={() => setViewId(record.id)} />
            {draft && canUpdate && (
              <ActionButton action="edit" size="small" onClick={() => navigate(`/sample-requests/invoices/edit/${record.id}`)} />
            )}
            <ActionButton action="print" size="small" onClick={() => handlePrint(record)} />
            <ActionButton action="duplicate" size="small" onClick={() => handleDuplicate(record)} />
            {record.status === SAMPLE_INVOICE_STATUS.ISSUED && canUpdate && (
              <ActionButton action="cancel" size="small" tooltip="Cancel Invoice" onClick={() => handleCancel(record)} />
            )}
          </Space>
        );
      },
    },
  ], [navigate, canUpdate, handlePrint, handleDuplicate, handleCancel]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Invoices" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        {canAdd && (
          <ActionButton action="create" text="New Invoice" onClick={() => navigate('/sample-requests/invoices/new')} />
        )}
      </PageHeader>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} lg={6}><StatCard title="Invoices This FY" value={stats?.invoicesThisFy ?? 0} icon={<FileProtectOutlined />} color="#8b5cf6" loading={!stats} /></Col>
        <Col xs={12} lg={6}><StatCard title="Drafts" value={stats?.drafts ?? 0} icon={<FileTextOutlined />} color="#fa8c16" loading={!stats} /></Col>
        <Col xs={12} lg={6}><StatCard title="Awaiting Dispatch" value={stats?.awaitingDispatch ?? 0} icon={<SendOutlined />} color="#14b8a6" loading={!stats} /></Col>
        <Col xs={12} lg={6}>
          <StatCard
            title="SRs Ready, No Invoice" value={stats?.srsReadyNoInvoice ?? 0}
            icon={<WarningOutlined />} color="var(--error-color)" loading={!stats}
            hoverable onClick={() => navigate('/sample-requests/invoices/new')} style={{ cursor: 'pointer' }}
          />
        </Col>
      </Row>

      {stats?.srsReadyNoInvoice > 0 && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message={`${stats.srsReadyNoInvoice} overseas SR${stats.srsReadyNoInvoice > 1 ? 's are' : ' is'} ready to dispatch without an invoice. SRs for the same consignee can go on one invoice.`}
          action={<Button size="small" type="primary" onClick={() => navigate('/sample-requests/invoices/new')}>Create invoice →</Button>}
        />
      )}

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Invoice No, SR No or Style..."
          filters={[
            {
              type: 'select',
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
              props: {
                placeholder: 'Type', value: typeFilter, onChange: setTypeFilter,
                options: Object.entries(INVOICE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
              },
            },
            {
              type: 'select',
              span: { xs: 12, sm: 8, md: 4, lg: 3 },
              props: {
                placeholder: 'Status', value: statusFilter, onChange: setStatusFilter,
                options: Object.entries(SAMPLE_INVOICE_STATUS_LABELS).map(([value, label]) => ({ value, label })),
              },
            },
            {
              type: 'rangePicker',
              span: { xs: 24, sm: 12, md: 6, lg: 5 },
              props: { placeholder: ['Invoice From', 'Invoice To'], value: dateRange, onChange: setDateRange },
            },
          ]}
          onRefresh={fetchData}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          className="roomy-table"
          scroll={{ x: 1585 }}
          pagination={false}
          locale={{
            emptyText: (
              <EmptyState
                title="No invoices"
                description="Overseas dispatch needs a commercial invoice before it ships; a chargeable sample invoice recovers cost when a sample does not convert to a bulk order."
              />
            ),
          }}
        />
      </Card>

      <SampleInvoiceView
        open={viewId != null}
        invoiceId={viewId}
        onClose={() => setViewId(null)}
        onPrint={(inv) => { if (!printSampleInvoice(inv, profile)) message.error('Pop-up blocked — allow pop-ups to print'); }}
        onDuplicate={handleDuplicate}
        onCancelInvoice={handleCancel}
        canUpdate={canUpdate}
      />

      {/* Cancel with MANDATORY reason — stored on the invoice + activity trail */}
      <Modal
        title={`Cancel invoice ${cancelState.target?.invoiceNo || ''}?`}
        open={cancelState.target != null}
        okText="Cancel Invoice"
        okButtonProps={{ danger: true, disabled: !cancelState.reason.trim() }}
        cancelText="Keep Invoice"
        confirmLoading={cancelState.saving}
        onCancel={() => setCancelState({ target: null, reason: '', saving: false })}
        onOk={submitCancel}
        destroyOnHidden
      >
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          Issued invoices are immutable — cancelling releases its SRs for re-invoicing. Correct by
          cancelling and duplicating; the issued number is never altered.
        </Text>
        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Cancellation Reason <Text type="danger">*</Text>
        </Text>
        <Input.TextArea
          rows={3}
          value={cancelState.reason}
          placeholder="Mandatory — shown on the invoice view and logged in the activity trail"
          onChange={(e) => setCancelState((s) => ({ ...s, reason: e.target.value }))}
        />
      </Modal>
    </div>
  );
};

export default SampleInvoiceList;
