import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { App, Card, Col, Row, Table } from 'antd';
import { FileTextOutlined, SendOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import StatCard from '../../../components/StatCard';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../utils/paginationConfig';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE, INVOICE_STATUS, INVOICE_STATUS_LABELS } from '../../../utils/expDocConstants';
import { searchInvoices, deleteInvoice } from '../../../services/expdoc/expDocService';
import { buildInvoiceColumns } from './InvoiceListColumns';
import InvoiceCreateModal from './InvoiceCreateModal';

const STATUS_OPTIONS = Object.values(INVOICE_STATUS)
  .map((s) => ({ value: s, label: INVOICE_STATUS_LABELS[s] }));

/** Export invoice register. */
const ExportInvoiceList = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState();
  const [createOpen, setCreateOpen] = useState(false);

  const canAdd = hasPermission(EXPDOC_MODULE.INVOICE, 'add');
  const canDelete = hasPermission(EXPDOC_MODULE.INVOICE, 'delete');

  const pagRef = useRef(pagination);
  useEffect(() => { pagRef.current = pagination; }, [pagination]);

  const fetchData = useCallback(async (page, pageSize) => {
    const current = pagRef.current;
    const nextPage = page || current.current;
    const nextSize = pageSize || current.pageSize;
    setLoading(true);
    try {
      const params = { page: nextPage - 1, size: nextSize };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      const res = await searchInvoices(params);
      setRows(res.content || []);
      setPagination((p) => ({ ...p, current: nextPage, pageSize: nextSize, total: res.totalElements || 0 }));
    } catch (e) {
      message.error(e.message || 'Failed to load invoices');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, message]);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleDelete = useCallback(async (record) => {
    try {
      await deleteInvoice(record.id);
      message.success(`${record.provisionalNo || record.invoiceNo} deleted`);
      fetchData();
    } catch (e) {
      message.error(e.message || 'Failed to delete the invoice');
    }
  }, [message, fetchData]);

  const open = useCallback(
    (record) => navigate(`/export-docs/invoices/edit/${record.id}`),
    [navigate],
  );

  const columns = useMemo(
    () => buildInvoiceColumns({ onView: open, onDelete: handleDelete, canDelete }),
    [open, handleDelete, canDelete],
  );

  // Page-scoped and labelled as such — a page figure presented as a global one is
  // worse than no figure at all.
  const kpis = useMemo(() => ({
    drafts: rows.filter((r) => r.status === INVOICE_STATUS.DRAFT).length,
    submitted: rows.filter((r) => r.status === INVOICE_STATUS.SUBMITTED).length,
    approved: rows.filter((r) => [INVOICE_STATUS.APPROVED, INVOICE_STATUS.EXPORTED].includes(r.status)).length,
    stale: rows.filter((r) => r.isStale).length,
  }), [rows]);

  const filters = useMemo(() => [
    {
      key: 'status',
      type: 'select',
      span: { xs: 12, sm: 8, md: 5, lg: 4 },
      props: { placeholder: 'Status', value: statusFilter, onChange: setStatusFilter, options: STATUS_OPTIONS },
    },
  ], [statusFilter]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Export Invoices"
        subtitle="Commercial invoices raised from approved packing lists — quantities, weights and marks flow across untouched"
        onAdd={canAdd ? () => setCreateOpen(true) : undefined}
        addLabel="New Invoice"
      />

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><StatCard title="Drafts (this page)" value={kpis.drafts} icon={<FileTextOutlined />} color="var(--info-color)" /></Col>
        <Col xs={12} md={6}><StatCard title="Awaiting approval (this page)" value={kpis.submitted} icon={<SendOutlined />} color="var(--accent-color)" /></Col>
        <Col xs={12} md={6}><StatCard title="Approved (this page)" value={kpis.approved} icon={<CheckCircleOutlined />} color="var(--success-color)" /></Col>
        <Col xs={12} md={6}><StatCard title="Built on a changed PL (this page)" value={kpis.stale} icon={<WarningOutlined />} color="var(--warning-color)" /></Col>
      </Row>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search invoice no, buyer or shipment"
          filters={filters}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 1560 }}
          onRow={(record) => ({ onClick: () => open(record), style: { cursor: 'pointer' } })}
          onChange={(pag) => fetchData(pag.current, pag.pageSize)}
          pagination={getTablePagination(pagination, 'invoices')}
          locale={{
            emptyText: (
              <EmptyState
                title="No export invoices yet"
                description="Approve a packing list, then raise its invoice — lines, totals and marks come across without retyping."
                actionLabel={canAdd ? 'New Invoice' : undefined}
                onAction={canAdd ? () => setCreateOpen(true) : undefined}
                showAction={canAdd}
              />
            ),
          }}
        />
      </Card>

      <InvoiceCreateModal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onCreated={(inv) => {
          setCreateOpen(false);
          navigate(`/export-docs/invoices/edit/${inv.id}`);
        }}
      />
    </div>
  );
};

export default ExportInvoiceList;
