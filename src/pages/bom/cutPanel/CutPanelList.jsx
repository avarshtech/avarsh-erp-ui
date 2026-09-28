import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Card, Table } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../utils/paginationConfig';
import { hasPermission } from '../../../utils/permissions';
import { REQUIREMENT_STATUS_OPTIONS } from '../../../utils/requirementStatus';
import { getCurrentFinancialYear } from '../../../utils/numbering';
import { toastUnlessHandled } from '../../../utils/apiError';
import { CPR_MODULE_ID } from '../../../utils/cutPanelConstants';
import { listCprs } from '../../../services/bom/cutPanel/cutPanelService';
import { buildCutPanelListColumns } from './cutPanelListColumns';

/** Current financial year, 1 April – 31 March — the list's default created-date range (PRD §7.2). */
const currentFyRange = () => {
  const start = Number(`20${getCurrentFinancialYear().slice(0, 2)}`);
  return [dayjs(`${start}-04-01`), dayjs(`${start + 1}-03-31`)];
};

const uniqueOptions = (rows, field) =>
  [...new Set(rows.map((r) => r[field]))].sort().map((v) => ({ value: v, label: v }));

/** Cut Panel Requirement register — the landing screen of BOM → Cut Panel (PRD §7). */
const CutPanelList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [filters, setFilters] = useState({ orderNo: undefined, buyer: undefined, styleNo: undefined, status: undefined, created: currentFyRange() });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const canUpdate = hasPermission(CPR_MODULE_ID, 'update');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listCprs());
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load cut panel requirements');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);

  const setFilter = useCallback((key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPagination((p) => ({ ...p, current: 1 }));
  }, []);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const [from, to] = filters.created || [];
    return rows.filter((r) => (!q || [r.cprNo, r.orderNo, r.buyer, r.styleNo].some((v) => String(v).toLowerCase().includes(q)))
      && (!filters.orderNo || r.orderNo === filters.orderNo)
      && (!filters.buyer || r.buyer === filters.buyer)
      && (!filters.styleNo || r.styleNo === filters.styleNo)
      && (!filters.status || r.status === filters.status)
      && (!from || !dayjs(r.createdOn).isBefore(from, 'day'))
      && (!to || !dayjs(r.createdOn).isAfter(to, 'day')));
  }, [rows, debouncedSearch, filters]);

  const openRow = useCallback((r) => navigate(`/bom/cut-panel/${r.id}`), [navigate]);
  const columns = useMemo(() => buildCutPanelListColumns({ onOpen: openRow, canUpdate }), [openRow, canUpdate]);

  const selectFilter = (key, placeholder, options) => ({
    type: 'select',
    span: { xs: 12, sm: 8, md: 4, lg: 3 },
    props: { placeholder, value: filters[key], onChange: setFilter(key), options, 'aria-label': placeholder },
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Cut Panel Requirements" subtitle="Processes needed on cut panels before sewing — released to the PO module on submit">
        <PermissionGuard module={CPR_MODULE_ID} operation="add">
          <ActionButton action="create" text="New Cut Panel Requirement" onClick={() => navigate('/bom/cut-panel/new')} />
        </PermissionGuard>
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search CPR no, order, buyer, style..."
          filters={[
            selectFilter('orderNo', 'Order No.', uniqueOptions(rows, 'orderNo')),
            selectFilter('buyer', 'Buyer', uniqueOptions(rows, 'buyer')),
            selectFilter('styleNo', 'Style', uniqueOptions(rows, 'styleNo')),
            selectFilter('status', 'Status', REQUIREMENT_STATUS_OPTIONS),
            {
              type: 'rangePicker',
              span: { xs: 24, sm: 12, md: 6, lg: 5 },
              props: { placeholder: ['Created from', 'Created to'], value: filters.created, onChange: setFilter('created') },
            },
          ]}
          onRefresh={load}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={filtered}
          loading={loading}
          rowKey="id"
          size="middle"
          scroll={{ x: 1400 }}
          pagination={getTablePagination({ ...pagination, total: filtered.length }, 'requirements')}
          onChange={(p) => setPagination({ current: p.current, pageSize: p.pageSize })}
          locale={{ emptyText: <EmptyState title="No cut panel requirements" description="Adjust the filters, or create one from an order with an approved BOM." /> }}
        />
      </Card>
    </div>
  );
};

export default CutPanelList;
