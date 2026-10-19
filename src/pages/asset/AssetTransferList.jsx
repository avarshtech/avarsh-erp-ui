import { useCallback, useMemo } from 'react';
import { Card, Segmented, Table, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import SearchFilterBar from '../../components/SearchFilterBar';
import EmptyState from '../../components/EmptyState';
import PermissionGuard from '../../components/PermissionGuard';
import RecordLink from '../../components/RecordLink';
import { ActionButton } from '../../components/buttons';
import useServerList from '../../hooks/useServerList';
import useUrlFilters from '../../hooks/useUrlFilters';
import useAssetLookups from '../../hooks/useAssetLookups';
import { getTablePagination } from '../../utils/paginationConfig';
import { getTransfers } from '../../services/asset/transferService';
import { TRANSFER_REASON, TRANSFER_STATUS, transferStatusMeta } from '../../utils/assetConstants';

/** useServerList counts pages from 1; the API counts from 0. */
const fetchPage = ({ page, view, ...rest }) => getTransfers({
  ...rest,
  page: page - 1,
  // The three questions people actually open this screen with.
  //   open     - anything still unfinished, wherever it is going
  //   incoming - approved or on a lorry, so it is on its way and not yet here
  //   all      - everything, finished included
  // "Coming to a unit" used to carry the Arriving-at filter's value, so with no
  // unit chosen the whole view collapsed into "All" without saying so.
  ...(view === 'open' ? { openOnly: true } : {}),
  ...(view === 'incoming' ? { incomingOnly: true } : {}),
});

const STATUS_OPTIONS = Object.entries(TRANSFER_STATUS).map(([value, m]) => ({ value, label: m.label }));
const REASON_OPTIONS = Object.entries(TRANSFER_REASON).map(([value, label]) => ({ value, label }));

/**
 * The transfer register.
 *
 * Opens on the moves that still need somebody to do something, because a list
 * of everything that ever happened is a report, not a working screen.
 */
const AssetTransferList = () => {
  const navigate = useNavigate();
  const lookups = useAssetLookups();
  // A status in the URL means the dashboard sent somebody here for that queue.
  // The default "Needs action" view would hide exactly what they clicked, so the
  // segmented control starts on All - and shows that it did, rather than sitting
  // on no selection at all.
  const fromUrl = useUrlFilters(['status', 'fromUnitId', 'toUnitId'],
    { numeric: ['fromUnitId', 'toUnitId'] });
  const list = useServerList(
    fetchPage,
    {
      view: fromUrl.status ? 'all' : 'open',
      status: undefined, reasonCode: undefined, fromUnitId: undefined, toUnitId: undefined,
      ...fromUrl,
    },
    'Could not load the transfers',
  );

  const open = useCallback((row) => navigate(`/assets/transfers/${row.id}`), [navigate]);

  const columns = useMemo(() => [
    {
      title: 'Transfer no.',
      dataIndex: 'transferNo',
      width: 150,
      render: (value, row) => <RecordLink text={value} onClick={() => open(row)} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 150,
      render: (value) => <Tag color={transferStatusMeta(value).color}>{transferStatusMeta(value).label}</Tag>,
    },
    {
      title: 'Moving',
      key: 'route',
      width: 260,
      // From and to in one column: the route is one fact, and two columns of
      // mostly-identical unit names push the rest off a narrow screen.
      render: (_, row) => `${row.fromUnitName} → ${row.toUnitName} / ${row.toDepartmentName}`,
    },
    { title: 'Assets', dataIndex: 'assetCount', width: 80, align: 'right' },
    { title: 'Reason', dataIndex: 'reasonLabel', width: 160, render: (v) => v || '-' },
    {
      title: 'Planned',
      dataIndex: 'plannedDate',
      width: 120,
      render: (value) => (value ? dayjs(value).format('DD-MM-YYYY') : '-'),
    },
    {
      title: 'Challan',
      dataIndex: 'challanNo',
      width: 150,
      // Only an inter-unit move has one, so a dash here means "stayed inside
      // the unit" rather than "missing paperwork".
      render: (value, row) => value || (row.interUnit ? '-' : <span style={{ opacity: 0.45 }}>not needed</span>),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 70,
      fixed: 'right',
      render: (_, row) => <ActionButton action="view" size="small" aria-label={`Open ${row.transferNo}`} onClick={() => open(row)} />,
    },
  ], [open]);

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
        title="Asset Transfers"
        subtitle="Moving machines between units, departments and lines — the only thing that changes where an asset is"
      >
        <PermissionGuard module="asset-transfers" operation="add">
          <ActionButton action="create" text="New Transfer" onClick={() => navigate('/assets/transfers/new')} />
        </PermissionGuard>
      </PageHeader>

      <Card>
        <Segmented
          value={list.filters.view}
          onChange={list.setFilter('view')}
          options={[
            { value: 'open', label: 'Needs action' },
            { value: 'incoming', label: 'Coming to a unit' },
            { value: 'all', label: 'All' },
          ]}
          style={{ marginBottom: 16 }}
        />
        <SearchFilterBar
          searchText={list.searchText}
          onSearchChange={(e) => list.setSearchText(e.target.value)}
          searchPlaceholder="Search transfer no., challan no., reason..."
          filters={[
            selectFilter('status', 'Status', STATUS_OPTIONS),
            selectFilter('reasonCode', 'Reason', REASON_OPTIONS),
            selectFilter('fromUnitId', 'From unit', lookups.options.units),
            selectFilter('toUnitId', list.filters.view === 'incoming' ? 'Arriving at' : 'To unit', lookups.options.units),
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
          scroll={{ x: 'max-content' }}
          className="table-nowrap"
          pagination={getTablePagination({ ...list.pagination, total: list.total }, 'transfers')}
          onChange={list.onTableChange}
          locale={{
            emptyText: (
              <EmptyState
                title="Nothing to do here"
                description="No transfer is waiting on anybody. Switch to All to see what has already moved."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default AssetTransferList;
