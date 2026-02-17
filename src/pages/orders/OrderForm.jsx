import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Button,
  Card,
  Row,
  Col,
  Space,
  Typography,
  message,
  Collapse,
  Tag,
  Divider,
  Modal,
  Table,
  Popconfirm,
  Tooltip,
  FloatButton,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission, canSubmitOrder } from '../../utils/permissions';
import { createOrder, updateOrder, getOrderById } from '../../services/orderService';
import {
  ORDER_STATUS,
  EDITABLE_STATUSES,
  BUYERS,
  ITEM_GROUPS,
  CURRENCIES,
  SHIPMENT_MODES,
  DELIVERY_TERMS,
  PAYMENT_TERMS,
  PAYMENT_DAYS_OPTIONS,
  FABRIC_TYPES,
  MATERIAL_TYPES,
  SIZE_PRESETS,
  generateOrderNumber,
  getCurrencySymbol,
  getStatusLabel,
} from '../../utils/orderConstants';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ==================== SIZE BREAKDOWN TABLE ====================

const SizeBreakdownTable = ({ line, currency, onLineChange, readOnly }) => {
  const {
    sizes = [],
    sizePrices = {},
    colorRows = [],
    sizePreset,
    customSizes = [],
  } = line;

  const currSymbol = getCurrencySymbol(currency);
  const [bulkPrice, setBulkPrice] = useState(line.basePrice || 0);

  // Apply bulk price to all sizes
  const handleApplyBulkPrice = () => {
    if (bulkPrice === null || bulkPrice === undefined) return;
    const newPrices = {};
    sizes.forEach((s) => { newPrices[s] = bulkPrice; });
    const newColorRows = colorRows.map((row) => {
      const rowValue = sizes.reduce((sum, s) => sum + (row.quantities?.[s] || 0) * (bulkPrice || 0), 0);
      return { ...row, rowValue };
    });
    onLineChange({ sizePrices: newPrices, colorRows: newColorRows });
    message.success('Price applied to all sizes');
  };

  // Handle size preset change
  const handlePresetChange = (preset) => {
    const presetData = SIZE_PRESETS[preset];
    const newSizes = preset === 'CUSTOM' ? customSizes : (presetData?.sizes || []);
    const newSizePrices = {};
    newSizes.forEach((s) => {
      newSizePrices[s] = sizePrices[s] || line.basePrice || 0;
    });
    // Remap existing color row quantities to new sizes
    const newColorRows = colorRows.map((row) => {
      const newQty = {};
      newSizes.forEach((s) => {
        newQty[s] = row.quantities?.[s] || 0;
      });
      const total = Object.values(newQty).reduce((a, b) => a + b, 0);
      const rowValue = newSizes.reduce((sum, s) => sum + (newQty[s] || 0) * (newSizePrices[s] || 0), 0);
      return { ...row, quantities: newQty, total, rowValue };
    });
    onLineChange({
      sizePreset: preset,
      sizes: newSizes,
      sizePrices: newSizePrices,
      colorRows: newColorRows,
    });
  };

  // Handle custom size tags change
  const handleCustomSizesChange = (tags) => {
    const newSizePrices = {};
    tags.forEach((s) => {
      newSizePrices[s] = sizePrices[s] || line.basePrice || 0;
    });
    const newColorRows = colorRows.map((row) => {
      const newQty = {};
      tags.forEach((s) => {
        newQty[s] = row.quantities?.[s] || 0;
      });
      const total = Object.values(newQty).reduce((a, b) => a + b, 0);
      const rowValue = tags.reduce((sum, s) => sum + (newQty[s] || 0) * (newSizePrices[s] || 0), 0);
      return { ...row, quantities: newQty, total, rowValue };
    });
    onLineChange({
      customSizes: tags,
      sizes: tags,
      sizePrices: newSizePrices,
      colorRows: newColorRows,
    });
  };

  // Handle size price change
  const handleSizePriceChange = (size, price) => {
    const newPrices = { ...sizePrices, [size]: price || 0 };
    // Recompute all color row values
    const newColorRows = colorRows.map((row) => {
      const rowValue = sizes.reduce((sum, s) => sum + (row.quantities?.[s] || 0) * (newPrices[s] || 0), 0);
      return { ...row, rowValue };
    });
    onLineChange({ sizePrices: newPrices, colorRows: newColorRows });
  };

  // Handle quantity change
  const handleQtyChange = (colorKey, size, qty) => {
    const newColorRows = colorRows.map((row) => {
      if (row.key !== colorKey) return row;
      const newQty = { ...row.quantities, [size]: qty || 0 };
      const total = sizes.reduce((sum, s) => sum + (newQty[s] || 0), 0);
      const rowValue = sizes.reduce((sum, s) => sum + (newQty[s] || 0) * (sizePrices[s] || 0), 0);
      return { ...row, quantities: newQty, total, rowValue };
    });
    onLineChange({ colorRows: newColorRows });
  };

  // Handle color name change
  const handleColorNameChange = (colorKey, name) => {
    const newColorRows = colorRows.map((row) =>
      row.key === colorKey ? { ...row, colorName: name } : row
    );
    onLineChange({ colorRows: newColorRows });
  };

  // Add color row
  const handleAddColor = () => {
    const newKey = `c_${Date.now()}`;
    const quantities = {};
    sizes.forEach((s) => { quantities[s] = 0; });
    onLineChange({
      colorRows: [
        ...colorRows,
        { key: newKey, colorName: '', quantities, total: 0, rowValue: 0 },
      ],
    });
  };

  // Remove color row
  const handleRemoveColor = (colorKey) => {
    if (colorRows.length <= 1) {
      message.warning('At least one color row is required');
      return;
    }
    onLineChange({ colorRows: colorRows.filter((r) => r.key !== colorKey) });
  };

  // Compute column totals
  const colTotals = {};
  const colValues = {};
  sizes.forEach((s) => { colTotals[s] = 0; colValues[s] = 0; });
  colorRows.forEach((row) => {
    sizes.forEach((s) => {
      colTotals[s] += row.quantities?.[s] || 0;
      colValues[s] += (row.quantities?.[s] || 0) * (sizePrices[s] || 0);
    });
  });
  const grandQty = Object.values(colTotals).reduce((a, b) => a + b, 0);
  const grandValue = Object.values(colValues).reduce((a, b) => a + b, 0);

  return (
    <div>
      {/* Size preset selector */}
      <Row gutter={16} style={{ marginBottom: 12 }} align="middle">
        <Col>
          <Space>
            <Text strong style={{ fontSize: 13 }}>Size Preset:</Text>
            <Select
              style={{ width: 180 }}
              value={sizePreset || undefined}
              placeholder="Select size preset"
              onChange={handlePresetChange}
              disabled={readOnly}
              options={Object.entries(SIZE_PRESETS).map(([key, val]) => ({
                value: key,
                label: val.label,
              }))}
            />
          </Space>
        </Col>
        {sizePreset === 'CUSTOM' && (
          <Col flex="auto">
            <Select
              mode="tags"
              style={{ width: '100%' }}
              placeholder="Enter custom sizes (press Enter)"
              value={customSizes}
              onChange={handleCustomSizesChange}
              disabled={readOnly}
            />
          </Col>
        )}
        {!readOnly && sizes.length > 0 && (
          <Col>
            <Space size={4}>
              <Tooltip title="Set same price for all sizes">
                <InputNumber
                  size="small"
                  min={0}
                  step={0.01}
                  precision={2}
                  value={bulkPrice}
                  onChange={(v) => setBulkPrice(v || 0)}
                  style={{ width: 80 }}
                  placeholder="Price"
                />
              </Tooltip>
              <Button
                size="small"
                type="primary"
                onClick={handleApplyBulkPrice}
              >
                Apply All
              </Button>
            </Space>
          </Col>
        )}
        {!readOnly && sizes.length > 0 && (
          <Col>
            <Button
              type="dashed"
              size="small"
              icon={<PlusOutlined />}
              onClick={handleAddColor}
            >
              Add Color
            </Button>
          </Col>
        )}
      </Row>

      {/* Matrix table */}
      {sizes.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)' }}>
                <th style={{ ...thStyle, minWidth: 180 }}>Color/Print</th>
                {sizes.map((s) => (
                  <th key={s} style={{ ...thStyle, textAlign: 'center', minWidth: 80 }}>{s}</th>
                ))}
                <th style={{ ...thStyle, textAlign: 'right', minWidth: 80 }}>Total</th>
                <th style={{ ...thStyle, textAlign: 'right', minWidth: 100 }}>Value</th>
                {!readOnly && <th style={{ ...thStyle, width: 40 }}></th>}
              </tr>
            </thead>
            <tbody>
              {/* Price Row */}
              <tr style={{ backgroundColor: 'var(--primary-light)' }}>
                <td style={tdStyle}>
                  <Text strong style={{ fontSize: 12, color: '#1890ff' }}>
                    Price ({currency || 'USD'})
                  </Text>
                </td>
                {sizes.map((s) => (
                  <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                    {readOnly ? (
                      <Text style={{ color: '#1890ff' }}>{(sizePrices[s] || 0).toFixed(2)}</Text>
                    ) : (
                      <InputNumber
                        size="small"
                        min={0}
                        step={0.01}
                        precision={2}
                        value={sizePrices[s] || 0}
                        onChange={(v) => handleSizePriceChange(s, v)}
                        style={{ width: '100%' }}
                      />
                    )}
                  </td>
                ))}
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                {!readOnly && <td style={tdStyle}></td>}
              </tr>

              {/* Color Rows */}
              {colorRows.map((row) => (
                <tr key={row.key}>
                  <td style={tdStyle}>
                    {readOnly ? (
                      <Text>{row.colorName || '-'}</Text>
                    ) : (
                      <Input
                        size="small"
                        placeholder="Color/Print name"
                        value={row.colorName}
                        onChange={(e) => handleColorNameChange(row.key, e.target.value)}
                        style={{ width: '100%' }}
                      />
                    )}
                  </td>
                  {sizes.map((s) => (
                    <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                      {readOnly ? (
                        <Text>{row.quantities?.[s] || 0}</Text>
                      ) : (
                        <InputNumber
                          size="small"
                          min={0}
                          step={1}
                          value={row.quantities?.[s] || 0}
                          onChange={(v) => handleQtyChange(row.key, s, v)}
                          style={{ width: '100%' }}
                        />
                      )}
                    </td>
                  ))}
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <Text strong>{(row.total || 0).toLocaleString()}</Text>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <Text>{`${currSymbol} ${(row.rowValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Text>
                  </td>
                  {!readOnly && (
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <Popconfirm
                        title="Remove this color?"
                        onConfirm={() => handleRemoveColor(row.key)}
                        okText="Yes"
                        cancelText="No"
                      >
                        <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </td>
                  )}
                </tr>
              ))}

              {/* Total Qty Row */}
              <tr style={{ backgroundColor: 'var(--bg-secondary, #f8fafc)' }}>
                <td style={tdStyle}><Text strong>Total Qty</Text></td>
                {sizes.map((s) => (
                  <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                    <Text strong>{colTotals[s]}</Text>
                  </td>
                ))}
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <Text strong style={{ color: grandQty > 0 ? 'var(--success-color, #10b981)' : '#ff4d4f', fontSize: 14 }}>
                    {grandQty.toLocaleString()}
                  </Text>
                </td>
                <td style={tdStyle}></td>
                {!readOnly && <td style={tdStyle}></td>}
              </tr>

              {/* Total Value Row */}
              <tr style={{ backgroundColor: 'var(--secondary-light)' }}>
                <td style={tdStyle}><Text strong>Total Value</Text></td>
                {sizes.map((s) => (
                  <td key={s} style={{ ...tdStyle, textAlign: 'center' }}>
                    <Text style={{ fontSize: 11 }}>
                      {`${currSymbol} ${colValues[s].toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </Text>
                  </td>
                ))}
                <td style={tdStyle}></td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <Text strong style={{ color: 'var(--success-color, #10b981)', fontSize: 14 }}>
                    {`${currSymbol} ${grandValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </Text>
                </td>
                {!readOnly && <td style={tdStyle}></td>}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {sizes.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
          Select a size preset to configure the size breakdown
        </div>
      )}
    </div>
  );
};

// Cell styles
const thStyle = {
  padding: '8px 6px',
  borderBottom: '2px solid var(--border-color, #e5e7eb)',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '4px 6px',
  borderBottom: '1px solid var(--border-color, #f0f0f0)',
  whiteSpace: 'nowrap',
};

// ==================== EMPTY LINE TEMPLATE ====================

const createEmptyLine = () => ({
  key: `line_${Date.now()}`,
  buyerPoNo: '',
  styleNo: '',
  description: '',
  itemGroup: undefined,
  destination: '',
  basePrice: 0,
  dispatchDate: null,
  fabric: undefined,
  material: undefined,
  gsm: null,
  season: '',
  brand: '',
  collection: '',
  sizePreset: undefined,
  customSizes: [],
  sizes: [],
  sizePrices: {},
  colorRows: [
    { key: `c_${Date.now()}`, colorName: '', quantities: {}, total: 0, rowValue: 0 },
  ],
  lineQty: 0,
  lineTotal: 0,
});

// ==================== ORDER FORM ====================

const OrderForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [orderLines, setOrderLines] = useState([createEmptyLine()]);
  const [loading, setLoading] = useState(false);
  const [existingOrder, setExistingOrder] = useState(null);
  const [activeKeys, setActiveKeys] = useState([]);

  const isEdit = !!id;
  const orderStatus = existingOrder?.status;
  const isReferredBack = orderStatus === ORDER_STATUS.REFERRED_BACK;
  const canSaveAsDraft = isEdit
    ? hasPermission('orders', 'update') && orderStatus === ORDER_STATUS.DRAFT
    : hasPermission('orders', 'add');
  const canSubmit = canSubmitOrder();

  // Load existing order for edit
  useEffect(() => {
    if (!id) return;
    const loadOrder = async () => {
      setLoading(true);
      try {
        const order = await getOrderById(id);
        // Check if editable
        if (!EDITABLE_STATUSES.includes(order.status)) {
          message.warning('This order cannot be edited in its current status');
          navigate('/orders/list');
          return;
        }
        setExistingOrder(order);
        // Populate form
        form.setFieldsValue({
          buyerId: order.buyerId,
          orderDate: order.orderDate ? dayjs(order.orderDate) : null,
          shipDate: order.shipDate ? dayjs(order.shipDate) : null,
          currency: order.currency,
          shipmentMode: order.shipmentMode,
          deliveryTerms: order.deliveryTerms,
          allowance: order.allowance,
          paymentTerms: order.paymentTerms,
          paymentDays: order.paymentDays,
          remarks: order.remarks,
        });
        // Populate order lines (convert date strings to dayjs)
        const lines = (order.orderLines || []).map((l) => ({
          ...l,
          dispatchDate: l.dispatchDate ? dayjs(l.dispatchDate) : null,
        }));
        setOrderLines(lines.length > 0 ? lines : [createEmptyLine()]);
        setActiveKeys(lines.map((l) => l.key));
      } catch {
        message.error('Failed to load order');
        navigate('/orders/list');
      } finally {
        setLoading(false);
      }
    };
    loadOrder();
  }, [id, form, navigate]);

  // Watched form values for lead time calculation
  const formCurrency = Form.useWatch('currency', form);

  // Auto-calculate line totals when colorRows or sizePrices change
  const recalcLine = useCallback((line) => {
    const lineQty = (line.colorRows || []).reduce((sum, r) => sum + (r.total || 0), 0);
    const lineTotal = (line.colorRows || []).reduce((sum, r) => sum + (r.rowValue || 0), 0);
    return { ...line, lineQty, lineTotal };
  }, []);

  // Handle line field changes
  const handleLineChange = useCallback((lineKey, changes) => {
    setOrderLines((prev) =>
      prev.map((line) => {
        if (line.key !== lineKey) return line;
        const updated = { ...line, ...changes };

        // If basePrice changed and sizePrices haven't been manually overridden per-size,
        // update all sizePrices to the new basePrice
        if ('basePrice' in changes && changes.basePrice !== undefined) {
          const newPrices = { ...updated.sizePrices };
          const oldBase = line.basePrice || 0;
          updated.sizes.forEach((s) => {
            // Only update sizes that still had the old base price
            if (newPrices[s] === oldBase || newPrices[s] === undefined || newPrices[s] === 0) {
              newPrices[s] = changes.basePrice;
            }
          });
          updated.sizePrices = newPrices;
          // Recompute color row values
          updated.colorRows = (updated.colorRows || []).map((row) => {
            const rowValue = updated.sizes.reduce(
              (sum, s) => sum + (row.quantities?.[s] || 0) * (newPrices[s] || 0),
              0
            );
            return { ...row, rowValue };
          });
        }

        return recalcLine(updated);
      })
    );
  }, [recalcLine]);

  // Add order line
  const handleAddLine = () => {
    const newLine = createEmptyLine();
    setOrderLines((prev) => [...prev, newLine]);
    setActiveKeys((prev) => [...prev, newLine.key]);
  };

  // Remove order line
  const handleRemoveLine = (lineKey) => {
    if (orderLines.length <= 1) {
      message.warning('At least one order line is required');
      return;
    }
    setOrderLines((prev) => prev.filter((l) => l.key !== lineKey));
    setActiveKeys((prev) => prev.filter((k) => k !== lineKey));
  };

  // Computed totals
  const totalOrderQty = useMemo(
    () => orderLines.reduce((sum, l) => sum + (l.lineQty || 0), 0),
    [orderLines]
  );

  const totalOrderValue = useMemo(
    () => orderLines.reduce((sum, l) => sum + (l.lineTotal || 0), 0),
    [orderLines]
  );

  const leadTime = useMemo(() => {
    const orderDate = form.getFieldValue('orderDate');
    const shipDate = form.getFieldValue('shipDate');
    if (orderDate && shipDate) {
      return dayjs(shipDate).diff(dayjs(orderDate), 'day');
    }
    return null;
  }, [form]);

  // Assortment summary
  const assortmentSummary = useMemo(() => {
    const groups = {};
    orderLines.forEach((line) => {
      const dest = line.destination || 'Unspecified';
      if (!groups[dest]) {
        groups[dest] = { destination: dest, lineCount: 0, totalQty: 0, totalValue: 0 };
      }
      groups[dest].lineCount++;
      groups[dest].totalQty += line.lineQty || 0;
      groups[dest].totalValue += line.lineTotal || 0;
    });
    return Object.values(groups).map((g) => ({
      ...g,
      avgPrice: g.totalQty > 0 ? g.totalValue / g.totalQty : 0,
    }));
  }, [orderLines]);

  // Validation
  const validateForm = (isSubmit) => {
    const errors = [];
    const values = form.getFieldsValue();

    if (!values.buyerId) errors.push('Buyer is required');
    if (!values.orderDate) errors.push('Order Date is required');
    if (!values.shipDate) errors.push('Ship Date is required');
    if (values.orderDate && values.shipDate && dayjs(values.shipDate).isBefore(dayjs(values.orderDate))) {
      errors.push('Ship Date must be on or after Order Date');
    }

    if (isSubmit) {
      if (!values.currency) errors.push('Currency is required');
      if (!values.shipmentMode) errors.push('Shipment Mode is required');
      if (!values.deliveryTerms) errors.push('Delivery Terms is required');
      if (!values.paymentDays) errors.push('Payment Days is required');
    }

    if (orderLines.length === 0) {
      errors.push('At least one Order Line is required');
    }

    // Validate each line
    orderLines.forEach((line, idx) => {
      const lineNum = idx + 1;
      if (isSubmit && !line.styleNo) {
        errors.push(`Line #${lineNum}: Style No is required`);
      }
      if (isSubmit && line.sizes.length === 0) {
        errors.push(`Line #${lineNum}: Select a size preset and configure sizes`);
      }
      if (isSubmit && line.sizes.length > 0) {
        const hasZeroPrice = line.sizes.some((s) => !line.sizePrices[s] || line.sizePrices[s] <= 0);
        if (hasZeroPrice) {
          errors.push(`Line #${lineNum}: All size prices must be greater than 0`);
        }
      }
      if (isSubmit && (line.lineQty || 0) <= 0) {
        errors.push(`Line #${lineNum}: Size breakdown total must be greater than 0`);
      }
      if (isSubmit && line.colorRows?.length > 0) {
        const emptyColors = line.colorRows.filter((r) => !r.colorName?.trim());
        if (emptyColors.length > 0) {
          errors.push(`Line #${lineNum}: All color/print names are required`);
        }
      }
    });

    // Check for duplicate Buyer PO + Style No
    if (isSubmit) {
      const seen = new Set();
      orderLines.forEach((line, idx) => {
        if (line.buyerPoNo && line.styleNo) {
          const key = `${line.buyerPoNo}::${line.styleNo}`;
          if (seen.has(key)) {
            errors.push(`Line #${idx + 1}: Duplicate Buyer PO + Style No (${line.buyerPoNo} / ${line.styleNo})`);
          }
          seen.add(key);
        }
      });
    }

    return errors;
  };

  // Build order data for save
  const buildOrderData = (status) => {
    const values = form.getFieldsValue();
    const buyer = BUYERS.find((b) => b.value === values.buyerId);

    return {
      orderNo: existingOrder?.orderNo || generateOrderNumber(),
      status,
      buyerId: values.buyerId,
      buyerName: buyer?.label || '',
      entryDate: existingOrder?.entryDate || dayjs().format('YYYY-MM-DD'),
      orderDate: values.orderDate ? dayjs(values.orderDate).format('YYYY-MM-DD') : null,
      shipDate: values.shipDate ? dayjs(values.shipDate).format('YYYY-MM-DD') : null,
      leadTime: values.orderDate && values.shipDate
        ? dayjs(values.shipDate).diff(dayjs(values.orderDate), 'day')
        : null,
      currency: values.currency,
      shipmentMode: values.shipmentMode,
      deliveryTerms: values.deliveryTerms,
      allowance: values.allowance,
      paymentTerms: values.paymentTerms,
      paymentDays: values.paymentDays,
      remarks: values.remarks,
      totalOrderQty,
      totalOrderValue,
      orderLines: orderLines.map((l) => ({
        ...l,
        dispatchDate: l.dispatchDate ? dayjs(l.dispatchDate).format('YYYY-MM-DD') : null,
      })),
    };
  };

  // Save as draft
  const handleSaveDraft = async () => {
    const errors = validateForm(false);
    if (errors.length > 0) {
      errors.forEach((e) => message.error(e));
      return;
    }
    setLoading(true);
    try {
      const data = buildOrderData(ORDER_STATUS.DRAFT);
      if (isEdit) {
        await updateOrder(id, data);
        message.success('Order updated as draft');
      } else {
        await createOrder(data);
        message.success('Order saved as draft');
      }
      navigate('/orders/list');
    } catch {
      message.error('Failed to save order');
    } finally {
      setLoading(false);
    }
  };

  // Submit / Resubmit
  const handleSubmitOrder = () => {
    const errors = validateForm(true);
    if (errors.length > 0) {
      errors.forEach((e) => message.error(e));
      return;
    }
    Modal.confirm({
      title: isReferredBack ? 'Resubmit Order' : 'Submit Order',
      content: isReferredBack
        ? 'Are you sure you want to resubmit this order? It will be confirmed again.'
        : 'Are you sure you want to submit this order? Once submitted, it will be confirmed and can only be edited after being referred back.',
      okText: isReferredBack ? 'Resubmit' : 'Submit',
      okType: 'primary',
      cancelText: 'Cancel',
      onOk: async () => {
        setLoading(true);
        try {
          const data = buildOrderData(ORDER_STATUS.CONFIRMED);
          if (isEdit) {
            await updateOrder(id, data);
          } else {
            await createOrder(data);
          }
          message.success(isReferredBack ? 'Order resubmitted and confirmed' : 'Order submitted and confirmed');
          navigate('/orders/list');
        } catch {
          message.error('Failed to submit order');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // Panel header for each line
  const getLineHeader = (line, idx) => {
    const destShort = line.destination
      ? line.destination.length > 30
        ? `${line.destination.substring(0, 30)}...`
        : line.destination
      : 'No destination';
    return (
      <Space wrap>
        <Tag color="blue">#{idx + 1}</Tag>
        <Text strong>{line.description || line.styleNo || 'New Assortment'}</Text>
        {line.styleNo && <Text type="secondary">({line.styleNo})</Text>}
        <Text type="secondary">|</Text>
        <Text>Qty: {(line.lineQty || 0).toLocaleString()}</Text>
        <Text type="secondary">|</Text>
        <Text style={{ color: 'var(--success-color, #10b981)' }}>
          {getCurrencySymbol(formCurrency)} {(line.lineTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
        <Text type="secondary">→ {destShort}</Text>
      </Space>
    );
  };

  return (
    <div className="animate-fade-in-up" style={{ paddingBottom: 60 }}>
      {/* Page Header */}
      <div className="page-header">
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/orders/list')}
          />
          <h1>{isEdit ? 'Edit Order' : 'Create New Order'}</h1>
          {existingOrder && (
            <Tag color={
              orderStatus === ORDER_STATUS.DRAFT ? 'default' :
              orderStatus === ORDER_STATUS.REFERRED_BACK ? 'orange' : 'green'
            }>
              {getStatusLabel(orderStatus)}
            </Tag>
          )}
        </Space>
        <div className="header-actions">
          {canSaveAsDraft && !isReferredBack && (
            <Button
              icon={<SaveOutlined />}
              onClick={handleSaveDraft}
              loading={loading}
            >
              Save as Draft
            </Button>
          )}
          {canSubmit && !isReferredBack && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSubmitOrder}
              loading={loading}
            >
              Submit Order
            </Button>
          )}
          {canSubmit && isReferredBack && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSubmitOrder}
              loading={loading}
            >
              Resubmit Order
            </Button>
          )}
        </div>
      </div>

      {/* Referred Back Reason */}
      {isReferredBack && existingOrder?.referBackReason && (
        <Card
          size="small"
          style={{ marginBottom: 16, borderColor: '#fa8c16', backgroundColor: 'var(--accent-light)' }}
        >
          <Text strong style={{ color: '#fa8c16' }}>Refer Back Reason: </Text>
          <Text>{existingOrder.referBackReason}</Text>
        </Card>
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          orderDate: dayjs(),
          currency: 'USD',
        }}
      >
        {/* Order Header */}
        <Card style={{ marginBottom: 16 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Order Details</Title>
          <Row gutter={24}>
            <Col xs={24} md={8} lg={6}>
              <Form.Item
                name="buyerId"
                label="Buyer"
                rules={[{ required: true, message: 'Select buyer' }]}
              >
                <Select
                  placeholder="Select buyer"
                  showSearch
                  filterOption={(input, option) =>
                    option.label.toLowerCase().includes(input.toLowerCase())
                  }
                  options={BUYERS}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8} lg={6}>
              <Form.Item label="Order No">
                <Input
                  value={existingOrder?.orderNo || 'Auto-generated'}
                  disabled
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={4} lg={3}>
              <Form.Item label="Entry Date">
                <DatePicker
                  value={existingOrder ? dayjs(existingOrder.entryDate) : dayjs()}
                  disabled
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={4} lg={3}>
              <Form.Item
                name="orderDate"
                label="Order Date"
                rules={[{ required: true, message: 'Select order date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4} lg={3}>
              <Form.Item
                name="shipDate"
                label="Ship Date"
                rules={[{ required: true, message: 'Select ship date' }]}
              >
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4} lg={3}>
              <Form.Item label="Lead Time">
                <Input
                  value={leadTime !== null ? `${leadTime} days` : '-'}
                  disabled
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col xs={12} md={4} lg={3}>
              <Form.Item name="currency" label="Currency">
                <Select options={CURRENCIES} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4} lg={3}>
              <Form.Item name="shipmentMode" label="Shipment Mode">
                <Select placeholder="Select" options={SHIPMENT_MODES} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4} lg={3}>
              <Form.Item name="deliveryTerms" label="Delivery Terms">
                <Select placeholder="Select" options={DELIVERY_TERMS} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4} lg={3}>
              <Form.Item name="allowance" label="Allowance">
                <Input placeholder="e.g. 2%" />
              </Form.Item>
            </Col>
            <Col xs={12} md={4} lg={3}>
              <Form.Item name="paymentTerms" label="Payment Terms">
                <Select placeholder="Select" options={PAYMENT_TERMS} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4} lg={3}>
              <Form.Item name="paymentDays" label="Payment Days">
                <Select placeholder="Select" options={PAYMENT_DAYS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={24}>
            <Col xs={24} md={16}>
              <Form.Item name="remarks" label="Remarks">
                <TextArea rows={2} placeholder="Notes or special instructions" />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item label="Total Order Qty">
                <Input
                  value={totalOrderQty.toLocaleString()}
                  disabled
                  style={{ backgroundColor: 'var(--bg-tertiary)', fontWeight: 600 }}
                />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item label="Total Order Value">
                <Input
                  value={`${getCurrencySymbol(formCurrency)} ${totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  disabled
                  style={{ backgroundColor: 'var(--secondary-light)', fontWeight: 600, color: 'var(--success-color, #10b981)' }}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Order Lines */}
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>
              Order Lines ({orderLines.length})
            </Title>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={handleAddLine}
            >
              Add Order Line
            </Button>
          </div>

          <Collapse
            activeKey={activeKeys}
            onChange={setActiveKeys}
            expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
            items={orderLines.map((line, idx) => ({
              key: line.key,
              label: getLineHeader(line, idx),
              extra: orderLines.length > 1 && (
                <Popconfirm
                  title="Remove this order line?"
                  onConfirm={(e) => {
                    e?.stopPropagation?.();
                    handleRemoveLine(line.key);
                  }}
                  onCancel={(e) => e?.stopPropagation?.()}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<DeleteOutlined />}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              ),
              children: (
                <div>
                  {/* Line Info Row 1 */}
                  <Row gutter={16}>
                    <Col xs={12} md={6}>
                      <Form.Item label="Buyer PO No" style={{ marginBottom: 12 }}>
                        <Input
                          placeholder="Buyer PO No"
                          value={line.buyerPoNo}
                          onChange={(e) => handleLineChange(line.key, { buyerPoNo: e.target.value })}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item label="Style No" required style={{ marginBottom: 12 }}>
                        <Input
                          placeholder="Style reference"
                          value={line.styleNo}
                          onChange={(e) => handleLineChange(line.key, { styleNo: e.target.value })}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item label="Description" style={{ marginBottom: 12 }}>
                        <Input
                          placeholder="Garment description"
                          value={line.description}
                          onChange={(e) => handleLineChange(line.key, { description: e.target.value })}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Item label="Item Group" style={{ marginBottom: 12 }}>
                        <Select
                          placeholder="Select"
                          value={line.itemGroup}
                          onChange={(v) => handleLineChange(line.key, { itemGroup: v })}
                          options={ITEM_GROUPS}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Line Info Row 2 */}
                  <Row gutter={16}>
                    <Col xs={24} md={12}>
                      <Form.Item label="Destination" style={{ marginBottom: 12 }}>
                        <Input
                          placeholder="Shipping destination for this line"
                          value={line.destination}
                          onChange={(e) => handleLineChange(line.key, { destination: e.target.value })}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item label="Base Price" style={{ marginBottom: 12 }}>
                        <InputNumber
                          min={0}
                          step={0.01}
                          precision={2}
                          style={{ width: '100%' }}
                          placeholder="0.00"
                          value={line.basePrice}
                          onChange={(v) => handleLineChange(line.key, { basePrice: v || 0 })}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item label="Dispatch Date" style={{ marginBottom: 12 }}>
                        <DatePicker
                          style={{ width: '100%' }}
                          value={line.dispatchDate}
                          onChange={(v) => handleLineChange(line.key, { dispatchDate: v })}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Line Info Row 3 — Material details */}
                  <Row gutter={16}>
                    <Col xs={12} md={4}>
                      <Form.Item label="Fabric" style={{ marginBottom: 12 }}>
                        <Select
                          placeholder="Select"
                          value={line.fabric}
                          onChange={(v) => handleLineChange(line.key, { fabric: v })}
                          options={FABRIC_TYPES}
                          showSearch
                          filterOption={(input, option) =>
                            option.label.toLowerCase().includes(input.toLowerCase())
                          }
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={3}>
                      <Form.Item label="Material" style={{ marginBottom: 12 }}>
                        <Select
                          placeholder="Select"
                          value={line.material}
                          onChange={(v) => handleLineChange(line.key, { material: v })}
                          options={MATERIAL_TYPES}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={8} md={3}>
                      <Form.Item label="GSM" style={{ marginBottom: 12 }}>
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          placeholder="GSM"
                          value={line.gsm}
                          onChange={(v) => handleLineChange(line.key, { gsm: v })}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={8} md={4}>
                      <Form.Item label="Season" style={{ marginBottom: 12 }}>
                        <Input
                          placeholder="e.g. SS/26"
                          value={line.season}
                          onChange={(e) => handleLineChange(line.key, { season: e.target.value })}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={8} md={4}>
                      <Form.Item label="Brand" style={{ marginBottom: 12 }}>
                        <Input
                          placeholder="Brand"
                          value={line.brand}
                          onChange={(e) => handleLineChange(line.key, { brand: e.target.value })}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={8} md={4}>
                      <Form.Item label="Collection" style={{ marginBottom: 12 }}>
                        <Input
                          placeholder="Collection"
                          value={line.collection}
                          onChange={(e) => handleLineChange(line.key, { collection: e.target.value })}
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Divider style={{ margin: '8px 0 16px' }} />

                  {/* Size Breakdown Table */}
                  <SizeBreakdownTable
                    line={line}
                    currency={formCurrency || 'USD'}
                    onLineChange={(changes) => handleLineChange(line.key, changes)}
                  />
                </div>
              ),
            }))}
          />
        </Card>

        {/* Order Summary */}
        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>Order Summary</Title>

          {/* Assortment Summary */}
          {assortmentSummary.length > 0 && (
            <>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>Assortment by Destination</Text>
              <Table
                dataSource={assortmentSummary}
                rowKey="destination"
                pagination={false}
                size="small"
                style={{ marginBottom: 16 }}
                columns={[
                  {
                    title: 'Destination',
                    dataIndex: 'destination',
                    key: 'destination',
                    ellipsis: true,
                  },
                  { title: 'Lines', dataIndex: 'lineCount', key: 'lineCount', width: 70, align: 'center' },
                  {
                    title: 'Total Qty',
                    dataIndex: 'totalQty',
                    key: 'totalQty',
                    width: 100,
                    align: 'right',
                    render: (v) => <Text strong>{v.toLocaleString()}</Text>,
                  },
                  {
                    title: 'Avg Price',
                    dataIndex: 'avgPrice',
                    key: 'avgPrice',
                    width: 100,
                    align: 'right',
                    render: (v) => `${getCurrencySymbol(formCurrency)} ${v.toFixed(2)}`,
                  },
                  {
                    title: 'Total Value',
                    dataIndex: 'totalValue',
                    key: 'totalValue',
                    width: 130,
                    align: 'right',
                    render: (v) => (
                      <Text strong style={{ color: 'var(--success-color, #10b981)' }}>
                        {`${getCurrencySymbol(formCurrency)} ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </Text>
                    ),
                  },
                ]}
              />
            </>
          )}

          {/* Grand Total */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 32,
              padding: '16px 0',
              borderTop: '2px solid var(--border-color, #e5e7eb)',
            }}
          >
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Total Lines</Text>
              <Text strong style={{ fontSize: 18 }}>{orderLines.length}</Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Total Quantity</Text>
              <Text strong style={{ fontSize: 18 }}>{totalOrderQty.toLocaleString()}</Text>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Total Value</Text>
              <Text strong style={{ fontSize: 18, color: 'var(--success-color, #10b981)' }}>
                {getCurrencySymbol(formCurrency)} {totalOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </div>
          </div>
        </Card>
      </Form>

      <FloatButton.BackTop
        visibilityHeight={300}
        tooltip="Back to top"
        style={{ right: 24, bottom: 24 }}
      />
    </div>
  );
};

export default OrderForm;
