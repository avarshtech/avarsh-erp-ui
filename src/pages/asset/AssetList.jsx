import { useCallback, useMemo, useState } from 'react';
import { Card, Table } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import EmptyState from '../../components/EmptyState';
import PermissionGuard from '../../components/PermissionGuard';
import { ActionButton } from '../../components/buttons';
import useServerList from '../../hooks/useServerList';
import useAssetLookups from '../../hooks/useAssetLookups';
import { getTablePagination } from '../../utils/paginationConfig';
import { hasPermission } from '../../utils/permissions';
import { getAssets } from '../../services/asset/assetService';
import { ASSET_STATUS, ASSET_CONDITION, STATUS_REASON, toOptions } from '../../utils/assetConstants';
import { buildAssetListColumns } from './assetListColumns';
import AssetLabelDialog from './components/AssetLabelDialog';

/** useServerList counts pages from 1; the API counts from 0. */
const fetchPage = ({ page, ...rest }) => getAssets({ ...rest, page: page - 1 });

const STATUS_OPTIONS = toOptions(ASSET_STATUS);
const CONDITION_OPTIONS = toOptions(ASSET_CONDITION);
const REASON_OPTIONS = Object.entries(STATUS_REASON).map(([value, label]) => ({ value, label }));

/** The cover questions people actually ask, as windows rather than dates. */
const EXPIRY_OPTIONS = [
  { value: 0, label: 'Already lapsed' },
  { value: 30, label: 'Lapsing in 30 days' },
  { value: 90, label: 'Lapsing in 90 days' },
];

/**
 * The asset register - the module's landing screen.
 *
 * Disposed assets are hidden unless asked for: they are kept for ever for the
 * audit trail, but they are not what anyone is looking for.
 */
const AssetList = () => {
  const navigate = useNavigate();
  const lookups = useAssetLookups();
  const list = useServerList(
    fetchPage,
    {
      categoryId: undefined, unitId: undefined, departmentId: undefined,
      status: undefined, condition: undefined,
      statusReasonCode: undefined, expiringInDays: undefined,
    },
    'Could not load the asset register',
  );
  const canUpdate = hasPermission('assets', 'update');
  // preserveSelectedRowKeys keeps the picks when the page changes: labelling a
  // whole floor means ticking rows across several pages before printing.
  const [picked, setPicked] = useState({ keys: [], rows: [] });
  const [labelOpen, setLabelOpen] = useState(false);

  const openRow = useCallback((row) => navigate(`/assets/${row.id}`), [navigate]);
  const editRow = useCallback((row) => navigate(`/assets/${row.id}/edit`), [navigate]);
  const columns = useMemo(
    () => buildAssetListColumns({ onOpen: openRow, onEdit: editRow, canUpdate }),
    [openRow, editRow, canUpdate],
  );

  const selectFilter = (key, placeholder, options) => ({
    type: 'select',
    span: { xs: 12, sm: 8, md: 5, lg: 4 },
    props: {
      placeholder, value: list.filters[key], onChange: list.setFilter(key),
      options, allowClear: true, showSearch: true, optionFilterProp: 'label',
      'aria-label': placeholder,
    },
  });

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Asset Register"
        subtitle="Every machine, device and vehicle the company owns, and where it is right now"
      >
        {picked.keys.length > 0 && (
          <ActionButton
            action="print"
            text={`Print ${picked.keys.length} Label${picked.keys.length === 1 ? '' : 's'}`}
            onClick={() => setLabelOpen(true)}
          />
        )}
        <PermissionGuard module="asset-setup" operation="view">
          <ActionButton action="custom" text="Setup" onClick={() => navigate('/assets/setup')} />
        </PermissionGuard>
        <PermissionGuard module="assets" operation="add">
          <ActionButton action="create" text="Add Asset" onClick={() => navigate('/assets/new')} />
        </PermissionGuard>
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={list.searchText}
          onSearchChange={(e) => list.setSearchText(e.target.value)}
          searchPlaceholder="Search asset ID, name, serial no., tag, brand..."
          filters={[
            selectFilter('categoryId', 'Category', lookups.options.categories),
            selectFilter('unitId', 'Unit', lookups.options.units),
            selectFilter('departmentId', 'Department', lookups.departmentsOf(list.filters.unitId)),
            selectFilter('status', 'Status', STATUS_OPTIONS),
            selectFilter('condition', 'Condition', CONDITION_OPTIONS),
            // "Which machines are standing for want of an operator" is a
            // question about the reason, not the status - both read Idle.
            selectFilter('statusReasonCode', 'Reason', REASON_OPTIONS),
            selectFilter('expiringInDays', 'Warranty / AMC', EXPIRY_OPTIONS),
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
          rowSelection={{
            selectedRowKeys: picked.keys,
            preserveSelectedRowKeys: true,
            onChange: (keys, rows) => setPicked({ keys, rows }),
          }}
          scroll={{ x: 'max-content' }}
          className="table-nowrap"
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'assets')}
          onChange={list.onTableChange}
          locale={{
            emptyText: (
              <EmptyState
                title="No assets yet"
                description="Add one, or clear the filters. Set up your categories first so every asset gets the right ID."
              />
            ),
          }}
        />
      </Card>

      <AssetLabelDialog
        open={labelOpen}
        assets={picked.rows}
        onClose={() => setLabelOpen(false)}
      />
    </div>
  );
};

export default AssetList;
