import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal, InputNumber, Select, Button, Typography, Tag, Tooltip, Card, Row, Col, Space, Segmented,
} from 'antd';
import {
  QTY_CALC_BASIS, CONSUMPTION_MODE, buildOrderQtyGrid, calcMatrixTotal,
} from '../../utils/bomConstants';

const { Text } = Typography;

/**
 * Show only Size and Color from variant attributes, size first.
 */
const variantLabelShort = (v) => {
  if (!v?.attributes) return `ID:${v?.id}`;
  const attrs = v.attributes;
  const parts = [];
  for (const key of Object.keys(attrs)) {
    if (key.toLowerCase() === 'size') parts.push(attrs[key]);
  }
  for (const key of Object.keys(attrs)) {
    if (key.toLowerCase() === 'color') parts.push(attrs[key]);
  }
  return parts.length > 0 ? parts.join(', ') : Object.values(attrs).join(', ');
};

const ConsumptionMatrixDialog = ({
  open,
  mode,
  itemName = '',
  itemCode = '',
  uom = '',
  orderLineSummary = [],
  consumptionMatrix: initialMatrix,
  variantMapping: initialMapping,
  availableVariants = [],
  qtyCalcBasis: initialBasis,
  onApply,
  onCancel,
  disabled = false,
}) => {
  const [matrix, setMatrix] = useState({});
  const [mapping, setMapping] = useState({});
  const defaultBasis = initialBasis === 'BUYER_PO' ? 'BUYER_PO' : 'TOTAL';
  const [basis, setBasis] = useState(defaultBasis);
  const [fillValue, setFillValue] = useState(null);
  const [fillScope, setFillScope] = useState('all');

  useEffect(() => {
    if (open) {
      setMatrix(initialMatrix ? JSON.parse(JSON.stringify(initialMatrix)) : {});
      setMapping(initialMapping ? { ...initialMapping } : {});
      setBasis(defaultBasis);
      setFillValue(null);
      setFillScope('all');
    }
  }, [open, initialMatrix, initialMapping, initialBasis]);

  const { allColors, allSizes, buyerPoNos } = useMemo(() => {
    const colorSet = new Set();
    const sizeSet = new Set();
    const poSet = new Set();
    const sizeOrder = [];
    orderLineSummary.forEach((ol) => {
      poSet.add(ol.buyerPoNo);
      (ol.colors || []).forEach((cr) => {
        colorSet.add(cr.name);
        Object.keys(cr.quantities || {}).forEach((s) => {
          if (!sizeSet.has(s)) { sizeSet.add(s); sizeOrder.push(s); }
        });
      });
    });
    return { allColors: [...colorSet], allSizes: sizeOrder, buyerPoNos: [...poSet] };
  }, [orderLineSummary]);

  const totalQtyGrid = useMemo(() => buildOrderQtyGrid(orderLineSummary), [orderLineSummary]);

  const updateCell = useCallback((color, size, value) => {
    setMatrix((prev) => ({ ...prev, [color]: { ...(prev[color] || {}), [size]: value } }));
  }, []);

  const updateMapping = useCallback((size, variantId) => {
    setMapping((prev) => ({ ...prev, [size]: variantId }));
  }, []);

  // ── Fill helpers ──
  const applyFillAll = useCallback(() => {
    if (fillValue == null) return;
    const m = {};
    allColors.forEach((c) => { m[c] = {}; allSizes.forEach((s) => { m[c][s] = fillValue; }); });
    setMatrix(m);
  }, [fillValue, allColors, allSizes]);

  const applyFillColor = useCallback((color) => {
    if (fillValue == null) return;
    setMatrix((prev) => {
      const row = { ...(prev[color] || {}) };
      allSizes.forEach((s) => { row[s] = fillValue; });
      return { ...prev, [color]: row };
    });
  }, [fillValue, allSizes]);

  const applyFillSize = useCallback((size) => {
    if (fillValue == null) return;
    setMatrix((prev) => {
      const next = { ...prev };
      allColors.forEach((c) => { next[c] = { ...(next[c] || {}), [size]: fillValue }; });
      return next;
    });
  }, [fillValue, allColors]);

  const grandTotal = useMemo(() => calcMatrixTotal(matrix, totalQtyGrid), [matrix, totalQtyGrid]);

  const handleApply = () => {
    onApply?.({
      consumptionMatrix: matrix,
      variantMapping: mode === CONSUMPTION_MODE.VARIANT_PER_SIZE ? mapping : null,
      qtyCalcBasis: basis,
    });
  };

  // Fill scope options for Select
  const fillScopeOptions = useMemo(() => [
    { value: 'all', label: 'All cells' },
    ...allColors.map((c) => ({ value: `color-${c}`, label: `Color: ${c}` })),
    ...allSizes.map((s) => ({ value: `size-${s}`, label: `Size: ${s}` })),
  ], [allColors, allSizes]);

  const handleFillApply = useCallback(() => {
    if (fillValue == null) return;
    if (fillScope === 'all') { applyFillAll(); return; }
    if (fillScope.startsWith('color-')) { applyFillColor(fillScope.slice(6)); return; }
    if (fillScope.startsWith('size-')) { applyFillSize(fillScope.slice(5)); return; }
  }, [fillValue, fillScope, applyFillAll, applyFillColor, applyFillSize]);

  // ── Render variant cards ──
  const renderVariantCards = () => {
    if (!availableVariants.length) return null;
    return (
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 11, marginBottom: 8, display: 'block' }}>Available Variants</Text>
        <Row gutter={[8, 8]}>
          {availableVariants.map((v) => {
            const attrs = v.attributes || {};
            const entries = Object.entries(attrs).filter(([, val]) => val != null && val !== '');
            return (
              <Col key={v.id}>
                <Card
                  size="small"
                  style={{
                    borderRadius: 6,
                    border: '1px solid var(--border-color, #e8e8e8)',
                  }}
                  styles={{ body: { padding: '6px 12px' } }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {entries.map(([key, val]) => (
                      <div key={key} style={{ display: 'flex', gap: 6, alignItems: 'baseline', fontSize: 11 }}>
                        <Text type="secondary" style={{ fontSize: 10, minWidth: 36 }}>{key}</Text>
                        <Text strong style={{ fontSize: 12 }}>{val}</Text>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
            );
          })}
        </Row>
      </div>
    );
  };

  // ── Render matrix table ──
  const renderMatrix = (qtyGrid, sizes, colors, label = null) => (
    <div key={label} style={{ marginBottom: 20 }}>
      {label && (
        <div style={{
          marginBottom: 10, fontWeight: 600, fontSize: 13,
          color: 'var(--primary-color, #6366f1)',
          padding: '6px 12px',
          background: 'var(--bg-secondary, #f6f8fa)',
          borderRadius: 6, borderLeft: '3px solid var(--primary-color, #6366f1)',
        }}>
          {label}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 500 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
            <tr>
              <th style={{ ...thStyle, minWidth: 90, ...stickyFirstCol, zIndex: 4 }}></th>
              {sizes.map((s) => (
                <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 95, background: 'var(--card-bg, #fff)' }}>{s}</th>
              ))}
              <th style={{ ...thStyle, textAlign: 'center', minWidth: 90, ...stickyLastCol, zIndex: 4 }}>Total</th>
            </tr>
            {mode === CONSUMPTION_MODE.VARIANT_PER_SIZE && (
              <tr>
                <td style={{ ...tdStyle, fontWeight: 600, fontSize: 11, padding: '6px 8px', ...stickyFirstCol, zIndex: 4 }}>Variant</td>
                {sizes.map((s) => (
                  <td key={s} style={{ ...tdStyle, padding: '4px 6px', background: 'var(--card-bg, #fff)' }}>
                    <Select
                      size="small"
                      style={{ width: '100%', minWidth: 70 }}
                      placeholder="Select"
                      value={mapping[s] || undefined}
                      onChange={(v) => updateMapping(s, v)}
                      disabled={disabled}
                      options={availableVariants.map((v) => ({ value: v.id, label: variantLabelShort(v) }))}
                      showSearch
                      optionFilterProp="label"
                    />
                  </td>
                ))}
                <td style={{ ...tdStyle, ...stickyLastCol, zIndex: 4 }}></td>
              </tr>
            )}
          </thead>
          <tbody>
            {colors.map((color) => {
              let colorReqTotal = 0;
              let colorOrdTotal = 0;
              return (
                <React.Fragment key={color}>
                  <tr>
                    <td style={{
                      padding: '6px 10px 2px', borderBottom: 'none',
                      fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
                      color: 'var(--primary-color, #6366f1)',
                      ...stickyFirstCol,
                    }}>
                      {color}
                    </td>
                    {sizes.map((s) => (
                      <td key={s} style={{ borderBottom: 'none' }} />
                    ))}
                    <td style={{ borderBottom: 'none', ...stickyLastCol }} />
                  </tr>
                  <tr>
                    <td style={{ ...tdStyle, fontSize: 10, color: 'var(--text-muted, #999)', padding: '4px 10px', ...stickyFirstCol }}>Consumption</td>
                    {sizes.map((size) => {
                      const hasOrderQty = (qtyGrid[color]?.[size] || 0) > 0;
                      return (
                        <td key={size} style={{ ...tdStyle, padding: '4px 6px', textAlign: 'center' }}>
                          {hasOrderQty ? (
                            <InputNumber
                              size="small" min={0} step={0.0001} precision={4} controls={false}
                              style={{ width: '100%', minWidth: 85 }}
                              value={matrix[color]?.[size] ?? null}
                              onChange={(v) => updateCell(color, size, v)}
                              disabled={disabled} placeholder="0.0000"
                            />
                          ) : (
                            <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, textAlign: 'center', padding: '4px 6px', ...stickyLastCol }}></td>
                  </tr>
                  <tr>
                    <td style={{ ...tdStyle, fontSize: 10, color: 'var(--text-muted, #999)', padding: '4px 10px', ...stickyFirstCol }}>Order Qty</td>
                    {sizes.map((size) => {
                      const oq = qtyGrid[color]?.[size] || 0;
                      colorOrdTotal += oq;
                      return (
                        <td key={size} style={{ ...tdStyle, textAlign: 'center', padding: '4px 6px' }}>
                          <Text type="secondary" style={{ fontSize: 11 }}>{oq ? oq.toLocaleString() : '—'}</Text>
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, textAlign: 'center', padding: '4px 6px', ...stickyLastCol }}>
                      <Text strong style={{ fontSize: 11 }}>{colorOrdTotal ? colorOrdTotal.toLocaleString() : '—'}</Text>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ ...tdStyle, fontSize: 10, color: 'var(--text-muted, #999)', padding: '4px 10px', borderBottom: '2px solid var(--border-color, #e8e8e8)', ...stickyFirstCol }}>Requirement</td>
                    {sizes.map((size) => {
                      const c = Number(matrix[color]?.[size]) || 0;
                      const o = qtyGrid[color]?.[size] || 0;
                      const req = c * o;
                      colorReqTotal += req;
                      return (
                        <td key={size} style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, padding: '4px 6px', borderBottom: '2px solid var(--border-color, #e8e8e8)' }}>
                          {req ? req.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                        </td>
                      );
                    })}
                    <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: 'var(--primary-color, #6366f1)', padding: '4px 6px', borderBottom: '2px solid var(--border-color, #e8e8e8)', ...stickyLastCol }}>
                      {colorReqTotal ? colorReqTotal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            <tr style={{ background: 'var(--bg-secondary, #f6f8fa)' }}>
              <td style={{ ...tdStyle, fontWeight: 700, padding: '8px 10px', ...stickyFirstCol, background: 'var(--bg-secondary, #f6f8fa)' }}>TOTAL</td>
              {sizes.map((size) => {
                let colTotal = 0;
                colors.forEach((color) => {
                  colTotal += (Number(matrix[color]?.[size]) || 0) * (qtyGrid[color]?.[size] || 0);
                });
                return (
                  <td key={size} style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, padding: '6px' }}>
                    {colTotal ? colTotal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  </td>
                );
              })}
              <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, fontSize: 14, color: 'var(--primary-color, #6366f1)', padding: '6px', ...stickyLastCol, background: 'var(--bg-secondary, #f6f8fa)' }}>
                {(() => {
                  const t = calcMatrixTotal(matrix, qtyGrid);
                  return t ? t.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <Modal
      title={<span>Consumption Matrix <Text style={{ fontWeight: 400, fontSize: 13, marginLeft: 8 }}>{itemName}</Text>{itemCode && <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>({itemCode})</Text>}{uom && <Tag style={{ marginLeft: 8, fontSize: 10, verticalAlign: 'middle' }}>{uom.toUpperCase()}</Tag>}</span>}
      open={open}
      width={Math.max(650, Math.min(1050, 380 + allSizes.length * 110))}
      destroyOnClose
      onCancel={onCancel}
      okText="Apply"
      onOk={handleApply}
      cancelText="Cancel"
      okButtonProps={{ disabled, type: 'primary' }}
      centered
      styles={{
        body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden', padding: '20px 24px' },
      }}
    >
      {/* Variant cards (VARIANT_PER_SIZE only) */}
      {mode === CONSUMPTION_MODE.VARIANT_PER_SIZE && renderVariantCards()}

      {/* Quick fill + Calc Basis */}
      {!disabled && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          padding: '10px 14px', borderRadius: 6,
          background: 'var(--bg-secondary, #f6f8fa)',
          border: '1px solid var(--border-color, #e8e8e8)',
          flexWrap: 'wrap',
        }}>
          <Text style={{ fontSize: 12, whiteSpace: 'nowrap', fontWeight: 600 }}>Quick Fill</Text>
          <InputNumber
            size="small" min={0} step={0.0001} precision={4} controls={false}
            style={{ width: 110 }}
            value={fillValue}
            onChange={setFillValue}
            placeholder="0.0000"
            addonAfter={uom ? uom.toUpperCase() : undefined}
          />
          <Select
            size="small"
            style={{ minWidth: 130 }}
            value={fillScope}
            onChange={setFillScope}
            options={fillScopeOptions}
          />
          <Button size="small" type="primary" onClick={handleFillApply} disabled={fillValue == null}>
            Apply
          </Button>
          <div style={{ flex: 1 }} />
          <Segmented
            size="small"
            value={basis}
            onChange={setBasis}
            disabled={disabled}
            className="bom-consumption-mode-toggle"
            options={[
              { value: 'TOTAL', label: 'Total' },
              { value: 'BUYER_PO', label: 'Buyer PO' },
            ]}
          />
        </div>
      )}

      {/* Matrix */}
      {basis === QTY_CALC_BASIS.TOTAL ? (
        renderMatrix(totalQtyGrid, allSizes, allColors)
      ) : (
        <>
          {buyerPoNos.map((poNo) => {
            const poGrid = buildOrderQtyGrid(orderLineSummary, poNo);
            const poColors = Object.keys(poGrid);
            const poSizes = [...new Set(poColors.flatMap((c) => Object.keys(poGrid[c] || {})))];
            if (poSizes.length === 0) return null;
            return renderMatrix(poGrid, poSizes, poColors, `PO: ${poNo}`);
          })}
          <div style={{
            textAlign: 'right', fontWeight: 700, fontSize: 14, marginTop: 12,
            padding: '8px 12px', borderRadius: 6,
            background: 'var(--bg-secondary, #f6f8fa)',
          }}>
            Total Consumption: <span style={{ color: 'var(--primary-color, #6366f1)' }}>
              {grandTotal ? grandTotal.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
            </span> {uom?.toUpperCase()}
          </div>
        </>
      )}
    </Modal>
  );
};

const thStyle = {
  padding: '8px 6px',
  borderBottom: '2px solid var(--border-color, #d9d9d9)',
  fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '6px',
  borderBottom: '1px solid var(--border-color, #e8e8e8)',
  whiteSpace: 'nowrap',
};

const stickyFirstCol = {
  position: 'sticky', left: 0, zIndex: 1,
  background: 'var(--card-bg, #fff)',
};

const stickyLastCol = {
  position: 'sticky', right: 0, zIndex: 1,
  background: 'var(--card-bg, #fff)',
};

export default ConsumptionMatrixDialog;
