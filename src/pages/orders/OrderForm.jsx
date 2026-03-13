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
  FloatButton,
  Popover,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  CaretRightOutlined,
  PictureOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { hasPermission, canSubmitOrder } from '../../utils/permissions';
import { createOrder, updateOrder, getOrderById } from '../../services/orderService';
import { getBuyers } from '../../services/buyerService';
import {
  ORDER_STATUS,
  EDITABLE_STATUSES,
  PAYMENT_TERMS,
  COMPONENT_OPTIONS,
  SIZE_PRESETS,
  generateOrderNumber,
  getCurrencySymbol,
  getStatusLabel,
} from '../../utils/orderConstants';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ==================== COMPONENT DETAILS DIALOG ====================

const ComponentDialog = ({ visible, components, onSave, onCancel }) => {
  const [rows, setRows] = useState(() =>
    components && components.length > 0
      ? components
      : [
          { key: 'c1', name: '', description: '', qtyPerSet: 1 },
          { key: 'c2', name: '', description: '', qtyPerSet: 1 },
        ]
  );

  // Sync when components prop changes (e.g. reopening)
  useEffect(() => {
    if (visible) {
      setRows(
        components && components.length > 0
          ? components
          : [
              { key: 'c1', name: '', description: '', qtyPerSet: 1 },
              { key: 'c2', name: '', description: '', qtyPerSet: 1 },
            ]
      );
    }
  }, [visible, components]);

  const handleChange = (key, field, value) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const handleAdd = () => {
    setRows((prev) => [
      ...prev,
      { key: `c_${Date.now()}`, name: '', description: '', qtyPerSet: 1 },
    ]);
  };

  const handleRemove = (key) => {
    if (rows.length <= 2) {
      message.warning('At least 2 components are required for Multiple');
      return;
    }
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const handleOk = () => {
    const allNamed = rows.every((r) => r.name.trim());
    if (!allNamed) {
      message.error('Component name is required for all rows');
      return;
    }
    onSave(rows);
  };

  const columns = [
    {
      title: 'Component Name *',
      dataIndex: 'name',
      render: (v, r) => (
        <Input
          size="small"
          value={v}
          placeholder="e.g. Top, Bottom, Jacket"
          onChange={(e) => handleChange(r.key, 'name', e.target.value)}
        />
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (v, r) => (
        <Input
          size="small"
          value={v}
          placeholder="Optional"
          onChange={(e) => handleChange(r.key, 'description', e.target.value)}
        />
      ),
    },
    {
      title: 'Qty / Set',
      dataIndex: 'qtyPerSet',
      width: 90,
      render: (v, r) => (
        <InputNumber
          size="small"
          min={1}
          controls={false}
          value={v}
          onChange={(val) => handleChange(r.key, 'qtyPerSet', val || 1)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: '',
      width: 40,
      render: (_, r) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={() => handleRemove(r.key)}
        />
      ),
    },
  ];

  return (
    <Modal
      title="Component Details"
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Save Components"
      width={640}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
        Define the individual parts of this multi-component garment (e.g. Top + Bottom for a 2-piece set, Jacket + Trousers for a suit).
      </Text>
      <Table
        dataSource={rows}
        rowKey="key"
        columns={columns}
        pagination={false}
        size="small"
        style={{ marginBottom: 8 }}
      />
      <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={handleAdd}>
        Add Component
      </Button>
    </Modal>
  );
};

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
            <Text strong style={{ fontSize: 13 }}>Size Preset: <span style={{ color: '#ff4d4f' }}>*</span></Text>
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
                <th style={{ ...thStyle, minWidth: 180 }}>
                  Color/Print <span style={{ color: '#ff4d4f' }}>*</span>
                </th>
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
                        placeholder="Color/Print name *"
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
  destination: '',
  dispatchDate: null,
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

  // Core state
  const [orderLines, setOrderLines] = useState([createEmptyLine()]);
  const [loading, setLoading] = useState(false);
  const [existingOrder, setExistingOrder] = useState(null);
  const [activeKeys, setActiveKeys] = useState([]);

  // Buyer data
  const [buyers, setBuyers] = useState([]);
  const [buyersLoading, setBuyersLoading] = useState(false);

  // Component dialog
  const [componentModalVisible, setComponentModalVisible] = useState(false);
  const [formComponents, setFormComponents] = useState([]);

  // Generated order number for add mode
  const [generatedOrderNo] = useState(() => generateOrderNumber());

  const isEdit = !!id;
  const orderStatus = existingOrder?.status;
  const isReferredBack = orderStatus === ORDER_STATUS.REFERRED_BACK;
  const canSaveAsDraft = isEdit
    ? hasPermission('orders', 'update') && orderStatus === ORDER_STATUS.DRAFT
    : hasPermission('orders', 'add');
  const canSubmit = canSubmitOrder();

  // Watch form values
  const formCurrency = Form.useWatch('currency', form);
  const watchedBuyerId = Form.useWatch('buyerId', form);

  // Buyer destinations derived from selected buyer
  const buyerDestinations = useMemo(() => {
    const buyer = buyers.find((b) => b.id === watchedBuyerId);
    return (buyer?.shippingLocations || [])
      .filter((l) => l.active !== false)
      .map((loc) => ({
        value: loc.label || [loc.city, loc.country].filter(Boolean).join(', '),
        label: loc.label || [loc.city, loc.country].filter(Boolean).join(', '),
      }));
  }, [buyers, watchedBuyerId]);

  // Load buyers from API
  useEffect(() => {
    const loadBuyers = async () => {
      setBuyersLoading(true);
      try {
        const data = await getBuyers();
        const list = Array.isArray(data) ? data : (data?.content || []);
        setBuyers(list.filter((b) => b.active !== false));
      } catch {
        message.warning('Could not load buyers from server');
        setBuyers([]);
      } finally {
        setBuyersLoading(false);
      }
    };
    loadBuyers();
  }, []);

  // Load existing order for edit
  useEffect(() => {
    if (!id) return;
    const loadOrder = async () => {
      setLoading(true);
      try {
        const order = await getOrderById(id);
        if (!EDITABLE_STATUSES.includes(order.status)) {
          message.warning('This order cannot be edited in its current status');
          navigate('/orders/list');
          return;
        }
        setExistingOrder(order);

        form.setFieldsValue({
          costingId: order.costingId,
          buyerId: order.buyerId,
          styleNo: order.styleNo,
          garmentType: order.garmentType,
          season: order.season,
          component: order.component,
          currency: order.currency,
          paymentTerms: order.paymentTerms,
          paymentDays: order.paymentDays,
          remarks: order.remarks,
        });

        if (order.components?.length > 0) setFormComponents(order.components);

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

  // Recalculate line totals
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
        return recalcLine({ ...line, ...changes });
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

  // Assortment summary grouped by Buyer PO + Destination
  const assortmentSummary = useMemo(() => {
    const groups = {};
    orderLines.forEach((line) => {
      const po = line.buyerPoNo || 'Unspecified';
      const dest = line.destination || 'Unspecified';
      const key = `${po}::${dest}`;
      if (!groups[key]) {
        groups[key] = { key, buyerPoNo: po, destination: dest, totalQty: 0, totalValue: 0 };
      }
      groups[key].totalQty += line.lineQty || 0;
      groups[key].totalValue += line.lineTotal || 0;
    });
    return Object.values(groups).map((g) => ({
      ...g,
      avgPrice: g.totalQty > 0 ? g.totalValue / g.totalQty : 0,
    }));
  }, [orderLines]);

  // ==================== VALIDATION ====================

  const validateForm = (isSubmit) => {
    const errors = [];
    const values = form.getFieldsValue();

    // Always required
    if (!values.costingId?.trim()) errors.push('Costing ID is required');
    if (!values.buyerId) errors.push('Buyer is required');

    if (isSubmit) {
      if (!values.component) errors.push('Component is required');
      if (values.component === 'Multiple' && formComponents.length < 2) {
        errors.push('Please define at least 2 components for Multiple component type');
      }
      if (!values.paymentTerms) errors.push('Payment Terms is required');
      if (!values.paymentDays || values.paymentDays <= 0) {
        errors.push('Payment Days is required and must be greater than 0');
      }
    }

    if (orderLines.length === 0) errors.push('At least one Order Line is required');

    // Check for duplicate Buyer PO + Destination
    const seen = new Set();
    orderLines.forEach((line, idx) => {
      if (line.buyerPoNo && line.destination) {
        const key = `${line.buyerPoNo}::${line.destination}`;
        if (seen.has(key)) {
          errors.push(
            `Lines #${idx + 1}: Buyer PO '${line.buyerPoNo}' + Destination '${line.destination}' is duplicated — combine into a single line`
          );
        }
        seen.add(key);
      }
    });

    // Per-line validation
    orderLines.forEach((line, idx) => {
      const lineNum = idx + 1;

      if (!line.buyerPoNo?.trim()) errors.push(`Line #${lineNum}: Buyer PO No is required`);
      if (!line.destination) errors.push(`Line #${lineNum}: Destination is required`);
      if (!line.dispatchDate) errors.push(`Line #${lineNum}: Dispatch Date is required`);

      if (isSubmit) {
        if (!line.sizePreset) {
          errors.push(`Line #${lineNum}: Size preset is required`);
        } else if (line.sizes.length === 0) {
          errors.push(`Line #${lineNum}: Configure sizes for the selected preset`);
        } else {
          // Must have at least one qty entered
          const hasAnyQty = (line.colorRows || []).some((row) =>
            line.sizes.some((s) => (row.quantities?.[s] || 0) > 0)
          );
          if (!hasAnyQty) {
            errors.push(`Line #${lineNum}: Enter at least one size quantity`);
          } else {
            // For every size with qty, price must be set; for every size with price, qty must be set
            line.sizes.forEach((s) => {
              const sizeHasQty = (line.colorRows || []).some((row) => (row.quantities?.[s] || 0) > 0);
              const sizePrice = line.sizePrices[s] || 0;
              if (sizeHasQty && sizePrice <= 0) {
                errors.push(`Line #${lineNum}: Price is missing for size "${s}" which has quantity entered`);
              }
              if (!sizeHasQty && sizePrice > 0) {
                errors.push(`Line #${lineNum}: Quantity is missing for size "${s}" which has a price entered`);
              }
            });
          }

          // Color names must be filled
          const emptyColors = (line.colorRows || []).filter((r) => !r.colorName?.trim());
          if (emptyColors.length > 0) {
            errors.push(`Line #${lineNum}: Color/Print name is required for all color rows`);
          }
        }
      }
    });

    return errors;
  };

  // ==================== BUILD ORDER DATA ====================

  const buildOrderData = (status) => {
    const values = form.getFieldsValue();
    const buyer = buyers.find((b) => b.id === values.buyerId);
    const orderDate = dayjs();

    return {
      orderNo: existingOrder?.orderNo || generatedOrderNo,
      status,
      costingId: values.costingId,
      buyerId: values.buyerId,
      buyerName: buyer?.name || '',
      entryDate: existingOrder?.entryDate || orderDate.format('YYYY-MM-DD'),
      orderDate: orderDate.format('YYYY-MM-DD'),
      styleNo: values.styleNo,
      garmentType: values.garmentType,
      season: values.season,
      component: values.component,
      components: values.component === 'Multiple' ? formComponents : [],
      currency: values.currency,
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

  // ==================== SAVE / SUBMIT ====================

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
    const hasIdentity = line.buyerPoNo || line.destination;
    const label = hasIdentity
      ? [line.buyerPoNo, line.destination].filter(Boolean).join(' → ')
      : 'New Assortment';
    const destShort =
      label.length > 60 ? `${label.substring(0, 60)}...` : label;
    return (
      <Space wrap>
        <Tag color="blue">#{idx + 1}</Tag>
        <Text strong>{destShort}</Text>
        <Text type="secondary">|</Text>
        <Text>Qty: {(line.lineQty || 0).toLocaleString()}</Text>
        <Text type="secondary">|</Text>
        <Text style={{ color: 'var(--success-color, #10b981)' }}>
          {getCurrencySymbol(formCurrency)}{' '}
          {(line.lineTotal || 0).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Text>
      </Space>
    );
  };

  // ==================== RENDER ====================

  return (
    <div className="animate-fade-in-up">
      {/* Page Header */}
      <div className="page-header" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders/list')} />
          <h1>{isEdit ? 'Edit Order' : 'Create New Order'}</h1>
          {existingOrder && (
            <Tag
              color={
                orderStatus === ORDER_STATUS.DRAFT
                  ? 'default'
                  : orderStatus === ORDER_STATUS.REFERRED_BACK
                  ? 'orange'
                  : 'green'
              }
            >
              {getStatusLabel(orderStatus)}
            </Tag>
          )}
        </Space>
        <div className="header-actions">
          {canSaveAsDraft && !isReferredBack && (
            <Button icon={<SaveOutlined />} onClick={handleSaveDraft} loading={loading}>
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

      {/* Component Details Dialog */}
      <ComponentDialog
        visible={componentModalVisible}
        components={formComponents}
        onSave={(saved) => {
          setFormComponents(saved);
          setComponentModalVisible(false);
        }}
        onCancel={() => {
          setComponentModalVisible(false);
          // Revert to Single if nothing was saved
          if (formComponents.length === 0) {
            form.setFieldValue('component', 'Single');
          }
        }}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          orderDate: dayjs(),
        }}
      >
        {/* ==================== ORDER DETAILS ==================== */}
        <Card style={{ marginBottom: 16 }}>
          <Title level={5} style={{ marginBottom: 16 }}>Order Details</Title>

          {/* Row 1: Costing ID, Order No, Buyer, Style No, Garment Type, Season, Component */}
          <Row gutter={16}>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item
                name="costingId"
                label="Costing ID"
                rules={[{ required: true, message: 'Enter costing ID' }]}
              >
                <Input placeholder="Enter costing ID" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item label="Order No">
                <Input
                  value={existingOrder?.orderNo || generatedOrderNo}
                  disabled
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                />
              </Form.Item>
            </Col>
            {/* buyerId hidden — used for destination lookup; value set from costing */}
            <Form.Item name="buyerId" hidden noStyle><Input /></Form.Item>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item label="Buyer">
                <Input
                  value={buyers.find((b) => b.id === watchedBuyerId)?.name || ''}
                  placeholder="Populated from costing"
                  disabled
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item name="styleNo" label="Style No">
                <Input
                  placeholder="Populated from costing"
                  disabled
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item name="garmentType" label="Garment Type">
                <Input
                  placeholder="Populated from costing"
                  disabled
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item name="season" label="Season">
                <Input
                  placeholder="Populated from costing"
                  disabled
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 1b: Component + Currency + Order Date + Payment Terms + Payment Days */}
          <Row gutter={16}>

            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item
                name="component"
                label="Component"
                rules={[{ required: true, message: 'Select component type' }]}
              >
                <Select
                  placeholder="Select"
                  options={COMPONENT_OPTIONS}
                  onChange={(val) => {
                    if (val === 'Multiple') {
                      setComponentModalVisible(true);
                    } else {
                      setFormComponents([]);
                    }
                  }}
                />
              </Form.Item>
              {formComponents.length > 0 && (
                <div style={{ marginTop: -16, marginBottom: 8 }}>
                  <Button
                    type="link"
                    size="small"
                    style={{ padding: 0, fontSize: 12 }}
                    onClick={() => setComponentModalVisible(true)}
                  >
                    {formComponents.length} components · Edit
                  </Button>
                </div>
              )}
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item name="currency" label="Currency">
                <Input
                  placeholder="Populated from costing"
                  disabled
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item label="Order Date">
                <DatePicker
                  value={dayjs()}
                  disabled
                  style={{ width: '100%', backgroundColor: 'var(--bg-tertiary)' }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item
                name="paymentTerms"
                label="Payment Terms"
                rules={[{ required: true, message: 'Select payment terms' }]}
              >
                <Select placeholder="Select" options={PAYMENT_TERMS} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={8} lg={4}>
              <Form.Item
                name="paymentDays"
                label="Payment Days"
                rules={[
                  { required: true, message: 'Enter payment days' },
                  { type: 'number', min: 1, message: 'Must be at least 1 day' },
                ]}
              >
                <InputNumber
                  style={{ width: '100%', height: 40, lineHeight: '30px' }}
                  min={1}
                  controls={false}
                  placeholder="e.g. 60"
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Row 3: Order Qty, Total Value, Remarks, Image */}
          <Row gutter={16} align="bottom">
            <Col xs={12} sm={6} md={4} lg={3}>
              <Form.Item label="Order Qty">
                <Input
                  value={totalOrderQty.toLocaleString()}
                  disabled
                  style={{ backgroundColor: 'var(--bg-tertiary)', fontWeight: 600 }}
                />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6} md={5} lg={4}>
              <Form.Item label="Total Order Value">
                <Input
                  value={`${getCurrencySymbol(formCurrency)} ${totalOrderValue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`}
                  disabled
                  style={{
                    backgroundColor: 'var(--secondary-light)',
                    fontWeight: 600,
                    color: 'var(--success-color, #10b981)',
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={24} md={11} lg={13}>
              <Form.Item name="remarks" label="Remarks">
                <TextArea rows={1} placeholder="Notes or special instructions" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={6} md={4} lg={4}>
              <Form.Item label="Garment Image">
                <Popover
                  content={
                    <div style={{ padding: 8, color: '#999', fontSize: 12, textAlign: 'center' }}>
                      Garment image pulled from Costing module
                    </div>
                  }
                  trigger="hover"
                  placement="left"
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      border: '1px dashed #d9d9d9',
                      borderRadius: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#bbb',
                      fontSize: 10,
                      cursor: 'default',
                      userSelect: 'none',
                    }}
                  >
                    <PictureOutlined style={{ fontSize: 22 }} />
                  </div>
                </Popover>
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ==================== ORDER LINES ==================== */}
        <Card style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Title level={5} style={{ margin: 0 }}>
              Order Lines ({orderLines.length})
            </Title>
            <Button type="dashed" icon={<PlusOutlined />} onClick={handleAddLine}>
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
                  {/* Line Fields */}
                  <Row gutter={16}>
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item
                        label={
                          <span>
                            Buyer PO No <span style={{ color: '#ff4d4f' }}>*</span>
                          </span>
                        }
                        style={{ marginBottom: 12 }}
                      >
                        <Input
                          placeholder="Buyer PO Number"
                          value={line.buyerPoNo}
                          onChange={(e) =>
                            handleLineChange(line.key, { buyerPoNo: e.target.value })
                          }
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item
                        label={
                          <span>
                            Destination <span style={{ color: '#ff4d4f' }}>*</span>
                          </span>
                        }
                        style={{ marginBottom: 12 }}
                      >
                        <Select
                          placeholder={
                            buyerDestinations.length > 0
                              ? 'Select destination'
                              : 'Select a buyer first'
                          }
                          showSearch
                          value={line.destination || undefined}
                          options={buyerDestinations}
                          disabled={buyerDestinations.length === 0}
                          filterOption={(input, option) =>
                            option.label.toLowerCase().includes(input.toLowerCase())
                          }
                          onChange={(v) => handleLineChange(line.key, { destination: v })}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item
                        label={
                          <span>
                            Dispatch Date <span style={{ color: '#ff4d4f' }}>*</span>
                          </span>
                        }
                        style={{ marginBottom: 12 }}
                      >
                        <DatePicker
                          style={{ width: '100%' }}
                          value={line.dispatchDate}
                          disabledDate={(current) =>
                            current && current <= dayjs().endOf('day')
                          }
                          onChange={(v) => handleLineChange(line.key, { dispatchDate: v })}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={12} md={8}>
                      <Form.Item label="Lead Time" style={{ marginBottom: 12 }}>
                        <Input
                          disabled
                          style={{ backgroundColor: 'var(--bg-tertiary)', cursor: 'not-allowed', pointerEvents: 'auto' }}
                          prefix={<ClockCircleOutlined />}
                          value={
                            line.dispatchDate
                              ? `${dayjs(line.dispatchDate).diff(dayjs(), 'day')} days`
                              : ''
                          }
                          placeholder="—"
                        />
                      </Form.Item>
                    </Col>
                  </Row>

                  {/* Components — shown when Multiple component is selected */}
                  {formComponents.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                        }}
                      >
                        <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                          Components
                        </Text>
                        <Button
                          type="link"
                          size="small"
                          style={{ padding: 0, fontSize: 11, height: 'auto' }}
                          onClick={() => setComponentModalVisible(true)}
                        >
                          Edit
                        </Button>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {formComponents.map((comp) => (
                          <div
                            key={comp.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 10px',
                              border: '1px solid var(--border-color, #e5e7eb)',
                              borderRadius: 8,
                              background: 'var(--bg-secondary, #f8fafc)',
                            }}
                          >
                            <Text strong style={{ fontSize: 12 }}>{comp.name}</Text>
                            <Tag color="blue" style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 5px' }}>
                              ×{comp.qtyPerSet || 1}
                            </Tag>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <Divider style={{ margin: '8px 0 16px' }} />

                  {/* Size Breakdown */}
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

        {/* ==================== ORDER SUMMARY ==================== */}
        <Card>
          <Title level={5} style={{ marginBottom: 16 }}>Order Summary</Title>

          {assortmentSummary.length > 0 ? (
            <Table
              dataSource={assortmentSummary}
              rowKey="key"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Buyer PO No',
                  dataIndex: 'buyerPoNo',
                  key: 'buyerPoNo',
                  width: 140,
                  render: (v) => <Text strong>{v}</Text>,
                },
                {
                  title: 'Destination',
                  dataIndex: 'destination',
                  key: 'destination',
                  ellipsis: true,
                },
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
                  width: 110,
                  align: 'right',
                  render: (v) =>
                    `${getCurrencySymbol(formCurrency)} ${v.toFixed(2)}`,
                },
                {
                  title: 'Line Value',
                  dataIndex: 'totalValue',
                  key: 'totalValue',
                  width: 140,
                  align: 'right',
                  render: (v) => (
                    <Text strong style={{ color: 'var(--success-color, #10b981)' }}>
                      {`${getCurrencySymbol(formCurrency)} ${v.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                    </Text>
                  ),
                },
              ]}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row
                    style={{ background: 'var(--bg-secondary, #f8fafc)', fontWeight: 600 }}
                  >
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong>Grand Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2} align="right">
                      <Text strong style={{ fontSize: 15 }}>
                        {totalOrderQty.toLocaleString()}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} align="right">
                      <Text type="secondary">—</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} align="right">
                      <Text
                        strong
                        style={{ color: 'var(--success-color, #10b981)', fontSize: 15 }}
                      >
                        {getCurrencySymbol(formCurrency)}{' '}
                        {totalOrderValue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )}
            />
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '32px 0',
                color: '#bbb',
                fontSize: 13,
              }}
            >
              Add order lines to see summary
            </div>
          )}
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
