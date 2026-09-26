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
import { toastUnlessHandled } from '../../../utils/apiError';
import { GPR_MODULE_ID } from '../../../utils/garmentProcessConstants';
import { listGprs } from '../../../services/bom/garmentProcess/garmentProcessService';
import { buildGarmentProcessListColumns } from './garmentProcessListColumns';

const uniqueOptions = (values) => [...new Set(values)].sort().map((v) => ({ value: v, label: v }));

/** Garment Process Requirement list (PRD §15) — newest first; a row opens the same single screen. */
const GarmentProcessList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [filters, setFilters] = useState({ orderNo: undefined, styleNo: undefined, process: undefined, status: undefined, created: null });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });
  const canUpdate = hasPermission(GPR_MODULE_ID, 'update');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listGprs());
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load garment process requirements');
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
    return rows.filter((r) => (!q || [r.requirementNo, r.orderNo, r.styleNo].some((v) => String(v).toLowerCase().includes(q)))
      && (!filters.orderNo || r.orderNo === filters.orderNo)
      && (!filters.styleNo || r.styleNo === filters.styleNo)
      && (!filters.process || r.lines.some((l) => l.label === filters.process))
      && (!filters.status || r.status === filters.status)
      && (!from || !dayjs(r.createdOn).isBefore(from, 'day'))
      && (!to || !dayjs(r.createdOn).isAfter(to, 'day')));
  }, [rows, debouncedSearch, filters]);

  const openRow = useCallback((r) => navigate(`/bom/garment-process/${r.id}`), [navigate]);
  const columns = useMemo(() => buildGarmentProcessListColumns({ onOpen: openRow, canUpdate }), [openRow, canUpdate]);

  const selectFilter = (key, placeholder, options) => ({
    type: 'select',
    span: { xs: 12, sm: 8, md: 4, lg: 3 },
    props: { placeholder, value: filters[key], onChange: setFilter(key), options, 'aria-label': placeholder },
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Garment Process Requirements" subtitle="Processes needed on sewn garments — released to the PO module on submit">
        <PermissionGuard module={GPR_MODULE_ID} operation="add">
          <ActionButton action="create" text="New Garment Process Requirement" onClick={() => navigate('/bom/garment-process/new')} />
        </PermissionGuard>
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search requirement no, order, style..."
          filters={[
            selectFilter('orderNo', 'Order No.', uniqueOptions(rows.map((r) => r.orderNo))),
            selectFilter('styleNo', 'Style', uniqueOptions(rows.map((r) => r.styleNo))),
            selectFilter('process', 'Process', uniqueOptions(rows.flatMap((r) => r.lines.map((l) => l.label)))),
            selectFilter('status', 'Status', REQUIREMENT_STATUS_OPTIONS),
            {
              type: 'rangePicker',
              span: { xs: 24, sm: 12, md: 6, lg: 5 },
              props: { placeholder: ['Date from', 'Date to'], value: filters.created, onChange: setFilter('created') },
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
          scroll={{ x: 1250 }}
          pagination={getTablePagination({ ...pagination, total: filtered.length }, 'requirements')}
          onChange={(p) => setPagination({ current: p.current, pageSize: p.pageSize })}
          locale={{ emptyText: <EmptyState title="No garment process requirements" description="Adjust the filters, or create one from a confirmed order." /> }}
        />
      </Card>
    </div>
  );
};

export default GarmentProcessList;
