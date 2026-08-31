import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { App, Card, Table, Row, Col, Space, Segmented, Input, Select, DatePicker } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  SearchOutlined,
  FileSearchOutlined,
  AuditOutlined,
  PauseCircleOutlined,
  CheckCircleOutlined,
  MinusCircleOutlined,
  SendOutlined,
} from '@ant-design/icons';
import {
  searchBills,
  searchBillLines,
  deleteBill,
  listBpSuppliers,
  listBillablePos,
} from '../../../services/inventory/billPassingService';
import {
  BILL_QUICK_FILTER,
  BILL_PASSING_STATUS_LABEL,
  BP_MODULE_ID,
} from '../../../utils/billPassingConstants';
import { hasPermission } from '../../../utils/permissions';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import PageHeader from '../../../components/PageHeader';
import PermissionGuard from '../../../components/PermissionGuard';
import StatCard from '../../../components/StatCard';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import { getBillPassingListColumns } from './BillPassingListColumns';
import { getBillPassingLinesColumns } from './BillPassingLinesColumns';
import BillPassingViewModal from './BillPassingViewModal';
import BillPassingCreateModal from './BillPassingCreateModal';

const { RangePicker } = DatePicker;

const VIEW = { BILLS: 'Bills', LINES: 'Lines' };

const QUICK_FILTER_OPTIONS = [
  { label: 'Pending', value: BILL_QUICK_FILTER.PENDING },
  { label: 'Passed', value: BILL_QUICK_FILTER.PASSED },
  { label: 'On Hold', value: BILL_QUICK_FILTER.ON_HOLD },
  { label: 'Rejected', value: BILL_QUICK_FILTER.REJECTED },
  { label: 'All', value: BILL_QUICK_FILTER.ALL },
];

const STATUS_OPTIONS = Object.entries(BILL_PASSING_STATUS_LABEL).map(([value, label]) => ({ value, label }));

const KPI_CARDS = [
  { key: 'pendingVerification', title: 'Pending Verification', icon: <FileSearchOutlined />, color: 'var(--primary-color)' },
  { key: 'pendingApproval', title: 'Pending Approval', icon: <AuditOutlined />, color: 'var(--warning-color)' },
  { key: 'onHoldOrQuery', title: 'On Hold / Query', icon: <PauseCircleOutlined />, color: 'var(--error-color)' },
  { key: 'passedThisMonth', title: 'Passed This Month', icon: <CheckCircleOutlined />, color: 'var(--success-color)' },
  { key: 'totalDebitMtd', title: 'Total Debit (MTD)', icon: <MinusCircleOutlined />, color: 'var(--warning-color)', currency: true },
  { key: 'sentToAccountsMtd', title: 'Sent to Accounts (MTD)', icon: <SendOutlined />, color: 'var(--success-color)', currency: true },
];

const BillPassingList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();

  const [view, setView] = useState(VIEW.BILLS);
  const [quickFilter, setQuickFilter] = useState(BILL_QUICK_FILTER.PENDING);
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [supplierId, setSupplierId] = useState(undefined);
  const [poId, setPoId] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [invoiceRange, setInvoiceRange] = useState(null);

  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  const [suppliers, setSuppliers] = useState([]);
  const [pos, setPos] = useState([]);
  const [viewBillId, setViewBillId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  // Only the newest request may paint: a filter change also resets the page, so
  // two fetches can be in flight and land out of order.
  const reqRef = useRef(0);

  const canUpdate = hasPermission(BP_MODULE_ID, 'update');
  const canDelete = hasPermission(BP_MODULE_ID, 'delete');

  const fetchData = useCallback(async () => {
    const seq = ++reqRef.current;
    setLoading(true);
    try {
      const params = {
        search: debouncedSearch || undefined,
        supplierId: supplierId || undefined,
        poId: poId || undefined,
        page: pagination.current - 1,
        size: pagination.pageSize,
      };
      if (view === VIEW.BILLS) {
        const res = await searchBills({
          ...params,
          status: statusFilter || undefined,
          quickFilter,
          invoiceFrom: invoiceRange?.[0]?.format('YYYY-MM-DD'),
          invoiceTo: invoiceRange?.[1]?.format('YYYY-MM-DD'),
        });
        if (seq !== reqRef.current) return;
        setRows(res.content || []);
        setTotal(res.totalElements || 0);
        // Only the bill search carries the KPI block; keep the last values while
        // the user is browsing the line register.
        setStats(res.stats || null);
      } else {
        const res = await searchBillLines(params);
        if (seq !== reqRef.current) return;
        setRows(res.content || []);
        setTotal(res.totalElements || 0);
      }
    } catch (e) {
      if (seq !== reqRef.current) return;
      message.error(e.message || 'Failed to load bill passing records');
      setRows([]);
      setTotal(0);
    } finally {
      if (seq === reqRef.current) setLoading(false);
    }
  }, [view, quickFilter, debouncedSearch, supplierId, poId, statusFilter, invoiceRange, pagination, message]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Any filter change sends the user back to page 1. Returning the same object
  // when already on page 1 lets React bail out instead of refetching twice.
  useEffect(() => {
    setPagination((p) => (p.current === 1 ? p : { ...p, current: 1 }));
  }, [view, quickFilter, debouncedSearch, supplierId, poId, statusFilter, invoiceRange]);

  useEffect(() => {
    listBpSuppliers()
      .then((res) => setSuppliers(res || []))
      .catch(() => setSuppliers([]));
  }, []);

  useEffect(() => {
    let alive = true;
    listBillablePos({ supplierId: supplierId || undefined })
      .then((res) => { if (alive) setPos(res || []); })
      .catch(() => { if (alive) setPos([]); });
    return () => { alive = false; };
  }, [supplierId]);

  // Deep link from the approvals inbox / notifications (?viewId=X).
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const deepLinkId = searchParams.get('viewId');
    if (!deepLinkId) return;
    setViewBillId(deepLinkId);
    searchParams.delete('viewId');
    setSearchParams(searchParams, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleView = useCallback((record) => setViewBillId(record.id), []);
  const handleEdit = useCallback((record) => navigate(`/inventory/bill-passing/${record.id}`), [navigate]);

  const handleDelete = useCallback(async (record) => {
    try {
      await deleteBill(record.id);
      message.success(`${record.bpNumber} deleted`);
      fetchData();
    } catch (e) {
      message.error(e.message || 'Failed to delete bill');
    }
  }, [message, fetchData]);

  const handleSupplierChange = useCallback((value) => {
    setSupplierId(value);
    setPoId(undefined);
  }, []);

  const billColumns = useMemo(
    () => getBillPassingListColumns({ onView: handleView, onEdit: handleEdit, onDelete: handleDelete, canUpdate, canDelete }),
    [handleView, handleEdit, handleDelete, canUpdate, canDelete],
  );
  const lineColumns = useMemo(() => getBillPassingLinesColumns(), []);

  const supplierOptions = useMemo(() => suppliers.map((s) => ({ value: s.id, label: s.name })), [suppliers]);
  const poOptions = useMemo(() => pos.map((p) => ({ value: p.id, label: p.poNumber })), [pos]);

  const isBills = view === VIEW.BILLS;

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader
        title="Bill Passing"
        subtitle="Verify supplier invoices against PO, GRN and QC before they reach accounts"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <PermissionGuard module={BP_MODULE_ID} operation="add">
          <ActionButton
            action="create"
            text="New Bill Passing"
            onClick={() => setCreateOpen(true)}
          />
        </PermissionGuard>
      </PageHeader>

      {/* Card height is pinned to the stretched Col so a two-line title
          ("Sent to Accounts (MTD)") does not leave its neighbours short. */}
      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 24 }}>
        {KPI_CARDS.map((c) => (
          <Col xs={24} sm={12} lg={4} key={c.key}>
            <StatCard
              title={c.title}
              value={stats?.[c.key] || 0}
              prefix={c.currency ? '₹' : undefined}
              precision={c.currency ? 2 : undefined}
              loading={loading && !stats}
              icon={c.icon}
              color={c.color}
              style={{ height: '100%' }}
            />
          </Col>
        ))}
      </Row>

      <Card>
        <Space style={{ marginBottom: 16, justifyContent: 'space-between', width: '100%' }}>
          <Segmented options={[VIEW.BILLS, VIEW.LINES]} value={view} onChange={setView} />
          {isBills && (
            <Segmented options={QUICK_FILTER_OPTIONS} value={quickFilter} onChange={setQuickFilter} />
          )}
        </Space>

        {/* Spans total 24 in each view so the row fills the card rather than
            leaving dead space on the right when the Lines view drops two filters. */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8} lg={isBills ? 6 : 10}>
            <Input
              placeholder={isBills ? 'Search bill no, supplier, invoice no...' : 'Search PO, supplier, item, GRN...'}
              prefix={<SearchOutlined />}
              style={{ width: '100%' }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={isBills ? 4 : 7}>
            <Select
              placeholder="Supplier"
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={supplierOptions}
              value={supplierId}
              onChange={handleSupplierChange}
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={isBills ? 4 : 7}>
            <Select
              placeholder="Purchase Order"
              style={{ width: '100%' }}
              allowClear
              showSearch
              optionFilterProp="label"
              options={poOptions}
              value={poId}
              onChange={setPoId}
            />
          </Col>
          {isBills && (
            <Col xs={24} sm={12} md={8} lg={4}>
              <Select
                placeholder="Status"
                style={{ width: '100%' }}
                allowClear
                options={STATUS_OPTIONS}
                value={statusFilter}
                onChange={setStatusFilter}
              />
            </Col>
          )}
          {isBills && (
            <Col xs={24} sm={24} md={16} lg={6}>
              <RangePicker
                style={{ width: '100%' }}
                placeholder={['Invoice From', 'Invoice To']}
                format="DD-MMM-YYYY"
                value={invoiceRange}
                onChange={setInvoiceRange}
                allowClear
              />
            </Col>
          )}
        </Row>

        <Table
          size="small"
          rowKey={isBills ? 'id' : 'key'}
          columns={isBills ? billColumns : lineColumns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: isBills ? 2200 : 2000 }}
          pagination={{
            ...getTablePagination(
              { current: pagination.current, pageSize: pagination.pageSize, total },
              isBills ? 'bills' : 'PO lines',
            ),
            onChange: (current, pageSize) => setPagination({ current, pageSize }),
          }}
          locale={{
            emptyText: isBills ? (
              <EmptyState
                title="No bills found"
                description="Create a bill passing entry to start verifying a supplier invoice"
              />
            ) : (
              <EmptyState
                title="No PO lines found"
                description="Lines appear here once a GRN has been received against a purchase order"
              />
            ),
          }}
        />
      </Card>

      <BillPassingViewModal
        open={Boolean(viewBillId)}
        billId={viewBillId}
        onClose={() => setViewBillId(null)}
      />

      <BillPassingCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(created) => {
          setCreateOpen(false);
          navigate(`/inventory/bill-passing/${created.id}`);
        }}
      />
    </div>
  );
};

export default BillPassingList;
