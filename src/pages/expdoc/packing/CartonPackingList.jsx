import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { App, Card, Col, Row, Table } from 'antd';
import { InboxOutlined, CheckCircleOutlined, AppstoreOutlined, WarningOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import StatCard from '../../../components/StatCard';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../utils/paginationConfig';
import { hasPermission } from '../../../utils/permissions';
import {
  EXPDOC_MODULE, PACKING_ENTRY_STATUS, PACKING_ENTRY_STATUS_LABELS,
} from '../../../utils/expDocConstants';
import { searchPackingEntries, deletePackingEntry } from '../../../services/expdoc/expDocService';
import { buildCartonPackingColumns } from './CartonPackingColumns';
import CartonPackingView from './CartonPackingView';

const STATUS_OPTIONS = Object.values(PACKING_ENTRY_STATUS).map((s) => ({
  value: s,
  label: PACKING_ENTRY_STATUS_LABELS[s],
}));

/**
 * Carton packing register.
 *
 * The PRD defers carton capture to a separate Packing-module PRD, but it is the
 * only producer of the §7.3 dataset the packing list, invoice and stickers all
 * consume, so a thin version lives here behind its own RBAC key.
 */
const CartonPackingList = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState();
  const [viewId, setViewId] = useState(null);

  const canAdd = hasPermission(EXPDOC_MODULE.PACKING, 'add');
  const canUpdate = hasPermission(EXPDOC_MODULE.PACKING, 'update');
  const canDelete = hasPermission(EXPDOC_MODULE.PACKING, 'delete');

  // Current page is read through a ref so fetchData does not have to depend on
  // pagination — depending on it would rebuild the callback on every page change
  // and re-fire the effect below.
  const pagRef = useRef(pagination);
  useEffect(() => { pagRef.current = pagination; }, [pagination]);

  const fetchData = useCallback(
    async (page, pageSize) => {
      const current = pagRef.current;
      const nextPage = page || current.current;
      const nextSize = pageSize || current.pageSize;
      setLoading(true);
      try {
        const params = { page: nextPage - 1, size: nextSize };
        if (debouncedSearch) params.search = debouncedSearch;
        if (statusFilter) params.status = statusFilter;
        const res = await searchPackingEntries(params);
        setRows(res.content || []);
        setPagination((p) => ({
          ...p,
          current: nextPage,
          pageSize: nextSize,
          total: res.totalElements || 0,
        }));
      } catch (e) {
        message.error(e.message || 'Failed to load packing entries');
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, statusFilter, message],
  );

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleDelete = useCallback(
    async (record) => {
      try {
        await deletePackingEntry(record.id);
        message.success(`${record.packingNo} deleted`);
        fetchData();
      } catch (e) {
        message.error(e.message || 'Failed to delete packing entry');
      }
    },
    [message, fetchData],
  );

  const columns = useMemo(
    () =>
      buildCartonPackingColumns({
        onView: (record) => setViewId(record.id),
        onEdit: (record) => navigate(`/export-docs/packing/edit/${record.id}`),
        onDelete: handleDelete,
        canUpdate,
        canDelete,
      }),
    [navigate, handleDelete, canUpdate, canDelete],
  );

  // Computed over the loaded page only, and labelled as such — a page-scoped number
  // presented as a global one is worse than no number at all.
  const kpis = useMemo(() => {
    const open = rows.filter((r) => r.status === PACKING_ENTRY_STATUS.OPEN).length;
    const completed = rows.filter((r) => r.status === PACKING_ENTRY_STATUS.COMPLETED).length;
    const cartons = rows.reduce((s, r) => s + (r.totals?.cartons || 0), 0);
    const withErrors = rows.filter((r) => r.errorCount > 0).length;
    return { open, completed, cartons, withErrors };
  }, [rows]);

  const filters = useMemo(
    () => [
      {
        key: 'status',
        type: 'select',
        span: { xs: 12, sm: 8, md: 5, lg: 4 },
        props: {
          placeholder: 'Status',
          value: statusFilter,
          onChange: setStatusFilter,
          options: STATUS_OPTIONS,
        },
      },
    ],
    [statusFilter],
  );

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Carton Packing"
        subtitle="Carton ranges, quantities, weights and dimensions — the source every export document reads"
        onAdd={canAdd ? () => navigate('/export-docs/packing/new') : undefined}
        addLabel="New Packing Entry"
      />

      <Row gutter={[16, 16]} align="stretch" style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <StatCard title="Open (this page)" value={kpis.open} icon={<InboxOutlined />} color="var(--info-color)" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Completed (this page)" value={kpis.completed} icon={<CheckCircleOutlined />} color="var(--success-color)" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="Cartons (this page)" value={kpis.cartons} icon={<AppstoreOutlined />} color="var(--primary-color)" />
        </Col>
        <Col xs={12} md={6}>
          <StatCard title="With errors (this page)" value={kpis.withErrors} icon={<WarningOutlined />} color="var(--error-color)" />
        </Col>
      </Row>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search packing no, order, style or buyer"
          filters={filters}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 1720 }}
          onRow={(record) => ({
            onClick: () => setViewId(record.id),
            style: { cursor: 'pointer' },
          })}
          onChange={(pag) => fetchData(pag.current, pag.pageSize)}
          pagination={getTablePagination(pagination, 'packing entries')}
          locale={{
            emptyText: (
              <EmptyState
                title="No packing entries yet"
                description="Pick a confirmed order and start recording carton ranges, weights and dimensions."
                actionLabel={canAdd ? 'New Packing Entry' : undefined}
                onAction={canAdd ? () => navigate('/export-docs/packing/new') : undefined}
                showAction={canAdd}
              />
            ),
          }}
        />
      </Card>
      <CartonPackingView
        open={viewId != null}
        entryId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(record) => {
          setViewId(null);
          navigate(`/export-docs/packing/edit/${record.id}`);
        }}
        canUpdate={canUpdate}
      />
    </div>
  );
};

export default CartonPackingList;
