import { Modal, Table, InputNumber, Typography, Space, Tag, Button, Tooltip, Row, Col, Card, Select } from 'antd';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { HolderOutlined } from '@ant-design/icons';
import { calcPurchaseQty, calcPurchaseWidth, CONSUMPTION_MODE, buildOrderQtyGrid, calcMatrixTotal, calcVariantBreakdown } from '../../utils/bomConstants';

const { Text } = Typography;

/**
 * ProcessAllowanceModal
 *
 * Appears when a user selects process(es) on a BOM line.
 * For SIMPLE/fabric: flat allowance % per process (unchanged).
 * For matrix modes: per-size allowance grid per process, with per-variant purchase summary.
 */
const ProcessAllowanceModal = ({
  open,
  processes = [],
  finishedWidth = 0,
  baseQty = 0,
  isFabric = true,
  onApply,
  onCancel,
  // Matrix mode props
  consumptionMode,
  sizes = [],
  variantMapping,
  availableVariants = [],
  consumptionMatrix,
  orderLineSummary = [],
}) => {
  const [rows, setRows] = useState([]);
  const [qfValues, setQfValues] = useState({}); // { processId: { val, scope, field } }
  const isMatrix = consumptionMode === CONSUMPTION_MODE.SIZE_WISE || consumptionMode === CONSUMPTION_MODE.VARIANT_PER_SIZE;

  useEffect(() => {
    if (open && processes.length > 0) {
      setRows(
        processes.map((p, idx) => ({
          processId: p.id,
          processName: p.processName,
          sortOrder: idx,
          shrinkageInches: p.defaultShrinkageInches ?? 0,
          processLossPercent: p.defaultProcessLossPercent ?? 0,
          rejectionPercent: p.defaultRejectionPercent ?? 0,
          shipmentAllowancePercent: p.defaultShipmentAllowancePercent ?? 0,
          // Per-size allowances for matrix modes
          sizeAllowances: p.sizeAllowances || {},
        })),
      );
      setQfValues({});
    }
  }, [open, processes]);

  const updateRow = (processId, field, value) => {
    setRows((prev) =>
      prev.map((r) =>
        r.processId === processId ? { ...r, [field]: value } : r,
      ),
    );
  };

  // On blur, reset to default from master if empty
  const defaultFieldMap = {
    shrinkageInches: 'defaultShrinkageInches',
    processLossPercent: 'defaultProcessLossPercent',
    rejectionPercent: 'defaultRejectionPercent',
    shipmentAllowancePercent: 'defaultShipmentAllowancePercent',
  };
  const handleBlur = (processId, field, e) => {
    if (!e.target.value && e.target.value !== '0') {
      const proc = processes.find((p) => p.id === processId);
      const defaultVal = proc?.[defaultFieldMap[field]] ?? 0;
      updateRow(processId, field, defaultVal);
    }
  };

  // ── Drag & Drop for process series reorder ──────────────────────
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleDragStart = useCallback((idx) => {
    dragItem.current = idx;
  }, []);

  const handleDragEnter = useCallback((idx) => {
    dragOverItem.current = idx;
  }, []);

  const handleDragEnd = useCallback(() => {
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }
    setRows((prev) => {
      const updated = [...prev];
      const [dragged] = updated.splice(dragItem.current, 1);
      updated.splice(dragOverItem.current, 0, dragged);
      return updated.map((r, i) => ({ ...r, sortOrder: i }));
    });
    dragItem.current = null;
    dragOverItem.current = null;
  }, []);

  // Aggregate allowances across all processes
  const totalShrinkage = rows.reduce((s, r) => s + (Number(r.shrinkageInches) || 0), 0);
  const totalLossPercent = rows.reduce((s, r) => s + (Number(r.processLossPercent) || 0), 0);
  const totalRejPercent = rows.reduce((s, r) => s + (Number(r.rejectionPercent) || 0), 0);
  const totalShipmentPercent = rows.reduce((s, r) => s + (Number(r.shipmentAllowancePercent) || 0), 0);

  const purchaseWidth = calcPurchaseWidth(finishedWidth, totalShrinkage);
  const purchaseQty = calcPurchaseQty(baseQty, totalLossPercent, totalRejPercent + totalShipmentPercent);

  const columns = [
    {
      title: '#',
      width: 45,
      align: 'center',
      render: (_, __, idx) => <Text type="secondary" style={{ fontSize: 12 }}>{idx + 1}</Text>,
    },
    {
      title: 'Process',
      dataIndex: 'processName',
      width: 160,
      render: (text) => <Text strong>{text}</Text>,
    },
    // Shrinkage & Process Loss — fabric only
    ...(isFabric ? [
      {
        title: 'Shrinkage',
        dataIndex: 'shrinkageInches',
        width: 140,
        render: (value, record) => (
          <InputNumber
            min={0}
            step={0.25}
            precision={2}
            controls={false}
            style={{ width: '100%' }}
            value={value}
            onChange={(v) => updateRow(record.processId, 'shrinkageInches', v)}
            onBlur={(e) => handleBlur(record.processId, 'shrinkageInches', e)}
            addonAfter="in"
          />
        ),
      },
      {
        title: 'Process Loss',
        dataIndex: 'processLossPercent',
        width: 140,
        render: (value, record) => (
          <InputNumber
            min={0}
            max={100}
            step={0.5}
            precision={2}
            controls={false}
            style={{ width: '100%' }}
            value={value}
            onChange={(v) => updateRow(record.processId, 'processLossPercent', v)}
            onBlur={(e) => handleBlur(record.processId, 'processLossPercent', e)}
            addonAfter="%"
          />
        ),
      },
    ] : []),
    {
      title: 'Rejection (%)',
      dataIndex: 'rejectionPercent',
      width: 140,
      render: (value, record) => (
        <InputNumber
          min={0}
          max={100}
          step={0.5}
          precision={2}
          controls={false}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => updateRow(record.processId, 'rejectionPercent', v)}
          onBlur={(e) => handleBlur(record.processId, 'rejectionPercent', e)}
          addonAfter={isFabric ? '%' : undefined}
        />
      ),
    },
    {
      title: 'Shipment (%)',
      dataIndex: 'shipmentAllowancePercent',
      width: 140,
      render: (value, record) => (
        <InputNumber
          min={0}
          max={100}
          step={0.5}
          precision={2}
          controls={false}
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => updateRow(record.processId, 'shipmentAllowancePercent', v)}
          onBlur={(e) => handleBlur(record.processId, 'shipmentAllowancePercent', e)}
          addonAfter={isFabric ? '%' : undefined}
        />
      ),
    },
  ];

  // Per-size allowance update
  const updateSizeAllowance = (processId, size, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.processId !== processId) return r;
        const sa = { ...(r.sizeAllowances || {}) };
        sa[size] = { ...(sa[size] || { rejectionPercent: 0, shipmentAllowancePercent: 0 }), [field]: value };
        return { ...r, sizeAllowances: sa };
      }),
    );
  };

  // Fill all sizes for a field in a process with the same value
  const fillSizeField = (processId, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.processId !== processId) return r;
        const sa = { ...(r.sizeAllowances || {}) };
        sizes.forEach((s) => {
          sa[s] = { ...(sa[s] || { rejectionPercent: 0, shipmentAllowancePercent: 0 }), [field]: value };
        });
        return { ...r, sizeAllowances: sa };
      }),
    );
  };

  // Per-variant breakdown for preview (VARIANT_PER_SIZE only)
  const variantBreakdown = useMemo(() => {
    if (!isMatrix || consumptionMode !== CONSUMPTION_MODE.VARIANT_PER_SIZE || !variantMapping || !consumptionMatrix) return [];
    const orderQtyGrid = buildOrderQtyGrid(orderLineSummary);
    return calcVariantBreakdown(consumptionMatrix, orderQtyGrid, variantMapping, rows);
  }, [isMatrix, consumptionMode, variantMapping, consumptionMatrix, orderLineSummary, rows]);

  // Overall purchase qty for matrix modes
  const matrixPurchaseQty = useMemo(() => {
    if (!isMatrix || !consumptionMatrix) return 0;
    const orderQtyGrid = buildOrderQtyGrid(orderLineSummary);
    const totalReq = calcMatrixTotal(consumptionMatrix, orderQtyGrid);
    if (consumptionMode === CONSUMPTION_MODE.VARIANT_PER_SIZE) {
      return variantBreakdown.reduce((s, v) => s + v.purchaseQty, 0);
    }
    // SIZE_WISE: aggregate per-size allowances
    let total = 0;
    sizes.forEach((size) => {
      let sizeReq = 0;
      Object.entries(consumptionMatrix).forEach(([color, szMap]) => {
        const c = Number(szMap?.[size]) || 0;
        const o = orderQtyGrid[color]?.[size] || 0;
        sizeReq += c * o;
      });
      let rejTotal = 0, shipTotal = 0;
      rows.forEach((r) => {
        const sa = r.sizeAllowances?.[size];
        rejTotal += Number(sa?.rejectionPercent ?? r.rejectionPercent) || 0;
        shipTotal += Number(sa?.shipmentAllowancePercent ?? r.shipmentAllowancePercent) || 0;
      });
      total += sizeReq + sizeReq * ((rejTotal + shipTotal) / 100);
    });
    return total;
  }, [isMatrix, consumptionMatrix, orderLineSummary, consumptionMode, variantBreakdown, sizes, rows]);

  // Variant label helper
  const getVariantLabel = (variantId) => {
    const v = availableVariants.find((av) => av.id === variantId);
    if (!v?.attributes) return `ID:${variantId}`;
    const attrs = v.attributes;
    const parts = [];
    for (const key of Object.keys(attrs)) {
      if (key.toLowerCase() === 'size' && attrs[key]) parts.push(attrs[key]);
    }
    for (const key of Object.keys(attrs)) {
      if (key.toLowerCase() === 'color' && attrs[key]) parts.push(attrs[key]);
    }
    return parts.length > 0 ? parts.join(', ') : Object.values(attrs).join(', ');
  };

  const handleApply = () => {
    onApply?.(
      rows.map((r, idx) => ({
        processId: r.processId,
        processName: r.processName,
        sortOrder: idx,
        shrinkageInches: r.shrinkageInches,
        processLossPercent: r.processLossPercent,
        rejectionPercent: r.rejectionPercent,
        shipmentAllowancePercent: r.shipmentAllowancePercent,
        ...(isMatrix ? { sizeAllowances: r.sizeAllowances } : {}),
      })),
    );
  };

  const showSeries = rows.length > 1;

  return (
    <Modal
      title="Process Allowances"
      open={open}
      width={isMatrix ? Math.min(950, 300 + sizes.length * 90) : isFabric ? 850 : 700}
      destroyOnClose
      onCancel={onCancel}
      okText="Apply Allowances"
      onOk={handleApply}
      cancelText="Cancel"
      centered
      styles={{
        body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px' },
      }}
    >
      {/* Process Execution Series — drag & drop reorder */}
      {showSeries && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ marginBottom: 8 }}>
            <Text strong style={{ fontSize: 13 }}>Process Execution Series</Text>
            <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>Drag to reorder the execution sequence</Text>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            overflowX: 'auto',
            padding: '4px 0',
          }}>
            {rows.map((r, idx) => (
              <div key={r.processId} style={{ display: 'flex', alignItems: 'center' }}>
                <div
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragEnter={() => handleDragEnter(idx)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border-color, #d9d9d9)',
                    background: 'var(--card-bg, #fff)',
                    cursor: 'grab',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'box-shadow 0.2s',
                  }}
                  onMouseDown={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'; }}
                  onMouseUp={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <HolderOutlined style={{ color: 'var(--text-muted, #bfbfbf)', fontSize: 12 }} />
                  <Tag
                    color="blue"
                    style={{ margin: 0, fontSize: 11, fontWeight: 700, minWidth: 20, textAlign: 'center', lineHeight: '18px' }}
                  >
                    {idx + 1}
                  </Tag>
                  <Text style={{ fontSize: 12 }}>{r.processName}</Text>
                </div>
                {idx < rows.length - 1 && (
                  <div style={{
                    width: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted, #bfbfbf)',
                    fontSize: 14,
                    flexShrink: 0,
                  }}>
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16, fontSize: 12, color: 'var(--text-muted, #8c8c8c)' }}>
        Default allowance values are populated from the Process Master. You can modify them below.
      </div>

      {/* SIMPLE / Fabric: flat table */}
      {!isMatrix && (
        <Table
          dataSource={rows}
          columns={columns}
          rowKey="processId"
          pagination={false}
          size="middle"
          style={{ marginBottom: 20 }}
        />
      )}

      {/* MATRIX: per-size allowance grid per process */}
      {isMatrix && rows.map((r, rIdx) => (
        <div key={r.processId} style={{
          marginBottom: 24,
          padding: '16px 18px',
          borderRadius: 8,
          border: '1px solid var(--border-color, #e8e8e8)',
          background: 'var(--card-bg, #fff)',
        }}>
          <div style={{
            marginBottom: 14,
            paddingBottom: 10,
            borderBottom: '1px solid var(--border-color, #e8e8e8)',
          }}>
            <Tag color="blue" style={{ fontSize: 11, marginRight: 8 }}>{rIdx + 1}</Tag>
            <Text strong style={{ fontSize: 14 }}>{r.processName}</Text>
          </div>
          <div style={{ overflowX: 'auto', marginBottom: 14 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 10px', borderBottom: '2px solid var(--border-color, #d9d9d9)', textAlign: 'left', minWidth: 110, fontSize: 12 }}></th>
                  {sizes.map((s) => (
                    <th key={s} style={{ padding: '8px 6px', borderBottom: '2px solid var(--border-color, #d9d9d9)', textAlign: 'center', minWidth: 80, fontSize: 12 }}>
                      {s}
                    </th>
                  ))}
                </tr>
                {consumptionMode === CONSUMPTION_MODE.VARIANT_PER_SIZE && variantMapping && (
                  <tr>
                    <td style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-muted, #999)', borderBottom: '1px solid var(--border-color, #e8e8e8)' }}>Variant</td>
                    {sizes.map((s) => (
                      <td key={s} style={{ padding: '6px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted, #999)', borderBottom: '1px solid var(--border-color, #e8e8e8)' }}>
                        {variantMapping[s] ? getVariantLabel(variantMapping[s]) : '—'}
                      </td>
                    ))}
                  </tr>
                )}
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--border-color, #e8e8e8)' }}>Rejection (%)</td>
                  {sizes.map((s) => (
                    <td key={s} style={{ padding: '6px', borderBottom: '1px solid var(--border-color, #e8e8e8)' }}>
                      <InputNumber
                        size="small"
                        min={0} max={100} step={0.5} precision={2} controls={false}
                        style={{ width: '100%' }}
                        value={r.sizeAllowances?.[s]?.rejectionPercent ?? r.rejectionPercent ?? 0}
                        onChange={(v) => updateSizeAllowance(r.processId, s, 'rejectionPercent', v)}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: '8px 10px', fontWeight: 600, fontSize: 12 }}>Shipment (%)</td>
                  {sizes.map((s) => (
                    <td key={s} style={{ padding: '6px' }}>
                      <InputNumber
                        size="small"
                        min={0} max={100} step={0.5} precision={2} controls={false}
                        style={{ width: '100%' }}
                        value={r.sizeAllowances?.[s]?.shipmentAllowancePercent ?? r.shipmentAllowancePercent ?? 0}
                        onChange={(v) => updateSizeAllowance(r.processId, s, 'shipmentAllowancePercent', v)}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          {(() => {
            const qf = qfValues[r.processId] || { val: null, scope: 'all', field: 'both' };
            const updateQf = (key, v) => setQfValues((prev) => ({ ...prev, [r.processId]: { ...qf, [key]: v } }));
            const handleApply = () => {
              if (qf.val == null) return;
              const sizesToFill = qf.scope === 'all' ? sizes : [qf.scope];
              const fields = qf.field === 'both' ? ['rejectionPercent', 'shipmentAllowancePercent']
                : [qf.field];
              sizesToFill.forEach((s) => { fields.forEach((f) => updateSizeAllowance(r.processId, s, f, qf.val)); });
            };
            return (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 6,
                background: 'var(--bg-secondary, #f6f8fa)',
                border: '1px solid var(--border-color, #e8e8e8)',
                flexWrap: 'wrap',
              }}>
                <Text style={{ fontSize: 12, whiteSpace: 'nowrap', fontWeight: 600 }}>Quick Fill</Text>
                <InputNumber
                  size="small" min={0} max={100} step={0.5} precision={2} controls={false}
                  style={{ width: 90 }}
                  value={qf.val}
                  onChange={(v) => updateQf('val', v)}
                  placeholder="0.00"
                />
                <Select
                  size="small"
                  style={{ minWidth: 120 }}
                  value={qf.scope}
                  onChange={(v) => updateQf('scope', v)}
                  options={[
                    { value: 'all', label: 'All sizes' },
                    ...sizes.map((s) => ({ value: s, label: `Size: ${s}` })),
                  ]}
                />
                <Select
                  size="small"
                  style={{ minWidth: 110 }}
                  value={qf.field}
                  onChange={(v) => updateQf('field', v)}
                  options={[
                    { value: 'both', label: 'Both' },
                    { value: 'rejectionPercent', label: 'Rejection' },
                    { value: 'shipmentAllowancePercent', label: 'Shipment' },
                  ]}
                />
                <Button size="small" type="primary" onClick={handleApply} disabled={qf.val == null}>
                  Apply
                </Button>
                <div style={{ width: '100%', display: 'flex', gap: 8, marginTop: 4 }}>
                  <Tooltip title={`Fill all sizes with default rejection (${r.rejectionPercent || 0}%) from Process Master`}>
                    <Button size="small" onClick={() => fillSizeField(r.processId, 'rejectionPercent', r.rejectionPercent || 0)}>
                      Default Rejection ({r.rejectionPercent || 0}%)
                    </Button>
                  </Tooltip>
                  <Tooltip title={`Fill all sizes with default shipment (${r.shipmentAllowancePercent || 0}%) from Process Master`}>
                    <Button size="small" onClick={() => fillSizeField(r.processId, 'shipmentAllowancePercent', r.shipmentAllowancePercent || 0)}>
                      Default Shipment ({r.shipmentAllowancePercent || 0}%)
                    </Button>
                  </Tooltip>
                </div>
              </div>
            );
          })()}
        </div>
      ))}

      {/* Live calculation preview */}
      <div
        style={{
          background: 'var(--bg-secondary, #f6f8fa)',
          borderRadius: 8,
          padding: '14px 18px',
          border: '1px solid var(--border-color, #e8e8e8)',
        }}
      >
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          {isFabric && (
            <Text>
              <Text strong>Purchase Width</Text> = Finished Width ({finishedWidth}") + Shrinkage ({totalShrinkage}") ={' '}
              <Text strong style={{ color: 'var(--primary-color, #6366f1)' }}>
                {purchaseWidth}"
              </Text>
            </Text>
          )}
          {isMatrix ? (() => {
            const totalConsumption = calcMatrixTotal(consumptionMatrix, buildOrderQtyGrid(orderLineSummary)) || 0;
            const oqg = buildOrderQtyGrid(orderLineSummary);
            let totalRejection = 0, totalShipment = 0;
            sizes.forEach((size) => {
              let sizeReq = 0;
              Object.entries(consumptionMatrix || {}).forEach(([color, szMap]) => {
                sizeReq += (Number(szMap?.[size]) || 0) * (oqg[color]?.[size] || 0);
              });
              let rejPct = 0, shipPct = 0;
              rows.forEach((r) => {
                rejPct += Number(r.sizeAllowances?.[size]?.rejectionPercent ?? r.rejectionPercent) || 0;
                shipPct += Number(r.sizeAllowances?.[size]?.shipmentAllowancePercent ?? r.shipmentAllowancePercent) || 0;
              });
              totalRejection += sizeReq * (rejPct / 100);
              totalShipment += sizeReq * (shipPct / 100);
            });
            return (
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Total Consumption</Text>
                  <Text>{totalConsumption.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>+ Rejection</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{totalRejection.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>+ Shipment</Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>{totalShipment.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color, #e8e8e8)', paddingTop: 6, marginTop: 4 }}>
                  <Text strong>Purchase Qty</Text>
                  <Text strong style={{ fontSize: 15, color: 'var(--primary-color, #6366f1)' }}>
                    {(totalConsumption + totalRejection + totalShipment).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </Text>
                </div>
              </Space>
            );
          })() : (
            <Text>
              <Text strong>Purchase Qty</Text> = Base Qty ({baseQty.toLocaleString()})
              {isFabric && <> + Loss ({((baseQty * totalLossPercent) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })})</>}
              {' '}+ Rejection ({((baseQty * totalRejPercent) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })})
              {' '}+ Shipment ({((baseQty * totalShipmentPercent) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}) ={' '}
              <Text strong style={{ color: 'var(--primary-color, #6366f1)' }}>
                {purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
            </Text>
          )}
        </Space>
      </div>
    </Modal>
  );
};

export default ProcessAllowanceModal;
