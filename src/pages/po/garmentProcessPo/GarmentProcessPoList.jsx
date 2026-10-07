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
import useFilterOptions, { textOptions } from '../../../hooks/useFilterOptions';
import { getTablePagination } from '../../../utils/paginationConfig';
import { hasPermission } from '../../../utils/permissions';
import { toastUnlessHandled } from '../../../utils/apiError';
import { downloadCsv } from '../../../utils/download';
import { jobWorkPoStatusOptions, jobWorkPoStatusLabel } from '../../../utils/jobWorkPoStatus';
import { JOB_WORK_PO_PATH } from '../../../utils/jobWorkConstants';
import { listGpos, getGpoFilterOptions } from '../../../services/po/garmentProcessPo/garmentProcessPoService';
import JobWorkReasonDialog from '../jobWork/JobWorkReasonDialog';
import { LIST_GUTTER, LIST_SEARCH_FLEX, RANGE_COL, lineFilter } from '../jobWork/jobWorkListFilters';
import { withFlags, allRows } from '../jobWork/jobWorkListPaging';
import { buildGpoListColumns } from './gpoListColumns';
import { GPO_DIALOGS } from './gpoDialogs';
import useGpoListActions from './useGpoListActions';

const BASE = JOB_WORK_PO_PATH.GPO;
const OPEN = 'OPEN';

/** The screen's filters as the server's: several statuses as one list, several processes as repeated params. */
const fetchPage = async ({ status, order, style, vendor, poDate, ...rest }) => withFlags('GPO', await listGpos({
  ...rest, status: status?.length ? status.join(',') : undefined, orderNo: order, styleNo: style, vendorId: vendor,
  poDateFrom: poDate?.[0], poDateTo: poDate?.[1],
}));

/** Garment Process PO list (PRD §22, S1): opens on the open POs; filters of §22 but the delivery date (product team); CSV export. */
const GarmentProcessPoList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const list = useServerList(fetchPage,
    { status: [OPEN], process: [], order: undefined, style: undefined, vendor: undefined, poDate: null },
    'Could not load Garment Process POs');
  const options = useFilterOptions(getGpoFilterOptions);
  const actions = useGpoListActions(list.load);
  const [exporting, setExporting] = useState(false);

  const openRow = useCallback((r) => navigate(`${BASE}/${r.id}`), [navigate]);
  const editRow = useCallback((r) => navigate(`${BASE}/${r.id}?edit=1`), [navigate]);
  const columns = useMemo(() => buildGpoListColumns({
    onOpen: openRow, onEdit: editRow, onPrint: actions.print, onCancel: actions.askCancel, printingId: actions.printingId,
    canUpdate: hasPermission('garment-process', 'update'), canCancel: hasPermission('garment-process', 'cancel'),
  }), [openRow, editRow, actions.print, actions.askCancel, actions.printingId]);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await allRows(fetchPage, { ...list.filters, search: list.debouncedSearch.trim() || undefined });
      downloadCsv([
        ['PO No.', 'Requirement No.', 'Order', 'Style', 'Vendor', 'Process', 'Qty', 'Grand Total', 'PO Date', 'Expected Delivery Date', 'Status', 'Flags'],
        ...rows.map((r) => [r.poNo, r.gprNos.join(' '), r.orderNos.join(' '), r.styleNos.join(' '), r.vendorName, r.processLabel, r.poQty,
          r.poValue, r.poDate, r.expectedReturnDate, jobWorkPoStatusLabel(r.status), r.flags.map((f) => f.label).join(' ')]),
      ], `GarmentProcessPOs_${dayjs().format('YYYYMMDD')}.csv`);
    } catch (e) {
      toastUnlessHandled(message, e, 'Could not export the POs');
    } finally {
      setExporting(false);
    }
  };
  const select = (key, placeholder, opts, px, multiple = false) => ({
    type: 'select', ...lineFilter(px, multiple ? { xs: 24, sm: 12, md: 6 } : { xs: 12, sm: 8, md: 4 }),
    props: { placeholder, value: list.filters[key], onChange: list.setFilter(key), options: opts, allowClear: true, 'aria-label': placeholder, ...(multiple ? { mode: 'multiple', maxTagCount: 'responsive' } : {}) },
  });
  const range = (key, placeholder) => ({ type: 'rangePicker', ...lineFilter(RANGE_COL, { xs: 24, sm: 12, md: 8 }), props: { placeholder, value: list.filters[key], onChange: list.setFilter(key) } });

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Garment Process POs" subtitle="Washing, dyeing and finishing by job workers — against submitted Garment Process Requirements">
        <Button icon={<DownloadOutlined />} onClick={exportCsv} loading={exporting} disabled={!list.total}>Export CSV</Button>
        <PermissionGuard module="garment-process" operation="add">
          <ActionButton action="create" text="New Garment Process PO" onClick={() => navigate(`${BASE}/new`)} />
        </PermissionGuard>
      </PageHeader>
      <Card>
        <SearchFilterBar
          searchText={list.searchText} onSearchChange={(e) => list.setSearchText(e.target.value)} onRefresh={list.load} style={{ marginBottom: 16 }}
          searchPlaceholder="Search" searchFlex={LIST_SEARCH_FLEX} gutter={LIST_GUTTER}
          filters={[
            select('status', 'Status', [{ value: OPEN, label: 'Open POs' }, ...jobWorkPoStatusOptions('GPO')], 156, true),
            select('process', 'Process', textOptions(options.processes), 110, true),
            select('order', 'Order', textOptions(options.orderNos), 96), select('style', 'Style', textOptions(options.styleNos), 90),
            select('vendor', 'Vendor', (options.vendors || []).map((v) => ({ value: v.id, label: v.name })), 106),
            range('poDate', ['PO date from', 'PO date to']),
          ]}
        />
        <Table
          columns={columns} dataSource={list.rows} loading={list.loading} rowKey="id" size="middle" scroll={{ x: 'max-content' }} className="table-nowrap"
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'POs')}
          onChange={list.onTableChange}
          locale={{ emptyText: <EmptyState title="No Garment Process POs" description="Adjust the filters, or raise one against a submitted Garment Process Requirement." /> }}
        />
      </Card>
      <JobWorkReasonDialog dialog={actions.cancelling && { open: true, ...GPO_DIALOGS.cancel, title: `Cancel ${actions.cancelling.poNo}` }} onSubmit={actions.cancel} onClose={actions.closeCancel} />
    </div>
  );
};

export default GarmentProcessPoList;
