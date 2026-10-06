import { useCallback, useMemo } from 'react';
import { Card, Table } from 'antd';
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
import { REQUIREMENT_STATUS_OPTIONS } from '../../../utils/requirementStatus';
import { getCurrentFinancialYear } from '../../../utils/numbering';
import { CPR_MODULE_ID } from '../../../utils/cutPanelConstants';
import { listCprs, getCprFilterOptions } from '../../../services/bom/cutPanel/cutPanelService';
import { buildCutPanelListColumns } from './cutPanelListColumns';

/** Current financial year, 1 April – 31 March — the list's default created-date range (PRD §7.2). */
const currentFyRange = () => {
  const start = Number(`20${getCurrentFinancialYear().slice(0, 2)}`);
  return [dayjs(`${start}-04-01`), dayjs(`${start + 1}-03-31`)];
};

const fetchPage = ({ created, ...rest }) => listCprs({ ...rest, createdFrom: created?.[0], createdTo: created?.[1] });

/** Cut Panel Requirement register — the landing screen of BOM → Cut Panel (PRD §7); pages and filters on the server. */
const CutPanelList = () => {
  const navigate = useNavigate();
  const list = useServerList(fetchPage,
    { orderNo: undefined, buyer: undefined, styleNo: undefined, status: undefined, created: currentFyRange() },
    'Could not load cut panel requirements');
  const options = useFilterOptions(getCprFilterOptions);
  const canUpdate = hasPermission(CPR_MODULE_ID, 'update');

  const openRow = useCallback((r) => navigate(`/bom/cut-panel/${r.id}`), [navigate]);
  const editRow = useCallback((r) => navigate(`/bom/cut-panel/${r.id}?edit=1`), [navigate]);
  const columns = useMemo(() => buildCutPanelListColumns({ onOpen: openRow, onEdit: editRow, canUpdate }), [openRow, editRow, canUpdate]);

  const selectFilter = (key, placeholder, opts) => ({
    type: 'select',
    span: { xs: 12, sm: 8, md: 4, lg: 3 },
    props: { placeholder, value: list.filters[key], onChange: list.setFilter(key), options: opts, allowClear: true, 'aria-label': placeholder },
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
          searchText={list.searchText}
          onSearchChange={(e) => list.setSearchText(e.target.value)}
          searchPlaceholder="Search CPR no, order, buyer, style..."
          filters={[
            selectFilter('orderNo', 'Order No.', textOptions(options.orderNos)),
            selectFilter('buyer', 'Buyer', textOptions(options.buyers)),
            selectFilter('styleNo', 'Style', textOptions(options.styleNos)),
            selectFilter('status', 'Status', REQUIREMENT_STATUS_OPTIONS),
            {
              type: 'rangePicker',
              span: { xs: 24, sm: 12, md: 6, lg: 5 },
              props: { placeholder: ['Created from', 'Created to'], value: list.filters.created, onChange: list.setFilter('created') },
            },
          ]}
          onRefresh={list.load}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={list.rows}
          loading={list.loading}
          rowKey="id"
          size="middle"
          scroll={{ x: 1400 }}
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'requirements')}
          onChange={list.onTableChange}
          locale={{ emptyText: <EmptyState title="No cut panel requirements" description="Adjust the filters, or create one from an order with an approved BOM." /> }}
        />
      </Card>
    </div>
  );
};

export default CutPanelList;
