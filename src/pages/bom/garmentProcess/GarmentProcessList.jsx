import { useCallback, useMemo } from 'react';
import { Card, Table } from 'antd';
import { useNavigate } from 'react-router-dom';
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
import { GPR_MODULE_ID } from '../../../utils/garmentProcessConstants';
import { listGprs, getGprFilterOptions } from '../../../services/bom/garmentProcess/garmentProcessService';
import { buildGarmentProcessListColumns } from './garmentProcessListColumns';

const fetchPage = ({ created, ...rest }) => listGprs({ ...rest, createdFrom: created?.[0], createdTo: created?.[1] });

/** Garment Process Requirement list (PRD §15) — newest first, paged and filtered on the server. */
const GarmentProcessList = () => {
  const navigate = useNavigate();
  const list = useServerList(fetchPage,
    { orderNo: undefined, styleNo: undefined, process: undefined, status: undefined, created: null },
    'Could not load garment process requirements');
  const options = useFilterOptions(getGprFilterOptions);
  const canUpdate = hasPermission(GPR_MODULE_ID, 'update');

  const openRow = useCallback((r) => navigate(`/bom/garment-process/${r.id}`), [navigate]);
  const editRow = useCallback((r) => navigate(`/bom/garment-process/${r.id}?edit=1`), [navigate]);
  const columns = useMemo(() => buildGarmentProcessListColumns({ onOpen: openRow, onEdit: editRow, canUpdate }), [openRow, editRow, canUpdate]);

  const selectFilter = (key, placeholder, opts) => ({
    type: 'select',
    span: { xs: 12, sm: 8, md: 4, lg: 3 },
    props: { placeholder, value: list.filters[key], onChange: list.setFilter(key), options: opts, allowClear: true, 'aria-label': placeholder },
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
          searchText={list.searchText}
          onSearchChange={(e) => list.setSearchText(e.target.value)}
          searchPlaceholder="Search requirement no, order, style..."
          filters={[
            selectFilter('orderNo', 'Order No.', textOptions(options.orderNos)),
            selectFilter('styleNo', 'Style', textOptions(options.styleNos)),
            selectFilter('process', 'Process', textOptions(options.processes)),
            selectFilter('status', 'Status', REQUIREMENT_STATUS_OPTIONS),
            {
              type: 'rangePicker',
              span: { xs: 24, sm: 12, md: 6, lg: 5 },
              props: { placeholder: ['Date from', 'Date to'], value: list.filters.created, onChange: list.setFilter('created') },
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
          scroll={{ x: 1250 }}
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'requirements')}
          onChange={list.onTableChange}
          locale={{ emptyText: <EmptyState title="No garment process requirements" description="Adjust the filters, or create one from a confirmed order." /> }}
        />
      </Card>
    </div>
  );
};

export default GarmentProcessList;
