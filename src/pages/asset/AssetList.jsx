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
import useUrlFilters from '../../hooks/useUrlFilters';
import { getTablePagination } from '../../utils/paginationConfig';
import { hasPermission } from '../../utils/permissions';
import { getAssets } from '../../services/asset/assetService';
import { buildAssetListColumns } from './assetListColumns';
import { ATTENTION, buildAssetListFilters } from './assetListFilters';
import AssetLabelDialog from './components/AssetLabelDialog';

/** useServerList counts pages from 1; the API counts from 0. */
const fetchPage = ({ page, ...rest }) => getAssets({ ...rest, page: page - 1 });

const BLANK = {
  categoryId: undefined, unitId: undefined, departmentId: undefined,
  status: undefined, condition: undefined,
  statusReasonCode: undefined, expiringInDays: undefined,
  maintenanceOverdue: undefined, notVerifiedInDays: undefined,
};

const URL_KEYS = ['status', 'condition', 'unitId', 'departmentId', 'categoryId',
  'maintenanceOverdue', 'notVerifiedInDays', 'expiringInDays'];
const URL_NUMERIC = ['unitId', 'departmentId', 'categoryId', 'notVerifiedInDays', 'expiringInDays'];

/**
 * The asset register - the module's main list.
 *
 * Disposed assets are hidden unless asked for: they are kept for ever for the
 * audit trail, but they are not what anyone is looking for.
 *
 * Filters can arrive in the URL, so the dashboard's pending rows land on the
 * queue they counted rather than on everything.
 */
const AssetList = () => {
  const navigate = useNavigate();
  const lookups = useAssetLookups();
  const fromUrl = useUrlFilters(URL_KEYS, { numeric: URL_NUMERIC });
  const list = useServerList(fetchPage, { ...BLANK, ...fromUrl }, 'Could not load the asset register');
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

  /** One select standing for two server filters, so clearing it clears both. */
  const onAttentionChange = (value) => {
    const picks = ATTENTION[value]?.filters ?? { maintenanceOverdue: undefined, notVerifiedInDays: undefined };
    list.setFilter('maintenanceOverdue')(picks.maintenanceOverdue);
    list.setFilter('notVerifiedInDays')(picks.notVerifiedInDays);
  };

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
        <PermissionGuard module="asset-dashboard" operation="view">
          <ActionButton action="custom" text="Dashboard" onClick={() => navigate('/assets/dashboard')} />
        </PermissionGuard>
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
          filters={buildAssetListFilters({ list, lookups, onAttentionChange })}
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
