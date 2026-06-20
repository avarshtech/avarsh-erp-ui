import { useState, useEffect, useMemo, useCallback } from 'react';
import { App, Table, Card, Space, Tag, Segmented } from 'antd';
import { UnorderedListOutlined, TableOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../../components/PageHeader';
import PermissionGuard from '../../../components/PermissionGuard';
import SearchFilterBar from '../../../components/SearchFilterBar';
import StatusTag from '../../../components/StatusTag';
import EmptyState from '../../../components/EmptyState';
import { ActionButton } from '../../../components/buttons';
import ProductionPoView from '../components/ProductionPoView';
import FinishingCoverageMatrix from './FinishingCoverageMatrix';
import useDebouncedSearch from '../../../hooks/useDebouncedSearch';
import { getTablePagination } from '../../../utils/paginationConfig';
import { PRODUCTION_PO_STATUS_CONFIG } from '../../../utils/statusConfig';
import { PROD_PO_STATUS, getStatusLabel, getProcessLabel, EDITABLE_STATUSES, PO_TYPE, FINISHING_PROCESSES } from '../../../utils/productionConstants';
import { listFinishingPos, getVendors } from '../../../services/production/productionService';
import { generateProductionPoPdf } from '../../../utils/productionPoPdfGenerator';

const STATUS_OPTIONS = Object.values(PROD_PO_STATUS).map((v) => ({ value: v, label: getStatusLabel(v) }));
const PROCESS_OPTIONS = FINISHING_PROCESSES.map((p) => ({ value: p.key, label: p.label }));
const poValue = (r) => (r.items || []).reduce((s, i) => s + (i.plannedQty || 0) * (i.ratePerPiece || 0), 0);

const FinishingPoList = () => {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { searchText, setSearchText, debouncedSearch } = useDebouncedSearch();
  const [status, setStatus] = useState();
  const [process, setProcess] = useState();
  const [vendor, setVendor] = useState();
  const [buyer, setBuyer] = useState();
  const [dateRange, setDateRange] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [viewMode, setViewMode] = useState('list');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState({ open: false, record: null });

  useEffect(() => { getVendors('FINISHING').then(setVendors); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFinishingPos({
        search: debouncedSearch || undefined, status, process, vendorId: vendor, buyer,
        dateFrom: dateRange?.[0]?.format('YYYY-MM-DD'), dateTo: dateRange?.[1]?.format('YYYY-MM-DD'), size: 100,
      });
      setData(res.content || []);
    } catch {
      message.error('Failed to load Finishing POs');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, process, vendor, buyer, dateRange, message]);

  useEffect(() => { load(); }, [load]);

  const buyerOptions = useMemo(() => [...new Set(data.map((r) => r.buyer).filter(Boolean))].map((b) => ({ value: b, label: b })), [data]);
  const vendorOptions = useMemo(() => vendors.map((v) => ({ value: v.id, label: v.name })), [vendors]);

  const columns = useMemo(() => [
    { title: 'Finishing PO', dataIndex: 'finishingPoNo', width: 150, fixed: 'left' },
    { title: 'Order', dataIndex: 'orderNo', width: 130 },
    { title: 'Style', dataIndex: 'styleNo', width: 120 },
    { title: 'Buyer', dataIndex: 'buyer', width: 150, ellipsis: true },
    { title: 'Processes', key: 'processes', width: 230,
      render: (_, r) => (
        <Space size={4} wrap>
          {(r.processes || []).map((p) => <Tag key={p.processName} color="blue">{getProcessLabel(p.processName)}</Tag>)}
        </Space>
      ) },
    { title: 'Vendor', key: 'vendor', width: 160, render: (_, r) => (r.isOutsourced ? r.vendorName : <Tag>In-house</Tag>) },
    { title: 'Order Qty', dataIndex: 'totalOrderQty', width: 100, align: 'right', render: (v) => (v || 0).toLocaleString() },
    { title: 'Planned Qty', dataIndex: 'totalPlannedQty', width: 110, align: 'right', render: (v) => (v || 0).toLocaleString() },
    { title: 'PO Value', key: 'poValue', width: 120, align: 'right', render: (_, r) => `₹ ${poValue(r).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` },
    { title: 'Status', dataIndex: 'status', width: 150, align: 'center',
      render: (s) => <StatusTag status={s} config={PRODUCTION_PO_STATUS_CONFIG} getLabel={getStatusLabel} /> },
    { title: 'Actions', key: 'actions', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space size={0}>
          <ActionButton action="view" onClick={() => setView({ open: true, record: r })} />
          <ActionButton action="print" onClick={() => generateProductionPoPdf(r, PO_TYPE.FINISHING)} />
          {EDITABLE_STATUSES.includes(r.status) && (
            <PermissionGuard module="production" operation="update">
              <ActionButton action="edit" onClick={() => navigate(`/production/finishing-po/edit/${r.id}`)} />
            </PermissionGuard>
          )}
        </Space>
      ) },
  ], [navigate]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader title="Finishing POs" backPath="/production">
        <PermissionGuard module="production" operation="add">
          <ActionButton action="create" text="Generate Finishing POs" onClick={() => navigate('/production/finishing-po/new')} />
        </PermissionGuard>
      </PageHeader>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Segmented
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'list', label: 'All FPOs', icon: <UnorderedListOutlined /> },
              { value: 'byOrder', label: 'By Order (coverage)', icon: <TableOutlined /> },
            ]}
          />
        </Space>
        <SearchFilterBar
          searchText={searchText}
          onSearchChange={(e) => setSearchText(e.target.value)}
          searchPlaceholder="Search FPO / order / style / buyer…"
          style={{ marginBottom: 16 }}
          filters={[
            { type: 'select', key: 'status', span: { lg: 3 }, props: { placeholder: 'Status', value: status, onChange: setStatus, options: STATUS_OPTIONS } },
            { type: 'select', key: 'process', span: { lg: 3 }, props: { placeholder: 'Process', value: process, onChange: setProcess, options: PROCESS_OPTIONS } },
            { type: 'select', key: 'vendor', span: { lg: 4 }, props: { placeholder: 'Vendor', value: vendor, onChange: setVendor, options: vendorOptions } },
            { type: 'select', key: 'buyer', span: { lg: 4 }, props: { placeholder: 'Buyer', value: buyer, onChange: setBuyer, options: buyerOptions } },
            { type: 'rangePicker', key: 'date', span: { lg: 6 }, props: { placeholder: ['Start from', 'Start to'], value: dateRange, onChange: setDateRange } },
          ]}
          onClear={() => { setSearchText(''); setStatus(undefined); setProcess(undefined); setVendor(undefined); setBuyer(undefined); setDateRange(null); }}
          onRefresh={load}
        />
        {viewMode === 'byOrder' ? (
          <FinishingCoverageMatrix data={data} />
        ) : (
          <Table
            rowKey="id"
            columns={columns}
            dataSource={data}
            loading={loading}
            scroll={{ x: 1550 }}
            pagination={getTablePagination({ pageSize: 10 }, 'Finishing POs')}
            locale={{ emptyText: <EmptyState title="No Finishing POs" description="Generate from an approved Work Order" /> }}
          />
        )}
      </Card>

      <ProductionPoView
        open={view.open}
        poType={PO_TYPE.FINISHING}
        record={view.record}
        onClose={() => setView({ open: false, record: null })}
        onChanged={load}
      />
    </div>
  );
};

export default FinishingPoList;
