import { useState, useEffect, useMemo, useCallback } from 'react';
import { App, Table, Card, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import PermissionGuard from '../../../components/PermissionGuard';
import SearchFilterBar from '../../../components/SearchFilterBar';
import StatusTag from '../../../components/StatusTag';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import ProductionPoView from '../components/ProductionPoView';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../utils/paginationConfig';
import { PRODUCTION_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import {
  PROD_PO_STATUS, getStatusLabel, EDITABLE_STATUSES, PROCESSING_UNIT_OPTIONS, PO_TYPE,
} from '../../../utils/productionConstants';
import { listCuttingPos } from '../../../services/production/productionService';
import { generateProductionPoPdf } from '../../../utils/productionPoPdfGenerator';

const STATUS_OPTIONS = Object.values(PROD_PO_STATUS).map((v) => ({ value: v, label: getStatusLabel(v) }));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const poValue = (r) => (r.items || []).reduce((s, i) => s + (i.plannedQty || 0) * (i.ratePerPiece || 0), 0);

const CuttingPoList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [status, setStatus] = useState();
  const [unitType, setUnitType] = useState();
  const [buyer, setBuyer] = useState();
  const [dateRange, setDateRange] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState({ open: false, record: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listCuttingPos({
        search: debouncedSearch || undefined, status, processingUnitType: unitType, buyer,
        dateFrom: dateRange?.[0]?.format('YYYY-MM-DD'), dateTo: dateRange?.[1]?.format('YYYY-MM-DD'), size: 100,
      });
      setData(res.content || []);
    } catch {
      message.error('Failed to load Cutting POs');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, unitType, buyer, dateRange, message]);

  useEffect(() => { load(); }, [load]);

  const buyerOptions = useMemo(() => [...new Set(data.map((r) => r.buyer).filter(Boolean))].map((b) => ({ value: b, label: b })), [data]);

  const columns = useMemo(() => [
    { title: 'Cutting PO', dataIndex: 'cuttingPoNo', width: 150, fixed: 'left' },
    { title: 'Order', dataIndex: 'orderNo', width: 130 },
    { title: 'Style', dataIndex: 'styleNo', width: 130 },
    { title: 'Buyer', dataIndex: 'buyer', width: 150, ellipsis: true },
    { title: 'Cut Date', dataIndex: 'plannedCutDate', width: 110, render: fmtDate },
    { title: 'Order Qty', dataIndex: 'totalOrderQty', width: 100, align: 'right', render: (v) => (v || 0).toLocaleString() },
    { title: 'Planned Qty', dataIndex: 'totalPlannedQty', width: 110, align: 'right', render: (v) => (v || 0).toLocaleString() },
    { title: 'PO Value', key: 'poValue', width: 120, align: 'right', render: (_, r) => `₹ ${poValue(r).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    { title: 'Processing Unit', dataIndex: 'processingUnitName', width: 180, ellipsis: true },
    { title: 'Status', dataIndex: 'status', width: 150, align: 'center',
      render: (s) => <StatusTag status={s} config={PRODUCTION_PO_STATUS_CONFIG} getLabel={getStatusLabel} /> },
    { title: 'Actions', key: 'actions', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          <ActionButton action="view" onClick={() => setView({ open: true, record: r })} />
          <ActionButton action="print" onClick={() => generateProductionPoPdf(r, PO_TYPE.CUTTING)} />
          {EDITABLE_STATUSES.includes(r.status) && (
            <PermissionGuard module="production" operation="update">
              <ActionButton action="edit" onClick={() => navigate(`/production/cutting-po/edit/${r.id}`)} />
            </PermissionGuard>
          )}
        </Space>
      ) },
  ], [navigate]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Cutting POs" backPath="/production">
        <PermissionGuard module="production" operation="add">
          <ActionButton action="create" text="New Cutting PO" onClick={() => navigate('/production/cutting-po/new')} />
        </PermissionGuard>
      </PageHeader>

      <Card>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search PO / order / style / buyer…"
          style={{ marginBottom: 16 }}
          filters={[
            { type: 'select', key: 'status', span: { lg: 3 }, props: { placeholder: 'Status', value: status, onChange: setStatus, options: STATUS_OPTIONS } },
            { type: 'select', key: 'unit', span: { lg: 3 }, props: { placeholder: 'Unit / Vendor', value: unitType, onChange: setUnitType, options: PROCESSING_UNIT_OPTIONS } },
            { type: 'select', key: 'buyer', span: { lg: 4 }, props: { placeholder: 'Buyer', value: buyer, onChange: setBuyer, options: buyerOptions } },
            { type: 'rangePicker', key: 'date', span: { lg: 6 }, props: { placeholder: ['Cut from', 'Cut to'], value: dateRange, onChange: setDateRange } },
          ]}
          onClear={() => { setSearchText(''); setStatus(undefined); setUnitType(undefined); setBuyer(undefined); setDateRange(null); }}
          onRefresh={load}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          scroll={{ x: 1450 }}
          pagination={getTablePagination({ pageSize: 10 }, 'Cutting POs')}
          locale={{ emptyText: <EmptyState title="No Cutting POs" description="Create one from a confirmed order" /> }}
        />
      </Card>

      <ProductionPoView
        open={view.open}
        poType={PO_TYPE.CUTTING}
        record={view.record}
        onClose={() => setView({ open: false, record: null })}
        onChanged={load}
      />
    </div>
  );
};

export default CuttingPoList;
