import { useCallback, useMemo, useState } from 'react';
import { App, Button, Card, Table } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import PermissionGuard from '../../../components/PermissionGuard';
import { ActionButton } from '../../../components/buttons';
import useServerList from '../../../hooks/useServerList';
import useCppListActions from './useCppListActions';
import useFilterOptions, { textOptions } from '../../../hooks/useFilterOptions';
import { getTablePagination } from '../../../utils/paginationConfig';
import { hasPermission } from '../../../utils/permissions';
import { toastUnlessHandled } from '../../../utils/apiError';
import { downloadCsv } from '../../../utils/download';
import { jobWorkPoStatusOptions, jobWorkPoStatusLabel } from '../../../utils/jobWorkPoStatus';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { listCpps, getCppFilterOptions } from '../../../services/po/cutPanelPo/cutPanelPoService';
import { LIST_GUTTER, LIST_SEARCH_FLEX, RANGE_COL, lineFilter } from '../jobWork/jobWorkListFilters';
import { withFlags, allRows } from '../jobWork/jobWorkListPaging';
import { buildCutPanelPoColumns } from './cutPanelPoListColumns';

const BASE = JOB_WORK_PO_PATH.CPP;
const OPEN = 'OPEN';

/** The screen's filters as the server's: the job worker by id, the two date ranges as from / to. */
const fetchPage = async ({ vendor, poDate, delivery, ...rest }) => withFlags('CPP', await listCpps({
  ...rest, vendorId: vendor, poDateFrom: poDate?.[0], poDateTo: poDate?.[1], dueFrom: delivery?.[0], dueTo: delivery?.[1],
}));

/** Cut Panel PO register (PRD FR-26, report R-1): opens on the open POs; paged on the server; CSV export. */
const CutPanelPoList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const list = useServerList(fetchPage,
    { status: OPEN, process: undefined, vendor: undefined, poDate: null, delivery: null },
    'Could not load Cut Panel POs');
  const options = useFilterOptions(getCppFilterOptions);
  const [exporting, setExporting] = useState(false);

  const openRow = useCallback((r) => navigate(`${BASE}/${r.id}`), [navigate]);
  const editRow = useCallback((r) => navigate(`${BASE}/${r.id}?edit=1`), [navigate]);
  const actions = useCppListActions(list.load);
  const columns = useMemo(() => buildCutPanelPoColumns({
    onOpen: openRow, onEdit: editRow, onPrint: actions.print, onDelete: actions.remove, printingId: actions.printingId,
    canUpdate: hasPermission('cut-panel', 'update'), canDelete: hasPermission('cut-panel', 'delete'),
  }), [openRow, editRow, actions.print, actions.remove, actions.printingId]);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await allRows(fetchPage, { ...list.filters, search: list.debouncedSearch.trim() || undefined });
      downloadCsv([
        ['PO No.', 'PO Date', 'CPR', 'Order', 'Style', 'Buyer', 'Job Worker', 'Process', 'PO Qty', 'PO Value', 'Expected Delivery Date', 'Status', 'Flags'],
        ...rows.map((r) => [r.poNo, r.poDate, r.cprNos.join(' '), r.orderNos.join(' '), r.styleNos.join(' '), r.buyers.join(' '), r.vendorName,
          r.processLabel, r.poQty, r.poValue, r.requiredDeliveryDate, jobWorkPoStatusLabel(r.status), r.flags.map((f) => f.label).join(' ')]),
      ], `CutPanelPOs_${dayjs().format('YYYYMMDD')}.csv`);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not export the POs');
    } finally {
      setExporting(false);
    }
  };
  const select = (key, placeholder, opts, px) => ({
    type: 'select', ...lineFilter(px, { xs: 12, sm: 8, md: 4 }),
    props: { placeholder, value: list.filters[key], onChange: list.setFilter(key), options: opts, allowClear: true, 'aria-label': placeholder },
  });
  const range = (key, placeholder) => ({ type: 'rangePicker', ...lineFilter(RANGE_COL, { xs: 24, sm: 12, md: 8 }), props: { placeholder, value: list.filters[key], onChange: list.setFilter(key) } });

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Cut Panel POs" subtitle="Job work on cut panels — printing, embroidery, washing… — against submitted Cut Panel Requirements">
        <Button icon={<DownloadOutlined />} onClick={exportCsv} loading={exporting} disabled={!list.total}>Export CSV</Button>
        <PermissionGuard module="cut-panel" operation="add">
          <ActionButton action="create" text="New Cut Panel PO" onClick={() => navigate(`${BASE}/new`)} />
        </PermissionGuard>
      </PageHeader>
      <Card>
        <SearchFilterBar
          searchText={list.searchText} onSearchChange={(e) => list.setSearchText(e.target.value)} onRefresh={list.load} style={{ marginBottom: 16 }}
          searchPlaceholder="Search" searchFlex={LIST_SEARCH_FLEX} gutter={LIST_GUTTER}
          filters={[
            select('status', 'Status', [{ value: OPEN, label: 'Open POs' }, ...jobWorkPoStatusOptions('CPP')], 124),
            select('process', 'Process', textOptions(options.processes), 110),
            select('vendor', 'Job worker', (options.vendors || []).map((v) => ({ value: v.id, label: v.name })), 132),
            range('poDate', ['PO date from', 'PO date to']),
            range('delivery', ['Delivery from', 'Delivery to']),
          ]}
        />
        <Table
          columns={columns} dataSource={list.rows} loading={list.loading} rowKey="id" size="middle" scroll={{ x: 'max-content' }} className="table-nowrap"
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'POs')}
          onChange={list.onTableChange}
          locale={{ emptyText: <EmptyState title="No Cut Panel POs" description="Adjust the filters, or raise one against a submitted Cut Panel Requirement." /> }}
        />
      </Card>
    </div>
  );
};

export default CutPanelPoList;
