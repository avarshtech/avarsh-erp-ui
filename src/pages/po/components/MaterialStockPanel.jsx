import { useMemo, useEffect, useCallback } from 'react';
import { Table, Tag, Typography, Alert, InputNumber } from 'antd';
import EmptyState from '../../../components/EmptyState';
import { numericInputProps } from '../../../utils/inputHelpers';

const { Text } = Typography;

const TYPE_LABEL = { fabric: 'Fabric', trim: 'Trim / Accessory', packing: 'Packing Material' };

// Req / Garment is in the BOM's consumption unit (Gms); requirements and stock figures
// are in the unit the stock is held in (Kg). When the API knows no conversion between
// the two, the requirements stay in the BOM's unit — reqUom says which, per row.
const perPcUom = (r) => r.perPcUom || r.uom;
const stockUom = (r) => r.stockUom || r.uom;
const reqUom = (r) => r.reqUom || stockUom(r);
const Uom = ({ children }) => (children
  ? <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>{children}</Text>
  : null);
const qty = (v, uom) => <span style={{ whiteSpace: 'nowrap' }}>{(v || 0).toLocaleString()}<Uom>{uom}</Uom></span>;
const STALE_MS = 48 * 60 * 60 * 1000;
// Captured once at module load — a 48h staleness heuristic doesn't need per-render "now",
// and keeping the impure Date call out of the component body keeps render pure.
const LOAD_TS = Date.now();

// Oldest GRN across rows + whether it's stale. Module-level so the date math is not
// analyzed as an impure render call (mirrors the fmtDate helper pattern).
const computeGrn = (rows) => {
  const ts = rows.map((r) => r.lastGrnAt).filter(Boolean).map((d) => new Date(d).getTime());
  if (!ts.length) return { label: '—', stale: false };
  const oldest = Math.min(...ts);
  return { label: new Date(oldest).toLocaleString('en-GB'), stale: (LOAD_TS - oldest) > STALE_MS };
};

/**
 * Real-time material stock availability (PRD §4.4 / §5.3 / §6.6).
 * Shows current stock, already-allocated, available balance and shortage/surplus
 * for the linked BOM items. Surfaces a shortage alert (notifies parent via
 * onShortageChange) and a stale-stock warning when the last GRN is > 48h old
 * (PRD §13). `materialType` = fabric | trim | packing.
 */
const MaterialStockPanel = ({ rows = [], materialType = 'fabric', loading = false, onShortageChange, allocatedEditable = false, onChange }) => {
  const hasShortage = useMemo(() => rows.some((r) => r.shortageSurplus < 0), [rows]);

  useEffect(() => { onShortageChange?.(hasShortage); }, [hasShortage, onShortageChange]);

  const grn = computeGrn(rows);

  // Editable Allocated (Cutting PO): recompute available + shortage from the edited value.
  const handleAllocated = useCallback((key, value) => {
    const allocated = value || 0;
    onChange?.(rows.map((r) => (r.key === key
      ? { ...r, allocated, availableBalance: r.currentStock - allocated, shortageSurplus: r.currentStock - allocated }
      : r)));
  }, [rows, onChange]);

  const columns = useMemo(() => [
    // The variant is the purchasable identity, so it stands in for the item across
    // these columns rather than being shown beside it.
    { title: 'Item Code', dataIndex: 'itemCode', width: 160, render: (v, r) => <Text strong>{r.variantCode || v}</Text> },
    { title: 'Item Name', dataIndex: 'itemName', width: 220, ellipsis: true, render: (v, r) => r.variantName || v },
    { title: 'PO No', dataIndex: 'poNumber', width: 150, render: (v) => v || '—' },
    { title: 'Req / Garment', dataIndex: 'bomPerPc', width: 120, align: 'right',
      render: (v, r) => <Text type="secondary">{(v || 0).toFixed(3)}<Uom>{perPcUom(r)}</Uom></Text> },
    { title: 'BOM Req', dataIndex: 'bomRequired', width: 120, align: 'right', render: (v, r) => qty(v, reqUom(r)) },
    ...(materialType === 'fabric'
      ? [{ title: 'CAD Req', dataIndex: 'cadRequired', width: 120, align: 'right', render: (v, r) => qty(v, reqUom(r)) }]
      : []),
    { title: 'Current Stock', dataIndex: 'currentStock', width: 130, align: 'right', render: (v, r) => qty(v, stockUom(r)) },
    { title: 'Order Stock', dataIndex: 'orderStock', width: 130, align: 'right',
      render: (v, r) => <Text style={{ color: '#1677ff' }}>{qty(v, stockUom(r))}</Text> },
    { title: 'Free Stock', dataIndex: 'freeStock', width: 130, align: 'right',
      render: (v, r) => <Text style={{ color: '#389e0d' }}>{qty(v, stockUom(r))}</Text> },
    { title: 'Allocated', dataIndex: 'allocated', width: 140, align: 'right',
      render: (v, r) => (allocatedEditable
        ? <InputNumber name={`allocated-${r.key}`} size="small" min={0} value={v} onChange={(val) => handleAllocated(r.key, val)} style={{ width: 120 }} suffix={stockUom(r)} {...numericInputProps} />
        : qty(v, stockUom(r))) },
    { title: 'Available', dataIndex: 'availableBalance', width: 150, align: 'right', render: (v, r) => <Text strong>{qty(v, stockUom(r))}</Text> },
    { title: 'Shortage / Surplus', dataIndex: 'shortageSurplus', width: 160, align: 'right',
      render: (v, r) => (
        <Tag color={v < 0 ? 'red' : 'green'}>
          {v < 0 ? '▼ ' : '▲ '}{Math.abs(v || 0).toLocaleString()} {stockUom(r)}
        </Tag>
      ) },
  ], [materialType, allocatedEditable, handleAllocated]);

  return (
    <div>
      {hasShortage && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title="Material shortage detected"
          description="One or more items have insufficient available balance for this PO. Store Keeper & Merchandiser will be notified on submission."
        />
      )}
      {grn.stale && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title="Stock data may be stale"
          description={`Last goods receipt for one or more items was over 48 hours ago (${grn.label}). Verify with the latest GRN before approving.`}
        />
      )}
      <Table
        rowKey="key"
        columns={columns}
        dataSource={rows}
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 1500 }}
        title={() => <Text strong>{TYPE_LABEL[materialType]} Stock Availability</Text>}
        footer={() => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Stock as of {grn.label} · live from Inventory
          </Text>
        )}
        locale={{ emptyText: <EmptyState title="No stock data" description="Select an order so material availability can be calculated" /> }}
      />
    </div>
  );
};

export default MaterialStockPanel;
