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
import { listCpps } from '../../../services/po/cutPanelPo/cutPanelPoService';
import { buildCutPanelPoColumns } from './cutPanelPoListColumns';

const BASE = JOB_WORK_PO_PATH.CPP;
const OPEN = 'OPEN';
const options = (rows, field) => [...new Set(rows.flatMap((r) => [].concat(r[field] || [])))].sort().map((v) => ({ value: v, label: v }));
const inRange = (d, [from, to] = []) => (!from || !dayjs(d).isBefore(from, 'day')) && (!to || !dayjs(d).isAfter(to, 'day'));

/** Cut Panel PO register (PRD FR-26, report R-1): opens on the open POs; CSV export. */
const CutPanelPoList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [filters, setFilters] = useState({ status: OPEN, process: undefined, vendor: undefined, poDate: null, delivery: null });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows((await listCpps()).map((r) => ({ ...r, flags: poFlags({ ...r, type: 'CPP' }, { orderCancelled: r.orderCancelled }) })));
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not load Cut Panel POs');
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
    return rows.filter((r) => (!q || [r.poNo, r.vendorName, ...r.cprNos, ...r.orderNos, ...r.styleNos, ...r.buyers].some((v) => String(v).toLowerCase().includes(q)))
      && (!filters.status || (filters.status === OPEN ? isOpenPo(r.status) : r.status === filters.status))
      && (!filters.process || r.processLabel === filters.process)
      && (!filters.vendor || r.vendorName === filters.vendor)
      && inRange(r.poDate, filters.poDate || []) && inRange(r.requiredDeliveryDate, filters.delivery || []));
  }, [rows, debouncedSearch, filters]);

  const openRow = useCallback((r) => navigate(`${BASE}/${r.id}`), [navigate]);
  const columns = useMemo(() => buildCutPanelPoColumns({ onOpen: openRow, canUpdate: hasPermission('cut-panel', 'update') }), [openRow]);
  const exportCsv = () => downloadCsv([
    ['PO No.', 'PO Date', 'CPR', 'Order', 'Style', 'Buyer', 'Job Worker', 'Process', 'PO Qty', 'PO Value', 'Required Delivery', 'Status', 'Flags'],
    ...filtered.map((r) => [r.poNo, r.poDate, r.cprNos.join(' '), r.orderNos.join(' '), r.styleNos.join(' '), r.buyers.join(' '), r.vendorName,
      r.processLabel, r.poQty, r.poValue, r.requiredDeliveryDate, jobWorkPoStatusLabel(r.status), r.flags.map((f) => f.label).join(' ')]),
  ], `CutPanelPOs_${dayjs().format('YYYYMMDD')}.csv`);
  const select = (key, placeholder, opts) => ({
    type: 'select', span: { xs: 12, sm: 8, md: 4, lg: 3 },
    props: { placeholder, value: filters[key], onChange: setFilter(key), options: opts, allowClear: true, 'aria-label': placeholder },
  });
  const range = (key, placeholder) => ({ type: 'rangePicker', span: { xs: 24, sm: 12, md: 6, lg: 5 }, props: { placeholder, value: filters[key], onChange: setFilter(key) } });

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Cut Panel POs" subtitle="Job work on cut panels — printing, embroidery, washing… — against submitted Cut Panel Requirements">
        <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!filtered.length}>Export CSV</Button>
        <PermissionGuard module="cut-panel" operation="add">
          <ActionButton action="create" text="New Cut Panel PO" onClick={() => navigate(`${BASE}/new`)} />
        </PermissionGuard>
      </PageHeader>
      <Card>
        <SearchFilterBar
          searchText={searchText} onSearchChange={(e) => setSearchText(e.target.value)} onRefresh={load} style={{ marginBottom: 16 }}
          searchPlaceholder="Search PO, CPR, order, style, buyer, job worker..."
          filters={[
            select('status', 'Status', [{ value: OPEN, label: 'Open POs' }, ...jobWorkPoStatusOptions('CPP')]),
            select('process', 'Process', options(rows, 'processLabel')),
            select('vendor', 'Job worker', options(rows, 'vendorName')),
            range('poDate', ['PO date from', 'PO date to']),
            range('delivery', ['Delivery from', 'Delivery to']),
          ]}
        />
        <Table
          columns={columns} dataSource={filtered} loading={loading} rowKey="id" size="middle" scroll={{ x: 1800 }}
          pagination={getTablePagination({ ...pagination, total: filtered.length }, 'POs')}
          onChange={(p) => setPagination({ current: p.current, pageSize: p.pageSize })}
          locale={{ emptyText: <EmptyState title="No Cut Panel POs" description="Adjust the filters, or raise one against a submitted Cut Panel Requirement." /> }}
        />
      </Card>
    </div>
  );
};

export default CutPanelPoList;
