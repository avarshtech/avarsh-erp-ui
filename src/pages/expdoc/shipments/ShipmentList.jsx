import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { App, Card, Table } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../utils/paginationConfig';
import { hasPermission } from '../../../utils/permissions';
import { EXPDOC_MODULE } from '../../../utils/expDocConstants';
import { searchShipments, deleteShipment } from '../../../services/expdoc/expDocService';
import { buildShipmentColumns } from './ShipmentColumns';
import ShipmentView from './ShipmentView';
import ShipmentDocumentSet from './ShipmentDocumentSet';

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
];

/**
 * Shipment register.
 *
 * No shipment entity exists anywhere in the ERP, yet the packing list is
 * shipment-scoped (V-01 checks carton numbers across every packing list of one
 * shipment) and the invoice header needs ports, vessel and container. This screen
 * is deliberately thin so a real Shipment module can take it over.
 */
const ShipmentList = () => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState();
  const [viewId, setViewId] = useState(null);
  const [docSetId, setDocSetId] = useState(null);

  const canAdd = hasPermission(EXPDOC_MODULE.SHIPMENTS, 'add');
  const canUpdate = hasPermission(EXPDOC_MODULE.SHIPMENTS, 'update');
  const canDelete = hasPermission(EXPDOC_MODULE.SHIPMENTS, 'delete');

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
        const res = await searchShipments(params);
        setRows(res.content || []);
        setPagination((p) => ({
          ...p,
          current: nextPage,
          pageSize: nextSize,
          total: res.totalElements || 0,
        }));
      } catch (e) {
        message.error(e.message || 'Failed to load shipments');
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
        await deleteShipment(record.id);
        message.success(`${record.shipmentNo} deleted`);
        fetchData();
      } catch (e) {
        message.error(e.message || 'Failed to delete shipment');
      }
    },
    [message, fetchData],
  );

  const columns = useMemo(
    () =>
      buildShipmentColumns({
        onView: (record) => setViewId(record.id),
        onEdit: (record) => navigate(`/export-docs/shipments/edit/${record.id}`),
        onDocuments: (record) => setDocSetId(record.id),
        onDelete: handleDelete,
        canUpdate,
        canDelete,
      }),
    [navigate, handleDelete, canUpdate, canDelete],
  );

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
        title="Shipments"
        subtitle="Ports, vessel, container and ETD for each export consignment"
        onAdd={canAdd ? () => navigate('/export-docs/shipments/new') : undefined}
        addLabel="New Shipment"
      />
      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search shipment no, buyer, vessel or container"
          filters={filters}
          style={{ marginBottom: 16 }}
        />
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          rowKey="id"
          size="small"
          scroll={{ x: 1500 }}
          onRow={(record) => ({
            onClick: () => setViewId(record.id),
            style: { cursor: 'pointer' },
          })}
          onChange={(pag) => fetchData(pag.current, pag.pageSize)}
          pagination={getTablePagination(pagination, 'shipments')}
          locale={{
            emptyText: (
              <EmptyState
                title="No shipments yet"
                description="Create a shipment to group the packing lists, invoice and stickers of one consignment."
                actionLabel={canAdd ? 'New Shipment' : undefined}
                onAction={canAdd ? () => navigate('/export-docs/shipments/new') : undefined}
                showAction={canAdd}
              />
            ),
          }}
        />
      </Card>
      <ShipmentDocumentSet
        open={docSetId != null}
        shipmentId={docSetId}
        onClose={() => setDocSetId(null)}
      />

      <ShipmentView
        open={viewId != null}
        shipmentId={viewId}
        onClose={() => setViewId(null)}
        onEdit={(record) => {
          setViewId(null);
          navigate(`/export-docs/shipments/edit/${record.id}`);
        }}
        canUpdate={canUpdate}
      />
    </div>
  );
};

export default ShipmentList;
