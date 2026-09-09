import { useState, useEffect, useCallback, useMemo } from 'react';
import { Drawer, Table, Space, Typography } from 'antd';
import { searchMappablePos, listMappingSuppliers } from '../../../services/po/poOrderMappingService';
import { hasPermission } from '../../../utils/permissions';
import { MAPPING_STATUS_OPTIONS } from '../../../utils/poOrderMappingConstants';
import { getTablePagination } from '../../../utils/paginationConfig';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import SearchFilterBar from '../../../components/SearchFilterBar';
import EmptyState from '../../../components/EmptyState';
import PoOrderMappingDrawer from './PoOrderMappingDrawer';
import StockOnlyModal from './StockOnlyModal';
import { buildColumns } from './PoOrderMappingColumns';

const { Text } = Typography;

/**
 * Opened from the Supplier PO list. Lists the General POs a supplier has accepted and
 * how much of each is linked to customer orders. Which item categories count as order
 * material is a server setting, so this screen names none of them. Mapping itself
 * happens in the nested per-PO drawer.
 */
const PoOrderMappingWorkspace = ({ open, onClose }) => {
  const canUpdate = hasPermission('purchase-orders', 'update');

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [supplierFilter, setSupplierFilter] = useState(undefined);
  const [dateRange, setDateRange] = useState(null);
  const [sort, setSort] = useState({ field: 'poDate', direction: 'desc' });
  const [drawerPo, setDrawerPo] = useState(null);
  const [stockOnlyPo, setStockOnlyPo] = useState(null);

  useEffect(() => { if (open) listMappingSuppliers().then(setSuppliers).catch(() => {}); }, [open]);

  const fetchData = useCallback(async (page = 1, size = pagination.pageSize, s = sort) => {
    setLoading(true);
    try {
      const res = await searchMappablePos({
        page: page - 1, size, sort: s.field, direction: s.direction,
        search: debouncedSearch || undefined,
        mappingStatus: statusFilter,
        supplierId: supplierFilter,
        poDateStart: dateRange?.[0]?.format('YYYY-MM-DD'),
        poDateEnd: dateRange?.[1]?.format('YYYY-MM-DD'),
      });
      setData(res.content);
      setPagination({ current: res.number + 1, pageSize: res.size, total: res.totalElements });
    } catch {
      // axiosInstance already raised the server's message as a toast.
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize, sort, debouncedSearch, statusFilter, supplierFilter, dateRange]);

  useEffect(() => { if (open) fetchData(1); }, [open, fetchData]);

  const handleTableChange = (pag, _filters, sorter) => {
    const next = { field: sorter.field || 'poDate', direction: sorter.order === 'ascend' ? 'asc' : 'desc' };
    setSort(next);
    fetchData(pag.current, pag.pageSize, next);
  };

  const refresh = useCallback(() => fetchData(pagination.current), [fetchData, pagination]);

  const columns = useMemo(() => buildColumns({
    onOpen: (r) => setDrawerPo(r),
    onStockOnly: (r) => setStockOnlyPo(r),
    canUpdate,
  }), [canUpdate]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="94%"
      title={(
        <Space orientation="vertical" size={0}>
          <span>Order Mapping</span>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            General POs the supplier has accepted. Record which customer orders each one ended up serving.
          </Text>
        </Space>
      )}
    >
      <SearchFilterBar
        searchText={searchText}
        onSearchChange={(e) => setSearchText(e.target.value)}
        searchPlaceholder="Search PO, supplier, item or order..."
        onRefresh={refresh}
        filters={[
          { type: 'select', span: { xs: 12, sm: 8, md: 5, lg: 4 }, props: { placeholder: 'Mapping status', value: statusFilter, onChange: setStatusFilter, options: MAPPING_STATUS_OPTIONS } },
          { type: 'select', span: { xs: 12, sm: 8, md: 5, lg: 4 }, props: { placeholder: 'Supplier', value: supplierFilter, onChange: setSupplierFilter, options: suppliers.map((s) => ({ value: s.id, label: s.name })) } },
          { type: 'rangePicker', span: { xs: 24, sm: 12, md: 6, lg: 5 }, props: { placeholder: ['PO Date From', 'PO Date To'], value: dateRange, onChange: setDateRange } },
        ]}
        style={{ marginBottom: 16 }}
      />

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        scroll={{ x: 1400 }}
        onChange={handleTableChange}
        pagination={getTablePagination(pagination, 'general PO')}
        locale={{ emptyText: <EmptyState title="No General PO to map" description="Only General POs the supplier has accepted, carrying at least one line of order material, appear here." /> }}
      />

      <PoOrderMappingDrawer open={Boolean(drawerPo)} poId={drawerPo?.id} summary={drawerPo} canEdit={canUpdate} onClose={() => setDrawerPo(null)} onChanged={refresh} />
      <StockOnlyModal open={Boolean(stockOnlyPo)} po={stockOnlyPo} onClose={() => setStockOnlyPo(null)} onSaved={() => { setStockOnlyPo(null); refresh(); }} />
    </Drawer>
  );
};

export default PoOrderMappingWorkspace;
