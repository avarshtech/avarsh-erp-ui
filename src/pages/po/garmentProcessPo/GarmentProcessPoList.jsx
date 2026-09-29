import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Table } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
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
import { toastUnlessHandled } from '../../../utils/apiError';
import { downloadCsv } from '../../../utils/download';
import { jobWorkPoStatusOptions, jobWorkPoStatusLabel, isOpenPo, poFlags } from '../../../utils/jobWorkPoStatus';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { listGpos } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import JobWorkReasonDialog from '../jobWork/JobWorkReasonDialog';
import { LIST_GUTTER, LIST_SEARCH_FLEX, RANGE_COL, lineFilter } from '../jobWork/jobWorkListFilters';
import { buildGpoListColumns } from './gpoListColumns';
import { GPO_DIALOGS } from './gpoDialogs';
import useGpoListActions from './useGpoListActions';

const BASE = JOB_WORK_PO_PATH.GPO;
const OPEN = 'OPEN';
const options = (rows, field) => [...new Set(rows.flatMap((r) => [].concat(r[field] || [])))].sort().map((v) => ({ value: v, label: v }));
const inRange = (d, [from, to] = []) => (!from || !dayjs(d).isBefore(from, 'day')) && (!to || !dayjs(d).isAfter(to, 'day'));

/** Garment Process PO list (PRD §22, S1): opens on the open POs; filters of §22 but the delivery date (product team); CSV export. */
const GarmentProcessPoList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [filters, setFilters] = useState({ status: [OPEN], process: [], order: undefined, style: undefined, vendor: undefined, poDate: null });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await listGpos()).map((r) => ({ ...r, flags: poFlags({ ...r, type: 'GPO' }, { orderCancelled: r.orderCancelled }) })));
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load Garment Process POs');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => { load(); }, [load]);
  const actions = useGpoListActions(load);

  const setFilter = useCallback((key) => (value) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPagination((p) => ({ ...p, current: 1 }));
  }, []);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const st = filters.status || [];
    return rows.filter((r) => (!q || [r.poNo, r.vendorName, ...r.gprNos].some((v) => String(v).toLowerCase().includes(q)))
      && (!st.length || st.some((s) => (s === OPEN ? isOpenPo(r.status) : r.status === s)))
      && (!filters.process?.length || filters.process.includes(r.processLabel))
      && (!filters.order || r.orderNos.includes(filters.order)) && (!filters.style || r.styleNos.includes(filters.style))
      && (!filters.vendor || r.vendorName === filters.vendor) && inRange(r.poDate, filters.poDate || []));
  }, [rows, debouncedSearch, filters]);

  const openRow = useCallback((r) => navigate(`${BASE}/${r.id}`), [navigate]);
  const columns = useMemo(() => buildGpoListColumns({
    onOpen: openRow, onPrint: actions.print, onCancel: actions.askCancel,
    canUpdate: hasPermission('garment-process', 'update'), canCancel: hasPermission('garment-process', 'cancel'),
  }), [openRow, actions.print, actions.askCancel]);
  const exportCsv = () => downloadCsv([
    ['PO No.', 'Requirement No.', 'Order', 'Style', 'Vendor', 'Process', 'Qty', 'Grand Total', 'PO Date', 'Expected Delivery Date', 'Status', 'Flags'],
    ...filtered.map((r) => [r.poNo, r.gprNos.join(' '), r.orderNos.join(' '), r.styleNos.join(' '), r.vendorName, r.processLabel, r.poQty,
      r.poValue, r.poDate, r.expectedReturnDate, jobWorkPoStatusLabel(r.status), r.flags.map((f) => f.label).join(' ')]),
  ], `GarmentProcessPOs_${dayjs().format('YYYYMMDD')}.csv`);
  const select = (key, placeholder, opts, px, multiple = false) => ({
    type: 'select', ...lineFilter(px, multiple ? { xs: 24, sm: 12, md: 6 } : { xs: 12, sm: 8, md: 4 }),
    props: { placeholder, value: filters[key], onChange: setFilter(key), options: opts, allowClear: true, 'aria-label': placeholder, ...(multiple ? { mode: 'multiple', maxTagCount: 'responsive' } : {}) },
  });
  const range = (key, placeholder) => ({ type: 'rangePicker', ...lineFilter(RANGE_COL, { xs: 24, sm: 12, md: 6 }), props: { placeholder, value: filters[key], onChange: setFilter(key) } });

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Garment Process POs" subtitle="Washing, dyeing and finishing by job workers — against submitted Garment Process Requirements">
        <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>
        <PermissionGuard module="garment-process" operation="add">
          <ActionButton action="create" text="New Garment Process PO" onClick={() => navigate(`${BASE}/new`)} />
        </PermissionGuard>
      </PageHeader>
      <Card>
        <SearchFilterBar
          searchText={searchText} onSearchChange={(e) => setSearchText(e.target.value)} onRefresh={load} style={{ marginBottom: 16 }}
          searchPlaceholder="PO no., GPR…" searchFlex={LIST_SEARCH_FLEX} gutter={LIST_GUTTER}
          filters={[
            select('status', 'Status', [{ value: OPEN, label: 'Open POs' }, ...jobWorkPoStatusOptions('GPO')], 156, true),
            select('process', 'Process', options(rows, 'processLabel'), 110, true),
            select('order', 'Order', options(rows, 'orderNos'), 96), select('style', 'Style', options(rows, 'styleNos'), 90),
            select('vendor', 'Vendor', options(rows, 'vendorName'), 106),
            range('poDate', ['PO date from', 'PO date to']),
          ]}
        />
        <Table
          columns={columns} dataSource={filtered} loading={loading} rowKey="id" size="middle" scroll={{ x: 1700 }}
          pagination={getTablePagination({ ...pagination, total: filtered.length }, 'POs')}
          onChange={(p) => setPagination({ current: p.current, pageSize: p.pageSize })}
          locale={{ emptyText: <EmptyState title="No Garment Process POs" description="Adjust the filters, or raise one against a submitted Garment Process Requirement." /> }}
        />
      </Card>
      <JobWorkReasonDialog dialog={actions.cancelling && { open: true, ...GPO_DIALOGS.cancel, title: `Cancel ${actions.cancelling.poNo}` }} onSubmit={actions.cancel} onClose={actions.closeCancel} />
    </div>
  );
};

export default GarmentProcessPoList;
