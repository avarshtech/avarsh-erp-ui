import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Form, Input, Select, Table } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ActionButton } from '../../components/buttons';
import EmptyState from '../../components/EmptyState';
import useDebouncedSearch from '../../hooks/useDebouncedSearch';
import { deactivateVendor, listVendors } from '../../services/master/vendorService';
import { hasPermission } from '../../utils/permissions';
import { jobWorkApproval } from '../../utils/vendorEligibility';
import { toastUnlessHandled } from '../../utils/apiError';
import { useStore } from '../../context/StoreContext';
import { useMasterAssistant } from './genie/masterGenieContext';
import useVendorProcesses from '../../hooks/useVendorProcesses';
import { vendorColumns } from './vendor/vendorColumns';
import VendorFormModal from './vendor/VendorFormModal';
import VendorDetailsDrawer from './vendor/VendorDetailsDrawer';
import { withoutPrivate } from './vendor/vendorForm';

const APPROVALS = [
  { value: 'approved', label: 'Approved' },
  { value: 'expired', label: 'Expired' },
  { value: 'missing', label: 'Not approved' },
];
const STATUSES = [{ value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }];

/**
 * Vendors: job workers and outside processing units — the parties of the Cut Panel and Garment Process
 * POs, the VENDOR side of Cutting POs and Work Orders, outsourced Finishing POs and the costing sheet's
 * manufacturing rows. Retired vendors stay listed; deactivating never touches the documents that name them.
 */
const VendorMaster = ({ onDirtyChange }) => {
  const { message } = App.useApp();
  const { invalidateCache } = useStore();
  const [form] = Form.useForm();
  const processes = useVendorProcesses();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch(300);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ processId: undefined, approval: undefined, status: 'all' });
  const [modal, setModal] = useState({ open: false, editing: null });
  const [unsaved, setUnsaved] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [deactivatingId, setDeactivatingId] = useState(null);

  const canView = hasPermission('vendor-info', 'view');
  const canAdd = hasPermission('vendor-info', 'add');
  const canUpdate = hasPermission('vendor-info', 'update');
  const canDelete = hasPermission('vendor-info', 'delete');

  // The master keeps its own list, inactive included; the store's `vendors` key is the pickers' options
  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listVendors(true);
      setVendors(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      toastUnlessHandled(message, e, 'Failed to load vendors');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);
  useEffect(() => { onDirtyChange?.(modal.open && unsaved); }, [modal.open, unsaved, onDirtyChange]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return vendors.filter((v) => (!q || [v.name, v.gstin, v.city, v.state, v.contactPerson, v.phone]
      .some((x) => x?.toLowerCase().includes(q)))
      && (filters.processId == null || (v.processIds || []).includes(filters.processId))
      && (!filters.approval || jobWorkApproval(v.jobWorkApprovedUntil).status === filters.approval)
      && (filters.status === 'all' || (filters.status === 'active') === (v.active !== false)));
  }, [vendors, debouncedSearch, filters]);

  const openNew = useCallback(() => setModal({ open: true, editing: null }), []);
  const openEdit = useCallback((record) => { setViewing(null); setModal({ open: true, editing: record }); }, []);
  const closeModal = useCallback(() => { setModal({ open: false, editing: null }); setUnsaved(false); }, []);

  const adopt = useCallback((saved) => {
    const row = withoutPrivate(saved);
    setVendors((prev) => (prev.some((v) => v.id === row.id) ? prev.map((v) => (v.id === row.id ? row : v)) : [row, ...prev]));
    invalidateCache('vendors');
    closeModal();
  }, [invalidateCache, closeModal]);

  const deactivate = useCallback(async (record) => {
    setDeactivatingId(record.id);
    try {
      await deactivateVendor(record.id);
      message.success(`${record.name} deactivated`);
      invalidateCache('vendors');
      await fetchVendors();
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not deactivate the vendor');
    } finally {
      setDeactivatingId(null);
    }
  }, [message, invalidateCache, fetchVendors]);

  const columns = useMemo(() => vendorColumns({
    nameOf: processes.nameOf, onView: setViewing, onEdit: openEdit, onDeactivate: deactivate,
    canView, canUpdate, canDelete, deactivatingId,
  }), [processes.nameOf, openEdit, deactivate, canView, canUpdate, canDelete, deactivatingId]);

  // Laya AI on the Master Data page (see ./genie): the list, the search and the vendor form
  useMasterAssistant({
    rows: filtered, columns, searchText, search: setSearchText,
    openNew: canAdd ? openNew : undefined, openRecord: openEdit, close: closeModal,
    isOpen: modal.open, recordId: modal.editing?.id ?? null,
    form, markDirty: () => setUnsaved(true), refresh: fetchVendors,
  });

  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  return (
    <Card title={<div><div style={{ fontSize: 16, fontWeight: 600 }}>Vendors</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Job workers and outside processing units</div></div>}>
      <div className="master-form-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Input name="vendorSearch" aria-label="Search vendors" placeholder="Search name, GSTIN, city…" prefix={<SearchOutlined />}
            value={searchText} onChange={(e) => setSearchText(e.target.value)} allowClear style={{ width: 260 }} />
          <Select name="vendorProcessFilter" aria-label="Process" placeholder="Process" allowClear showSearch optionFilterProp="label"
            options={processes.options} value={filters.processId} onChange={setFilter('processId')} style={{ width: 200 }} />
          <Select name="vendorApprovalFilter" aria-label="Job-work approval" placeholder="Approval" allowClear
            options={APPROVALS} value={filters.approval} onChange={setFilter('approval')} style={{ width: 150 }} />
          <Select name="vendorStatusFilter" aria-label="Status" options={STATUSES} value={filters.status}
            onChange={setFilter('status')} style={{ width: 110 }} />
        </div>
        {canAdd && <ActionButton action="create" text="Add Vendor" onClick={openNew} />}
      </div>

      <Table
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        loading={loading}
        size="small"
        scroll={{ x: 1230 }}
        pagination={{ showSizeChanger: true, defaultPageSize: 10, pageSizeOptions: ['10', '20', '50', '100'],
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} vendors` }}
        locale={{ emptyText: <EmptyState title="No vendors found" description="Add the job workers you send cut panels or garments to"
          actionLabel={canAdd ? 'Add Vendor' : undefined} onAction={canAdd ? openNew : undefined} /> }}
      />

      <VendorDetailsDrawer vendor={viewing} open={!!viewing} onClose={() => setViewing(null)}
        onEdit={openEdit} canUpdate={canUpdate} nameOf={processes.nameOf} />
      <VendorFormModal open={modal.open} editing={modal.editing} form={form} processes={processes}
        unsaved={unsaved} setUnsaved={setUnsaved} onClose={closeModal} onSaved={adopt} />
    </Card>
  );
};

export default VendorMaster;
