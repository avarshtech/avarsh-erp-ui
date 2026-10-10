import { useState, useMemo } from 'react';
import { Card, Table } from 'antd';
import { useNavigate } from 'react-router-dom';
import { JOB_WORK_BILL_DEMO } from '../../../services/inventory/jobWorkBill/jobWorkBillService';
import { BILL_QUICK_FILTER, BP_MODULE_ID } from '../../../utils/billPassingConstants';
import { BILL_SOURCE, billSourceOf, isJobWorkSource } from '../../../utils/jobWorkBillConstants';
import { hasPermission } from '../../../utils/permissions';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import PageHeader from '../../../components/PageHeader';
import PermissionGuard from '../../../components/PermissionGuard';
import { useBranch } from '../../../context/BranchContext';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import { getBillPassingListColumns } from './BillPassingListColumns';
import { getBillPassingLinesColumns } from './BillPassingLinesColumns';
import BillPassingViewModal from './BillPassingViewModal';
import BillPassingCreateModal from './BillPassingCreateModal';
import JobWorkBillViewModal from './jobwork/JobWorkBillViewModal';
import BillKpiCards from './BillKpiCards';
import BillListToolbar from './BillListToolbar';
import { LIST_VIEW } from './billListConstants';
import useBillListActions, { billPath } from './useBillListActions';
import useBillListData from './useBillListData';
import useBillFilterOptions from './useBillFilterOptions';

// While job-work bills are demo data the list opens on supplier bills, so the people working real bills see
// exactly what they saw before; All becomes the default with the API cutover.
const DEFAULT_SOURCE = JOB_WORK_BILL_DEMO ? BILL_SOURCE.SUPPLIER_PO : 'ALL';

const BillPassingList = () => {
  const navigate = useNavigate();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [state, setState] = useState({
    view: LIST_VIEW.BILLS, source: DEFAULT_SOURCE, quickFilter: BILL_QUICK_FILTER.PENDING,
    party: undefined, po: undefined, status: undefined, invoiceRange: null,
  });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const [demoTick, setDemoTick] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const canUpdate = hasPermission(BP_MODULE_ID, 'update');
  const canDelete = hasPermission(BP_MODULE_ID, 'delete');
  // Bills follow the working branch (input credit is per GSTIN); reload when the switcher changes
  const { activeBranchId } = useBranch();

  const { source, party, po, status, quickFilter, invoiceRange } = state;
  const isBills = state.view === LIST_VIEW.BILLS || !(source === 'ALL' || source === BILL_SOURCE.SUPPLIER_PO);
  // Every filter change sends the user back to page 1 (the same object when already there: no second fetch).
  const set = useMemo(() => {
    const toPageOne = () => setPagination((p) => (p.current === 1 ? p : { ...p, current: 1 }));
    const field = (key, clears = []) => (value) => {
      setState((s) => ({ ...s, [key]: value, ...Object.fromEntries(clears.map((k) => [k, undefined])) }));
      toPageOne();
    };
    return {
      view: field('view'), source: field('source', ['party', 'po']), quickFilter: field('quickFilter'),
      party: field('party', ['po']), po: field('po'), status: field('status'), invoiceRange: field('invoiceRange'),
      searchText: (v) => { setSearchText(v); toPageOne(); },
    };
  }, [setSearchText]);

  const filters = useMemo(() => ({
    source, party, po, search: debouncedSearch || undefined,
    ...(isBills ? {
      status: status || undefined, quickFilter,
      invoiceFrom: invoiceRange?.[0]?.format('YYYY-MM-DD'), invoiceTo: invoiceRange?.[1]?.format('YYYY-MM-DD'),
    } : {}),
  }), [source, party, po, debouncedSearch, isBills, status, quickFilter, invoiceRange]);
  const { rows, total, stats, loading, refetch } = useBillListData({ isBills, filters, pagination, refreshKey: `${activeBranchId}:${demoTick}` });
  const { partyOptions, poOptions } = useBillFilterOptions(source, party, demoTick);


  const {
    viewing, setViewing, resetting, handleView, handleEdit, handleDelete, handleResetDemo,
  } = useBillListActions({ refetch, onQuickFilter: set.quickFilter, onDemoReset: () => setDemoTick((t) => t + 1) });

  const partyLabel = source === 'ALL' ? 'Party' : billSourceOf(source).party;
  const billColumns = useMemo(
    () => getBillPassingListColumns({ onView: handleView, onEdit: handleEdit, onDelete: handleDelete, canUpdate, canDelete, partyLabel }),
    [handleView, handleEdit, handleDelete, canUpdate, canDelete, partyLabel],
  );
  const lineColumns = useMemo(() => getBillPassingLinesColumns(), []);

  return (
    <div className="animate-fade-in-up inv-page">
      <PageHeader
        title="Bill Passing"
        subtitle="Verify supplier and job-work invoices against the PO, what came back and its QC before they reach accounts"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <PermissionGuard module={BP_MODULE_ID} operation="add">
          <ActionButton action="create" text="New Bill Passing" onClick={() => { setCreateKey((k) => k + 1); setCreateOpen(true); }} />
        </PermissionGuard>
      </PageHeader>

      <BillKpiCards stats={stats} loading={loading} />

      <Card>
        <BillListToolbar
          state={{ ...state, view: isBills ? LIST_VIEW.BILLS : LIST_VIEW.LINES, searchText }}
          set={set}
          partyOptions={partyOptions}
          poOptions={poOptions}
          showDemo={JOB_WORK_BILL_DEMO && source !== BILL_SOURCE.SUPPLIER_PO}
          resetting={resetting}
          onResetDemo={handleResetDemo}
        />
        <Table
          size="small"
          className="table-nowrap"
          rowKey="key"
          columns={isBills ? billColumns : lineColumns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 'max-content' }}
          pagination={{
            ...getTablePagination({ current: pagination.current, pageSize: pagination.pageSize, total }, isBills ? 'bills' : 'PO lines'),
            onChange: (current, pageSize) => setPagination({ current, pageSize }),
          }}
          locale={{
            emptyText: isBills
              ? <EmptyState title="No bills found" description="Create a bill passing entry to start verifying an invoice" />
              : <EmptyState title="No PO lines found" description="Lines appear here once a GRN has been received against a purchase order" />,
          }}
        />
      </Card>

      <BillPassingViewModal
        open={viewing?.source === BILL_SOURCE.SUPPLIER_PO}
        billId={viewing?.source === BILL_SOURCE.SUPPLIER_PO ? viewing.id : null}
        onClose={() => setViewing(null)}
        onEdit={canUpdate ? handleEdit : undefined}
      />
      <JobWorkBillViewModal
        open={isJobWorkSource(viewing?.source)}
        billId={isJobWorkSource(viewing?.source) ? viewing.id : null}
        onClose={() => setViewing(null)}
        onEdit={canUpdate ? (bill) => navigate(billPath({ source: bill.source, id: bill.id })) : undefined}
      />
      <BillPassingCreateModal
        key={createKey}
        open={createOpen}
        initialSource={source === 'ALL' ? BILL_SOURCE.SUPPLIER_PO : source}
        onClose={() => setCreateOpen(false)}
        onCreated={(created, createdSource) => {
          setCreateOpen(false);
          navigate(billPath({ source: createdSource, id: created.id }));
        }}
      />
    </div>
  );
};

export default BillPassingList;
