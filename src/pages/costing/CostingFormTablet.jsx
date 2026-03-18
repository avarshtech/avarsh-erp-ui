import { useState, useMemo } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Button,
  Card,
  Row,
  Col,
  Space,
  Typography,
  Upload,
  Tabs,
  Popconfirm,
  Tooltip,
  Tag,
  Divider,
  Checkbox,
  Drawer,
  Badge,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  CopyOutlined,
  SaveOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  CalculatorOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  AppstoreOutlined,
  ExperimentOutlined,
  ScissorOutlined,
  ToolOutlined,
  DollarOutlined,
  PieChartOutlined,
  PrinterOutlined,
} from '@ant-design/icons';
import {
  FABRIC_CLASSIFICATIONS,
  CURRENCIES,
  FABRIC_UOMS,
  TRIM_UOMS,
  MAX_FILE_SIZE_MB,
  formatCurrency,
} from '../../utils/costingConstants';
import { getCurrencySymbol } from '../../utils/orderConstants';
import { useTheme } from '../../context/ThemeContext';
import './CostingFormTablet.css';

const { Text, Title } = Typography;
const { Dragger } = Upload;

/**
 * Tablet-optimized CostingForm layout.
 * Receives ALL state and handlers from the parent CostingForm via props
 * so that business logic stays in one place.
 */
const CostingFormTablet = ({
  // Form instance & navigation
  form,
  navigate,
  isEdit,
  loading,
  saving,
  costingId,
  // Currency & rates
  currency,
  setCurrency,
  quoteCurrency,
  setQuoteCurrency,
  actualRate,
  setActualRate,
  todaysRate,
  // Dropdown options
  buyerOptions,
  styleOptions,
  sizeOptions,
  fabricItemOptions,
  localTrimOptions,
  importedTrimOptions,
  effectiveMfgOptions,
  effectiveOvhOptions,
  optionsLoading,
  stylesLoading,
  // Section data
  fabricRows,
  localTrims,
  importedTrims,
  manufacturingRows,
  overheadRows,
  // Row handlers
  addFabricRow,
  updateFabricRow,
  deleteFabricRow,
  duplicateFabricRow,
  handleFabricItemSelect,
  openKnitsModal,
  addLocalTrim,
  updateLocalTrim,
  deleteLocalTrim,
  duplicateLocalTrim,
  addImportedTrim,
  updateImportedTrim,
  deleteImportedTrim,
  duplicateImportedTrim,
  addManufacturingRow,
  updateManufacturingRow,
  deleteManufacturingRow,
  duplicateManufacturingRow,
  addOverheadRow,
  updateOverheadRow,
  deleteOverheadRow,
  duplicateOverheadRow,
  // Buyer & Style
  handleBuyerChange,
  handleStyleChange,
  // Summary
  totalFabricCost,
  totalLocalTrimsCost,
  totalImportedTrimsCostUsd,
  totalAccessoriesCost,
  totalManufacturingCost,
  totalMarkupCost,
  totalMakingPrice,
  totalOverheadCharges,
  totalPrice,
  finalPrice,
  finalPriceUsd,
  agentCommissionPct,
  setAgentCommissionPct,
  profitPct,
  setProfitPct,
  setTargetPrice,
  targetPrice,
  // Per-size
  perSizeSummaries,
  perSizeOverrides,
  setPerSizeOverrides,
  syncPercentages,
  setSyncPercentages,
  // Upload
  uploadProps,
  // Actions
  handleSaveDraft,
  handleSubmit,
  handlePrint,
  printing,
}) => {
  const { isDarkMode } = useTheme();
  const [activeTab, setActiveTab] = useState('general');

  // Section cost counts for badges
  const sectionCounts = useMemo(() => ({
    fabric: fabricRows.length,
    trims: localTrims.length + importedTrims.length,
    manufacturing: manufacturingRows.length,
    overhead: overheadRows.length,
  }), [fabricRows, localTrims, importedTrims, manufacturingRows, overheadRows]);

  // Cost breakdown bar data
  const costSegments = useMemo(() => {
    const total = totalFabricCost + totalAccessoriesCost + totalManufacturingCost + totalMarkupCost;
    if (total === 0) return [];
    return [
      { color: '#0ea5e9', pct: (totalFabricCost / total) * 100, label: 'Fabric' },
      { color: '#8b5cf6', pct: (totalAccessoriesCost / total) * 100, label: 'Trims' },
      { color: '#f59e0b', pct: (totalManufacturingCost / total) * 100, label: 'Mfg' },
      { color: '#ef4444', pct: (totalMarkupCost / total) * 100, label: 'Overhead' },
    ];
  }, [totalFabricCost, totalAccessoriesCost, totalManufacturingCost, totalMarkupCost]);

  const cardBg = isDarkMode ? '#1e293b' : '#fff';
  const subtleBg = isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';

  // ==================== SECTION: General Details ====================
  const renderGeneral = () => (
    <div className="tablet-section-enter-active" style={{ padding: '4px 0' }}>
      <div className="tablet-form-group">
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>Basic Info</Text>
        <Row gutter={[12, 0]}>
          <Col span={12}>
            <Form.Item label="Costing ID" style={{ marginBottom: 12 }}>
              <Input value={costingId} disabled />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Date" name="date" rules={[{ required: true, message: 'Required' }]} style={{ marginBottom: 12 }}>
              <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Buyer" name="buyerId" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
          <Select showSearch optionFilterProp="label" placeholder="Select buyer" options={buyerOptions} loading={optionsLoading} onChange={handleBuyerChange} />
        </Form.Item>
        <Row gutter={[12, 0]}>
          <Col span={12}>
            <Form.Item label="Style #" name="styleNo" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
              <Select showSearch optionFilterProp="label" placeholder="Select style" options={styleOptions} loading={stylesLoading} disabled={!form.getFieldValue('buyerId')} onChange={handleStyleChange} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Garment" name="garmentName" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
              <Input placeholder="Auto-filled" readOnly />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="tablet-form-group">
        <Text type="secondary" style={{ fontSize: 12, marginBottom: 8, display: 'block' }}>Season & Currency</Text>
        <Row gutter={[12, 0]}>
          <Col span={12}>
            <Form.Item label="Season" name="seasonCode" style={{ marginBottom: 12 }}>
              <Select placeholder="Season" allowClear options={[{ value: 'SS', label: 'Spring/Summer' }, { value: 'AW', label: 'Autumn/Winter' }]} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Year" name="seasonYear" style={{ marginBottom: 12 }}>
              <Select placeholder="Year" allowClear options={Array.from({ length: 7 }, (_, i) => { const yr = new Date().getFullYear() - 1 + i; return { value: String(yr), label: String(yr) }; })} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, 0]}>
          <Col span={12}>
            <Form.Item label="Costing Currency" name="currency" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
              <Select options={CURRENCIES} onChange={(v) => setCurrency(v)} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Quote Currency" name="quoteCurrency" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
              <Select options={CURRENCIES} onChange={(v) => setQuoteCurrency(v)} />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={[12, 0]}>
          <Col span={12}>
            <Form.Item label="Actual Rate" style={{ marginBottom: 12 }}>
              <InputNumber value={actualRate} min={0} step={0.01} style={{ width: '100%' }} onChange={setActualRate} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={<Space>Today's Rate <Tooltip title="Auto-fetched"><InfoCircleOutlined /></Tooltip></Space>} style={{ marginBottom: 12 }}>
              <InputNumber value={todaysRate} disabled style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
      </div>

      <div className="tablet-form-group">
        <Form.Item label="Sizes" name="sizes" style={{ marginBottom: 8 }}>
          <Select mode="tags" placeholder="Enter sizes (e.g. S, M, L, XL)" style={{ width: '100%' }} />
        </Form.Item>
      </div>

      <div className="tablet-form-group">
        <Form.Item label="Attachments" style={{ marginBottom: 0 }}>
          <Dragger {...uploadProps} style={{ padding: '20px 0', borderRadius: 12 }}>
            <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
              <InboxOutlined style={{ color: '#6366f1', fontSize: 40 }} />
            </p>
            <p className="ant-upload-text" style={{ fontSize: 14 }}>Tap to upload or drag files</p>
            <p className="ant-upload-hint" style={{ fontSize: 12 }}>JPG, PNG, PDF, DOC, XLS (max {MAX_FILE_SIZE_MB}MB)</p>
          </Dragger>
        </Form.Item>
      </div>
    </div>
  );

  // ==================== ROW CARD RENDERERS ====================

  const renderFabricCard = (row, index) => (
    <div className="tablet-card-item" key={row.key}>
      <Card
        className="tablet-row-card tablet-row-card-fabric"
        size="small"
        style={{ background: cardBg }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>#{index + 1}</Tag>
          <span className="tablet-net-cost-badge" style={{ background: isDarkMode ? 'rgba(14,165,233,0.15)' : 'rgba(14,165,233,0.1)', color: '#0ea5e9' }}>
            {formatCurrency(row.netCost, currency)}
          </span>
        </div>

        <Row gutter={[10, 8]}>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Fabric Type</Text>
            <Select
              value={row.itemId || undefined}
              style={{ width: '100%' }}
              options={fabricItemOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Select"
              onChange={(v, opt) => handleFabricItemSelect(row.key, v, opt)}
            />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Classification</Text>
            <Select value={row.classification} style={{ width: '100%' }} options={FABRIC_CLASSIFICATIONS} onChange={(v) => updateFabricRow(row.key, 'classification', v)} />
          </Col>
          <Col span={24}>
            <Text type="secondary" style={{ fontSize: 11 }}>Description</Text>
            <Input value={row.description} placeholder="Fabric description" onChange={(e) => updateFabricRow(row.key, 'description', e.target.value)} />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Sizes</Text>
            <Select
              mode="multiple"
              value={row.sizes ? row.sizes.split(',').map((s) => s.trim()).filter(Boolean) : []}
              placeholder="All sizes"
              options={sizeOptions}
              onChange={(arr) => updateFabricRow(row.key, 'sizes', arr.join(', '))}
              style={{ width: '100%' }}
              maxTagCount="responsive"
            />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>UOM</Text>
            <Select value={row.uom || 'meters'} style={{ width: '100%' }} options={FABRIC_UOMS} onChange={(v) => updateFabricRow(row.key, 'uom', v)} />
          </Col>
          <Col span={row.classification === 'Knits' ? 8 : 12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Consumption</Text>
            <InputNumber value={row.consumption} min={0} step={0.01} placeholder="Qty" onChange={(v) => updateFabricRow(row.key, 'consumption', v)} style={{ width: '100%' }} />
          </Col>
          {row.classification === 'Knits' && (
            <Col span={4} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
              <Tooltip title="Knits Calculator">
                <Button icon={<CalculatorOutlined />} onClick={() => openKnitsModal(row.key)} type="primary" ghost style={{ width: '100%' }} />
              </Tooltip>
            </Col>
          )}
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Price ({getCurrencySymbol(currency)})</Text>
            <InputNumber value={row.fabricPrice} min={0} step={0.01} placeholder="Price" onChange={(v) => updateFabricRow(row.key, 'fabricPrice', v)} style={{ width: '100%' }} />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Width Std</Text>
            <Input value={row.fabricWidthStd} placeholder='58"' onChange={(e) => updateFabricRow(row.key, 'fabricWidthStd', e.target.value)} />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Width Vendor</Text>
            <Input value={row.fabricWidthVendor} placeholder='58"' onChange={(e) => updateFabricRow(row.key, 'fabricWidthVendor', e.target.value)} />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Allowance %</Text>
            <InputNumber value={row.allowancePct} min={0} max={100} placeholder="%" onChange={(v) => updateFabricRow(row.key, 'allowancePct', v)} style={{ width: '100%' }} />
          </Col>
        </Row>

        <div className="tablet-card-actions">
          <Button icon={<CopyOutlined />} onClick={() => duplicateFabricRow(row.key)}>Duplicate</Button>
          <Popconfirm title="Remove this fabric?" onConfirm={() => deleteFabricRow(row.key)}>
            <Button icon={<DeleteOutlined />} danger>Remove</Button>
          </Popconfirm>
        </div>
      </Card>
    </div>
  );

  const renderLocalTrimCard = (row, index) => (
    <div className="tablet-card-item" key={row.key}>
      <Card className="tablet-row-card tablet-row-card-local-trim" size="small" style={{ background: cardBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Tag color="purple">#{index + 1} Local</Tag>
          <span className="tablet-net-cost-badge" style={{ background: isDarkMode ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.1)', color: '#8b5cf6' }}>
            {formatCurrency(row.price, currency)}
          </span>
        </div>
        <Row gutter={[10, 8]}>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Item</Text>
            <Select
              value={row.itemId || undefined}
              style={{ width: '100%' }}
              options={localTrimOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Select"
              onChange={(v, opt) => { updateLocalTrim(row.key, 'itemId', v); updateLocalTrim(row.key, 'item', opt.label); }}
            />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Sizes</Text>
            <Select
              mode="multiple"
              value={row.sizes ? row.sizes.split(',').map((s) => s.trim()).filter(Boolean) : []}
              placeholder="All"
              options={sizeOptions}
              onChange={(arr) => updateLocalTrim(row.key, 'sizes', arr.join(', '))}
              style={{ width: '100%' }}
              maxTagCount="responsive"
            />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Code</Text>
            <Input value={row.code} placeholder="Code" onChange={(e) => updateLocalTrim(row.key, 'code', e.target.value)} />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Consumption</Text>
            <InputNumber value={row.consumption} min={0} step={0.01} placeholder="Qty" onChange={(v) => updateLocalTrim(row.key, 'consumption', v)} style={{ width: '100%' }} />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>UOM</Text>
            <Select value={row.uom || 'pcs'} style={{ width: '100%' }} options={TRIM_UOMS} onChange={(v) => updateLocalTrim(row.key, 'uom', v)} />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Cost ({getCurrencySymbol(currency)})</Text>
            <InputNumber value={row.cost} min={0} step={0.01} placeholder="Cost" onChange={(v) => updateLocalTrim(row.key, 'cost', v)} style={{ width: '100%' }} />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Size</Text>
            <Input value={row.size} placeholder="Size" onChange={(e) => updateLocalTrim(row.key, 'size', e.target.value)} />
          </Col>
        </Row>
        <div className="tablet-card-actions">
          <Button icon={<CopyOutlined />} onClick={() => duplicateLocalTrim(row.key)}>Duplicate</Button>
          <Popconfirm title="Remove?" onConfirm={() => deleteLocalTrim(row.key)}>
            <Button icon={<DeleteOutlined />} danger>Remove</Button>
          </Popconfirm>
        </div>
      </Card>
    </div>
  );

  const renderImportedTrimCard = (row, index) => (
    <div className="tablet-card-item" key={row.key}>
      <Card className="tablet-row-card tablet-row-card-imported-trim" size="small" style={{ background: cardBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Tag color="geekblue">#{index + 1} Imported</Tag>
          <span className="tablet-net-cost-badge" style={{ background: isDarkMode ? 'rgba(168,85,247,0.15)' : 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
            {formatCurrency(row.priceUsd, 'USD')}
          </span>
        </div>
        <Row gutter={[10, 8]}>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Item</Text>
            <Select
              value={row.itemId || undefined}
              style={{ width: '100%' }}
              options={importedTrimOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Select"
              onChange={(v, opt) => { updateImportedTrim(row.key, 'itemId', v); updateImportedTrim(row.key, 'item', opt.label); }}
            />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Sizes</Text>
            <Select
              mode="multiple"
              value={row.sizes ? row.sizes.split(',').map((s) => s.trim()).filter(Boolean) : []}
              placeholder="All"
              options={sizeOptions}
              onChange={(arr) => updateImportedTrim(row.key, 'sizes', arr.join(', '))}
              style={{ width: '100%' }}
              maxTagCount="responsive"
            />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Code</Text>
            <Input value={row.code} placeholder="Code" onChange={(e) => updateImportedTrim(row.key, 'code', e.target.value)} />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>Consumption</Text>
            <InputNumber value={row.consumption} min={0} step={0.01} placeholder="Qty" onChange={(v) => updateImportedTrim(row.key, 'consumption', v)} style={{ width: '100%' }} />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 11 }}>UOM</Text>
            <Select value={row.uom || 'pcs'} style={{ width: '100%' }} options={TRIM_UOMS} onChange={(v) => updateImportedTrim(row.key, 'uom', v)} />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Cost ($ USD)</Text>
            <InputNumber value={row.costUsd} min={0} step={0.01} placeholder="Cost" onChange={(v) => updateImportedTrim(row.key, 'costUsd', v)} style={{ width: '100%' }} />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>Size</Text>
            <Input value={row.size} placeholder="Size" onChange={(e) => updateImportedTrim(row.key, 'size', e.target.value)} />
          </Col>
        </Row>
        <div className="tablet-card-actions">
          <Button icon={<CopyOutlined />} onClick={() => duplicateImportedTrim(row.key)}>Duplicate</Button>
          <Popconfirm title="Remove?" onConfirm={() => deleteImportedTrim(row.key)}>
            <Button icon={<DeleteOutlined />} danger>Remove</Button>
          </Popconfirm>
        </div>
      </Card>
    </div>
  );

  const renderManufacturingCard = (row, index) => (
    <div className="tablet-card-item" key={row.key}>
      <Card className="tablet-row-card tablet-row-card-manufacturing" size="small" style={{ background: cardBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Tag color="orange">#{index + 1}</Tag>
          <span className="tablet-net-cost-badge" style={{ background: isDarkMode ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
            {formatCurrency(row.cost, currency)}
          </span>
        </div>
        <Row gutter={[10, 8]}>
          <Col span={14}>
            <Text type="secondary" style={{ fontSize: 11 }}>Process</Text>
            <Select
              value={row.itemId || undefined}
              style={{ width: '100%' }}
              options={effectiveMfgOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Select process"
              onChange={(v, opt) => { updateManufacturingRow(row.key, 'itemId', v); updateManufacturingRow(row.key, 'process', opt.label); }}
            />
          </Col>
          <Col span={10}>
            <Text type="secondary" style={{ fontSize: 11 }}>Sizes</Text>
            <Select
              mode="multiple"
              value={row.sizes ? row.sizes.split(',').map((s) => s.trim()).filter(Boolean) : []}
              placeholder="All"
              options={sizeOptions}
              onChange={(arr) => updateManufacturingRow(row.key, 'sizes', arr.join(', '))}
              style={{ width: '100%' }}
              maxTagCount="responsive"
            />
          </Col>
          <Col span={10}>
            <Text type="secondary" style={{ fontSize: 11 }}>Cost ({getCurrencySymbol(currency)})</Text>
            <InputNumber value={row.cost} min={0} step={0.01} placeholder="Cost" onChange={(v) => updateManufacturingRow(row.key, 'cost', v)} style={{ width: '100%' }} />
          </Col>
          <Col span={14}>
            <Text type="secondary" style={{ fontSize: 11 }}>Comments</Text>
            <Input value={row.comments} placeholder="Notes" onChange={(e) => updateManufacturingRow(row.key, 'comments', e.target.value)} />
          </Col>
        </Row>
        <div className="tablet-card-actions">
          <Button icon={<CopyOutlined />} onClick={() => duplicateManufacturingRow(row.key)}>Duplicate</Button>
          <Popconfirm title="Remove?" onConfirm={() => deleteManufacturingRow(row.key)}>
            <Button icon={<DeleteOutlined />} danger>Remove</Button>
          </Popconfirm>
        </div>
      </Card>
    </div>
  );

  const renderOverheadCard = (row, index) => (
    <div className="tablet-card-item" key={row.key}>
      <Card className="tablet-row-card tablet-row-card-overhead" size="small" style={{ background: cardBg }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Tag color="red">#{index + 1}</Tag>
          <span className="tablet-net-cost-badge" style={{ background: isDarkMode ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {formatCurrency(row.cost, currency)}
          </span>
        </div>
        <Row gutter={[10, 8]}>
          <Col span={14}>
            <Text type="secondary" style={{ fontSize: 11 }}>Description</Text>
            <Select
              value={row.itemId || undefined}
              style={{ width: '100%' }}
              options={effectiveOvhOptions}
              showSearch
              optionFilterProp="label"
              placeholder="Select category"
              onChange={(v, opt) => { updateOverheadRow(row.key, 'itemId', v); updateOverheadRow(row.key, 'description', opt.label); }}
            />
          </Col>
          <Col span={10}>
            <Text type="secondary" style={{ fontSize: 11 }}>Sizes</Text>
            <Select
              mode="multiple"
              value={row.sizes ? row.sizes.split(',').map((s) => s.trim()).filter(Boolean) : []}
              placeholder="All"
              options={sizeOptions}
              onChange={(arr) => updateOverheadRow(row.key, 'sizes', arr.join(', '))}
              style={{ width: '100%' }}
              maxTagCount="responsive"
            />
          </Col>
          <Col span={10}>
            <Text type="secondary" style={{ fontSize: 11 }}>Cost ({getCurrencySymbol(currency)})</Text>
            <InputNumber value={row.cost} min={0} step={0.01} placeholder="Cost" onChange={(v) => updateOverheadRow(row.key, 'cost', v)} style={{ width: '100%' }} />
          </Col>
          <Col span={14}>
            <Text type="secondary" style={{ fontSize: 11 }}>Comments</Text>
            <Input value={row.comments} placeholder="Notes" onChange={(e) => updateOverheadRow(row.key, 'comments', e.target.value)} />
          </Col>
        </Row>
        <div className="tablet-card-actions">
          <Button icon={<CopyOutlined />} onClick={() => duplicateOverheadRow(row.key)}>Duplicate</Button>
          <Popconfirm title="Remove?" onConfirm={() => deleteOverheadRow(row.key)}>
            <Button icon={<DeleteOutlined />} danger>Remove</Button>
          </Popconfirm>
        </div>
      </Card>
    </div>
  );

  // ==================== SECTION: Fabric ====================
  const renderFabric = () => (
    <div className="tablet-section-enter-active" style={{ padding: '4px 0' }}>
      {/* Section total banner */}
      <Card size="small" style={{ marginBottom: 12, background: isDarkMode ? 'rgba(14,165,233,0.08)' : 'rgba(14,165,233,0.04)', borderColor: '#0ea5e9', borderRadius: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Fabric Cost Total</Text>
          <Text strong style={{ color: '#0ea5e9', fontSize: 18 }}>{formatCurrency(totalFabricCost, currency)}</Text>
        </div>
      </Card>

      {fabricRows.length === 0 ? (
        <div className="tablet-empty-state">
          <ExperimentOutlined />
          <div><Text type="secondary">No fabrics added yet</Text></div>
          <div><Text type="secondary" style={{ fontSize: 12 }}>Tap the button below to add your first fabric</Text></div>
        </div>
      ) : (
        fabricRows.map((row, i) => renderFabricCard(row, i))
      )}

      <div className="tablet-fab-button">
        <Button type="primary" icon={<PlusOutlined />} onClick={addFabricRow} style={{ background: '#0ea5e9', borderColor: '#0ea5e9' }}>
          Add Fabric
        </Button>
      </div>
    </div>
  );

  // ==================== SECTION: Trims ====================
  const renderTrims = () => (
    <div className="tablet-section-enter-active" style={{ padding: '4px 0' }}>
      {/* Total accessories banner */}
      <Card size="small" style={{ marginBottom: 12, background: isDarkMode ? 'rgba(139,92,246,0.08)' : 'rgba(139,92,246,0.04)', borderColor: '#8b5cf6', borderRadius: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Text strong>Total Accessories</Text>
            <div style={{ fontSize: 11, color: '#64748b' }}>
              Local: {formatCurrency(totalLocalTrimsCost, currency)} + Imported: {formatCurrency(totalImportedTrimsCostUsd, 'USD')} x {actualRate}
            </div>
          </div>
          <Text strong style={{ color: '#8b5cf6', fontSize: 18 }}>{formatCurrency(totalAccessoriesCost, currency)}</Text>
        </div>
      </Card>

      {/* Local Trims */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text strong style={{ fontSize: 14, color: '#8b5cf6' }}>Local Accessories</Text>
          <Tag color="purple">{localTrims.length} items</Tag>
        </div>
        {localTrims.length === 0 ? (
          <div className="tablet-empty-state" style={{ padding: 20 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>No local accessories</Text>
          </div>
        ) : (
          localTrims.map((row, i) => renderLocalTrimCard(row, i))
        )}
        <div className="tablet-fab-button" style={{ bottom: 'auto' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={addLocalTrim} style={{ background: '#8b5cf6', borderColor: '#8b5cf6' }}>
            Add Local Item
          </Button>
        </div>
      </div>

      <Divider />

      {/* Imported Trims */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text strong style={{ fontSize: 14, color: '#a855f7' }}>Imported Accessories</Text>
          <Tag color="geekblue">{importedTrims.length} items</Tag>
        </div>
        {importedTrims.length === 0 ? (
          <div className="tablet-empty-state" style={{ padding: 20 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>No imported accessories</Text>
          </div>
        ) : (
          importedTrims.map((row, i) => renderImportedTrimCard(row, i))
        )}
        <div className="tablet-fab-button" style={{ bottom: 'auto' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={addImportedTrim} style={{ background: '#a855f7', borderColor: '#a855f7' }}>
            Add Imported Item
          </Button>
        </div>
      </div>
    </div>
  );

  // ==================== SECTION: Manufacturing ====================
  const renderManufacturing = () => (
    <div className="tablet-section-enter-active" style={{ padding: '4px 0' }}>
      <Card size="small" style={{ marginBottom: 12, background: isDarkMode ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.04)', borderColor: '#f59e0b', borderRadius: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Manufacturing Total</Text>
          <Text strong style={{ color: '#f59e0b', fontSize: 18 }}>{formatCurrency(totalManufacturingCost, currency)}</Text>
        </div>
      </Card>

      {manufacturingRows.length === 0 ? (
        <div className="tablet-empty-state">
          <ToolOutlined />
          <div><Text type="secondary">No manufacturing processes added</Text></div>
        </div>
      ) : (
        manufacturingRows.map((row, i) => renderManufacturingCard(row, i))
      )}

      <div className="tablet-fab-button">
        <Button type="primary" icon={<PlusOutlined />} onClick={addManufacturingRow} style={{ background: '#f59e0b', borderColor: '#f59e0b' }}>
          Add Process
        </Button>
      </div>
    </div>
  );

  // ==================== SECTION: Overhead ====================
  const renderOverhead = () => (
    <div className="tablet-section-enter-active" style={{ padding: '4px 0' }}>
      <Card size="small" style={{ marginBottom: 12, background: isDarkMode ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)', borderColor: '#ef4444', borderRadius: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text strong>Overhead / Markup Total</Text>
          <Text strong style={{ color: '#ef4444', fontSize: 18 }}>{formatCurrency(totalMarkupCost, currency)}</Text>
        </div>
      </Card>

      {overheadRows.length === 0 ? (
        <div className="tablet-empty-state">
          <DollarOutlined />
          <div><Text type="secondary">No overhead costs added</Text></div>
        </div>
      ) : (
        overheadRows.map((row, i) => renderOverheadCard(row, i))
      )}

      <div className="tablet-fab-button">
        <Button type="primary" icon={<PlusOutlined />} onClick={addOverheadRow} style={{ background: '#ef4444', borderColor: '#ef4444' }}>
          Add Overhead
        </Button>
      </div>
    </div>
  );

  // ==================== SECTION: Summary ====================
  const renderSummary = () => (
    <div className="tablet-section-enter-active" style={{ padding: '4px 0' }}>
      {/* Cost breakdown bar */}
      {costSegments.length > 0 && (
        <Card size="small" style={{ marginBottom: 12, borderRadius: 14 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Cost Distribution</Text>
          <div className="tablet-cost-bar">
            {costSegments.map((seg) => (
              <div key={seg.label} className="tablet-cost-bar-segment" style={{ width: `${seg.pct}%`, background: seg.color }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
            {costSegments.map((seg) => (
              <Text key={seg.label} style={{ fontSize: 11, color: seg.color }}>
                {seg.label} {seg.pct.toFixed(0)}%
              </Text>
            ))}
          </div>
        </Card>
      )}

      {/* Individual cost cards - horizontal scroll */}
      <div className="tablet-scroll-snap" style={{ marginBottom: 12 }}>
        {[
          { title: 'Fabric', value: totalFabricCost, color: '#0ea5e9' },
          { title: 'Trims', value: totalAccessoriesCost, color: '#8b5cf6' },
          { title: 'Manufacturing', value: totalManufacturingCost, color: '#f59e0b' },
          { title: 'Overhead', value: totalMarkupCost, color: '#ef4444' },
        ].map((item) => (
          <Card key={item.title} className="tablet-summary-card" size="small" style={{ width: 160, borderColor: item.color }}>
            <Statistic
              title={item.title}
              value={item.value}
              precision={2}
              prefix={getCurrencySymbol(currency)}
              valueStyle={{ fontSize: 16, color: item.color, fontWeight: 700 }}
            />
          </Card>
        ))}
      </div>

      <Divider style={{ margin: '12px 0' }} />

      {/* Making Price */}
      <Card size="small" style={{ marginBottom: 12, borderRadius: 14, background: subtleBg }}>
        <Statistic
          title="Total Making Price"
          value={totalMakingPrice}
          precision={2}
          prefix={getCurrencySymbol(currency)}
          valueStyle={{ fontSize: 22, fontWeight: 700 }}
        />
      </Card>

      {/* Agent, Profit, Target */}
      <div className="tablet-form-group">
        <Row gutter={[12, 12]}>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Agent Commission</Text>
            <InputNumber
              value={agentCommissionPct}
              min={0} max={100} step={0.5}
              onChange={setAgentCommissionPct}
              style={{ width: '100%' }}
              addonAfter="%"
            />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Profit</Text>
            <InputNumber
              value={profitPct}
              min={0} max={100} step={0.5}
              onChange={(v) => { setProfitPct(v); setTargetPrice(''); }}
              style={{ width: '100%' }}
              addonAfter="%"
            />
          </Col>
          <Col span={8}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Target ({getCurrencySymbol(currency)})</Text>
            <InputNumber
              value={targetPrice}
              min={0} step={0.01}
              placeholder="Auto-calc"
              onChange={setTargetPrice}
              style={{ width: '100%' }}
            />
          </Col>
        </Row>
      </div>

      <Card size="small" style={{ marginBottom: 12, borderRadius: 14, background: subtleBg }}>
        <Statistic
          title="Overhead Charges"
          value={totalOverheadCharges}
          precision={2}
          prefix={getCurrencySymbol(currency)}
          valueStyle={{ fontSize: 16, color: '#64748b' }}
        />
      </Card>

      <Divider style={{ margin: '12px 0' }} />

      {/* Final Price Hero Cards */}
      <Row gutter={[12, 12]}>
        <Col span={quoteCurrency !== currency && quoteCurrency !== 'USD' ? 8 : 12}>
          <Card className="tablet-price-hero" size="small" style={{ textAlign: 'center', borderColor: '#6366f1' }}>
            <Text style={{ color: '#6366f1', fontSize: 12, display: 'block' }}>Total ({currency})</Text>
            <div className="price-value" style={{ color: '#6366f1' }}>
              {getCurrencySymbol(currency)} {totalPrice.toFixed(2)}
            </div>
          </Card>
        </Col>
        {quoteCurrency !== currency && quoteCurrency !== 'USD' && (
          <Col span={8}>
            <Card className="tablet-price-hero" size="small" style={{ textAlign: 'center', borderColor: '#10b981' }}>
              <Text style={{ color: '#10b981', fontSize: 12, display: 'block' }}>Final ({quoteCurrency})</Text>
              <div className="price-value" style={{ color: '#10b981', fontSize: 28 }}>
                {getCurrencySymbol(quoteCurrency)} {finalPrice.toFixed(2)}
              </div>
            </Card>
          </Col>
        )}
        <Col span={quoteCurrency !== currency && quoteCurrency !== 'USD' ? 8 : 12}>
          <Card className="tablet-price-hero" size="small" style={{ textAlign: 'center', borderColor: '#3b82f6' }}>
            <Text style={{ color: '#3b82f6', fontSize: 12, display: 'block' }}>Final (USD)</Text>
            <div className="price-value" style={{ color: '#3b82f6' }}>
              $ {finalPriceUsd.toFixed(2)}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Per-Size Breakdown */}
      {perSizeSummaries.length > 0 && (
        <>
          <Divider style={{ margin: '16px 0' }} />
          <div style={{ marginBottom: 10 }}>
            <Text strong style={{ fontSize: 15, marginRight: 12 }}>Per-Size Breakdown</Text>
            <Checkbox checked={syncPercentages} onChange={(e) => setSyncPercentages(e.target.checked)}>
              Same % all sizes
            </Checkbox>
          </div>
          <div className="tablet-scroll-snap">
            {perSizeSummaries.map((ps) => (
              <Card key={ps.sizeKey} size="small" style={{ width: 200, borderColor: '#10b981', borderRadius: 14, flexShrink: 0 }}>
                <Tag color="blue" style={{ marginBottom: 6 }}>{ps.sizeKey}</Tag>
                <div style={{ fontSize: 12, lineHeight: '20px' }}>
                  <div>Fabric: {formatCurrency(ps.fabCost, currency)}</div>
                  <div>Acc: {formatCurrency(ps.accCost, currency)}</div>
                  <div>Mfg: {formatCurrency(ps.mfgCost, currency)}</div>
                  <div>Markup: {formatCurrency(ps.ovhCost, currency)}</div>
                  <Divider style={{ margin: '4px 0' }} />
                  <Text strong style={{ fontSize: 12 }}>Making: {formatCurrency(ps.makingPrice, currency)}</Text>
                </div>
                {!syncPercentages && (
                  <div style={{ marginTop: 8 }}>
                    <Row gutter={[6, 4]}>
                      <Col span={12}>
                        <Text type="secondary" style={{ fontSize: 10 }}>Agent %</Text>
                        <InputNumber
                          value={perSizeOverrides[ps.sizeKey]?.agentCommissionPct ?? agentCommissionPct}
                          min={0} max={100} step={0.5} size="small" style={{ width: '100%' }}
                          onChange={(v) => setPerSizeOverrides((prev) => ({ ...prev, [ps.sizeKey]: { ...prev[ps.sizeKey], agentCommissionPct: v } }))}
                        />
                      </Col>
                      <Col span={12}>
                        <Text type="secondary" style={{ fontSize: 10 }}>Profit %</Text>
                        <InputNumber
                          value={perSizeOverrides[ps.sizeKey]?.profitPct ?? profitPct}
                          min={0} max={100} step={0.5} size="small" style={{ width: '100%' }}
                          onChange={(v) => setPerSizeOverrides((prev) => ({ ...prev, [ps.sizeKey]: { ...prev[ps.sizeKey], profitPct: v } }))}
                        />
                      </Col>
                    </Row>
                    <Text type="secondary" style={{ fontSize: 10 }}>Target</Text>
                    <InputNumber
                      value={perSizeOverrides[ps.sizeKey]?.targetPrice ?? ''}
                      min={0} step={0.01} size="small" style={{ width: '100%' }}
                      placeholder="Target"
                      onChange={(v) => setPerSizeOverrides((prev) => ({ ...prev, [ps.sizeKey]: { ...prev[ps.sizeKey], targetPrice: v } }))}
                    />
                  </div>
                )}
                <Divider style={{ margin: '6px 0' }} />
                <div style={{ textAlign: 'center' }}>
                  <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: 700 }}>$ {ps.finalPriceUsd.toFixed(2)}</Text>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{getCurrencySymbol(currency)} {ps.totalPrice.toFixed(2)}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // ==================== TAB DEFINITIONS ====================
  const tabItems = [
    {
      key: 'general',
      label: (
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <AppstoreOutlined style={{ fontSize: 18 }} />
          <span style={{ fontSize: 11 }}>General</span>
        </span>
      ),
      children: renderGeneral(),
    },
    {
      key: 'fabric',
      label: (
        <Badge count={sectionCounts.fabric} size="small" offset={[6, -4]}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <ExperimentOutlined style={{ fontSize: 18, color: '#0ea5e9' }} />
            <span style={{ fontSize: 11 }}>Fabric</span>
          </span>
        </Badge>
      ),
      children: renderFabric(),
    },
    {
      key: 'trims',
      label: (
        <Badge count={sectionCounts.trims} size="small" offset={[6, -4]}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <ScissorOutlined style={{ fontSize: 18, color: '#8b5cf6' }} />
            <span style={{ fontSize: 11 }}>Trims</span>
          </span>
        </Badge>
      ),
      children: renderTrims(),
    },
    {
      key: 'manufacturing',
      label: (
        <Badge count={sectionCounts.manufacturing} size="small" offset={[6, -4]}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <ToolOutlined style={{ fontSize: 18, color: '#f59e0b' }} />
            <span style={{ fontSize: 11 }}>Making</span>
          </span>
        </Badge>
      ),
      children: renderManufacturing(),
    },
    {
      key: 'overhead',
      label: (
        <Badge count={sectionCounts.overhead} size="small" offset={[6, -4]}>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <DollarOutlined style={{ fontSize: 18, color: '#ef4444' }} />
            <span style={{ fontSize: 11 }}>Overhead</span>
          </span>
        </Badge>
      ),
      children: renderOverhead(),
    },
    {
      key: 'summary',
      label: (
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <PieChartOutlined style={{ fontSize: 18, color: '#10b981' }} />
          <span style={{ fontSize: 11 }}>Summary</span>
        </span>
      ),
      children: renderSummary(),
    },
  ];

  return (
    <div className="tablet-costing-form animate-fade-in-up" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', position: 'sticky', top: 0, zIndex: 20, background: isDarkMode ? '#0f172a' : '#f8fafc', backdropFilter: 'blur(12px)' }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/costing/list')} type="text" />
        <div style={{ flex: 1 }}>
          <Title level={5} style={{ margin: 0, fontSize: 16 }}>
            {isEdit ? 'Edit Cost Sheet' : 'New Cost Sheet'}
          </Title>
        </div>
        {costingId && <Tag color="blue" style={{ fontSize: 12 }}>{costingId}</Tag>}
      </div>

      {/* Quick summary strip */}
      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8 }}>
        <Tag color="processing" style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 12, borderRadius: 8 }}>
          Making: {formatCurrency(totalMakingPrice, currency)}
        </Tag>
        <Tag color="success" style={{ flex: 1, textAlign: 'center', padding: '4px 0', fontSize: 12, borderRadius: 8 }}>
          Final: $ {finalPriceUsd.toFixed(2)}
        </Tag>
      </div>

      {/* Main tabbed content */}
      <div style={{ padding: '0 12px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          className="tablet-costing-tabs"
          centered
          size="small"
          animated={{ inkBar: true, tabPane: true }}
        />
      </div>

      {/* Sticky bottom bar */}
      <div className="tablet-sticky-footer" style={{ background: isDarkMode ? 'rgba(30,41,59,0.95)' : 'rgba(255,255,255,0.95)' }}>
        <div className="footer-price" style={{ color: '#3b82f6' }}>
          $ {finalPriceUsd.toFixed(2)}
        </div>
        <Button onClick={() => navigate('/costing/list')} disabled={saving}>
          Cancel
        </Button>
        <Button icon={<PrinterOutlined />} onClick={handlePrint} loading={printing} disabled={saving}>
          Print
        </Button>
        <Button icon={<SaveOutlined />} onClick={handleSaveDraft} loading={saving}>
          Draft
        </Button>
        <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} loading={saving}>
          Submit
        </Button>
      </div>
    </div>
  );
};

export default CostingFormTablet;
