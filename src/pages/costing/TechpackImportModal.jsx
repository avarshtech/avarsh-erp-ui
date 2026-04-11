/**
 * TechpackImportModal
 *
 * Upload → AI Extract → Review & Create Missing Masters → Apply to Form
 *
 * Unmatched records can be created DIRECTLY here without leaving the screen:
 *   • Buyer    → inline expandable form (name, contactPerson, email pre-filled)
 *   • Style    → inline expandable form (all fields pre-filled from extraction)
 *   • Items    → per-row "Create Item" button → QuickCreateItemModal sub-modal
 *
 * After creating, the record is auto-linked in the review modal instantly.
 */
import { useState, useEffect } from 'react';
import {
  App, Modal, Upload, Button, Spin, Alert, Tag, Select, Divider,
  Row, Col, Typography, Space, Table, Form, Input, Card,
} from 'antd';
import {
  CheckCircleFilled, WarningFilled, FileTextOutlined,
  ImportOutlined, PlusOutlined,
} from '@ant-design/icons';
import { extractTechpackForCosting } from '../../services/costing/costingService';
import { searchItems, getItemMetaData, createItem } from '../../services/master/itemService';
import { createBuyer, getBuyers } from '../../services/master/buyerService';
import { saveStyle } from '../../services/master/styleService';
import { SEASON_CODES, SEASON_YEARS } from '../../utils/costingConstants';

const { Dragger } = Upload;
const { Text, Title } = Typography;

// ── helpers ───────────────────────────────────────────────────────────────────

const MatchTag = ({ matched }) =>
  matched
    ? <Tag icon={<CheckCircleFilled />} color="success" style={{ fontSize: 11 }}>Matched</Tag>
    : <Tag icon={<WarningFilled />}     color="warning" style={{ fontSize: 11 }}>Not in master</Tag>;

/** Category keyword by row type — used to auto-select category in item create */
const ROW_TYPE_CATEGORY = {
  FABRIC:        'fabric',
  LOCAL_TRIM:    'local trim',
  IMPORTED_TRIM: 'imported trim',
  MANUFACTURING: 'manufactur',
};

// ── ItemSearchSelect ──────────────────────────────────────────────────────────

function ItemSearchSelect({ value, onChange }) {
  const [options, setOptions]   = useState([]);
  const [fetching, setFetching] = useState(false);

  const handleSearch = async (q) => {
    if (!q || q.length < 2) { setOptions([]); return; }
    setFetching(true);
    try {
      const res   = await searchItems({ search: q, size: 10 });
      const items = res.data?.content || res.data || [];
      setOptions(items.map((i) => ({ value: i.id, label: i.itemName, categoryName: i.categoryName })));
    } catch { setOptions([]); }
    finally  { setFetching(false); }
  };

  return (
    <Select
      showSearch allowClear
      value={value}
      onChange={onChange}
      onSearch={handleSearch}
      filterOption={false}
      notFoundContent={fetching ? <Spin size="small" /> : 'No results — use Create Item below'}
      placeholder="Search existing items…"
      style={{ width: '100%' }}
      options={options}
      optionRender={(opt) => (
        <Space direction="vertical" size={0}>
          <Text>{opt.label}</Text>
          {opt.data.categoryName && (
            <Text type="secondary" style={{ fontSize: 11 }}>{opt.data.categoryName}</Text>
          )}
        </Space>
      )}
    />
  );
}

// ── QuickCreateItemModal ──────────────────────────────────────────────────────

function QuickCreateItemModal({ open, onClose, onCreated, extractedRow }) {
  const [form]         = Form.useForm();
  const [meta, setMeta]       = useState([]);
  const [subs, setSubs]       = useState([]);
  const [types, setTypes]     = useState([]);
  const [uoms, setUoms]       = useState([]);
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    if (!open) return;
    getItemMetaData()
      .then((res) => {
        const data = res.data || res || [];
        setMeta(data);

        // Auto-detect category from row type
        const keyword = ROW_TYPE_CATEGORY[extractedRow?.rowType] || '';
        const cat = data.find((c) => c.name?.toLowerCase().includes(keyword));
        if (cat) {
          form.setFieldValue('categoryId', String(cat.id));
          applyCategoryChange(String(cat.id), data);
        }
      })
      .catch(() => {});

    form.setFieldsValue({ itemName: extractedRow?.extractedName || '', isActive: true });
  }, [open, extractedRow]);

  const applyCategoryChange = (catId, source = meta) => {
    const cat = source.find((c) => String(c.id) === String(catId));
    setSubs(cat?.subCategories || []);
    setTypes([]);
    setUoms([]);
    form.setFieldsValue({ subCategoryId: undefined, itemTypeId: undefined, uomId: undefined });
  };

  const applySubcategoryChange = (subId) => {
    const sub = subs.find((s) => String(s.id) === String(subId));
    setTypes(sub?.itemTypes || []);
    setUoms([]);
    form.setFieldsValue({ itemTypeId: undefined, uomId: undefined });
  };

  const applyItemTypeChange = (typeId) => {
    const type = types.find((t) => String(t.id) === String(typeId));
    setUoms(type?.uoms || []);
    form.setFieldValue('uomId', undefined);
  };

  const handleSave = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);
      const res     = await createItem({
        itemName:      v.itemName,
        categoryId:    parseInt(v.categoryId),
        subCategoryId: parseInt(v.subCategoryId),
        itemTypeId:    parseInt(v.itemTypeId),
        uomId:         parseInt(v.uomId),
        hsnCode:       v.hsnCode || '',
        isActive:      true,
        variants:      [],
      });
      const created = res.data || res;
      message.success(`Item "${created.itemName}" created`);
      onCreated({ id: created.id, name: created.itemName });
      form.resetFields();
    } catch (err) {
      if (!err?.errorFields) message.error(err?.errorMessage || 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      afterClose={() => form.resetFields()}
      title={<Space><PlusOutlined /> Quick Create Item</Space>}
      width={540}
      centered
      onOk={handleSave}
      okText="Create Item"
      okButtonProps={{ loading: saving }}
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
    >
      <Alert
        type="info" showIcon
        style={{ marginBottom: 16, fontSize: 12 }}
        message={`Creating item for: "${extractedRow?.extractedName}"`}
      />
      <Form form={form} layout="vertical" size="small">
        <Form.Item name="itemName" label="Item Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}>
              <Select
                placeholder="Category" showSearch optionFilterProp="label"
                options={meta.map((c) => ({ value: String(c.id), label: c.name }))}
                onChange={(v) => applyCategoryChange(v)}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="subCategoryId" label="Subcategory" rules={[{ required: true }]}>
              <Select
                placeholder="Subcategory" showSearch optionFilterProp="label"
                disabled={subs.length === 0}
                options={subs.map((s) => ({ value: String(s.id), label: s.name }))}
                onChange={applySubcategoryChange}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="itemTypeId" label="Item Type" rules={[{ required: true }]}>
              <Select
                placeholder="Item Type" showSearch optionFilterProp="label"
                disabled={types.length === 0}
                options={types.map((t) => ({ value: String(t.id), label: t.name }))}
                onChange={applyItemTypeChange}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="uomId" label="Unit of Measure" rules={[{ required: true }]}>
              <Select
                placeholder="UOM"
                disabled={uoms.length === 0}
                options={uoms.map((u) => ({ value: String(u.id), label: u.symbol || u.name }))}
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="hsnCode" label="HSN Code">
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}

// ── RowsSection ───────────────────────────────────────────────────────────────

function RowsSection({ title, rows, overrides, onOverride, onCreateItem }) {
  if (!rows?.length) return null;

  const columns = [
    {
      title: 'Extracted from Techpack',
      dataIndex: 'extractedName',
      render: (name, row) => (
        <Space direction="vertical" size={2}>
          <Text strong style={{ fontSize: 13 }}>{name}</Text>
          {row.notes    && <Text type="secondary" style={{ fontSize: 11 }}>{row.notes}</Text>}
          {row.quantity && <Text type="secondary" style={{ fontSize: 11 }}>Qty: {row.quantity} {row.uom || ''}</Text>}
        </Space>
      ),
    },
    {
      title: 'Linked Master Item',
      width: 310,
      render: (_, row) => {
        const ov            = overrides[row._idx];
        const effectiveId   = ov?.itemId   ?? row.matchedItemId;
        const effectiveName = ov?.itemName ?? row.matchedItemName;
        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space size={4}>
              <MatchTag matched={!!effectiveId} />
              {effectiveName && <Text style={{ fontSize: 12 }}>{effectiveName}</Text>}
            </Space>
            <ItemSearchSelect
              value={effectiveId || undefined}
              onChange={(id, opt) => onOverride(row._idx, id, opt?.label)}
            />
            {!effectiveId && (
              <Button size="small" type="dashed" icon={<PlusOutlined />}
                onClick={() => onCreateItem(row, row._idx)}>
                Create Item
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <Text strong style={{ fontSize: 13 }}>{title} ({rows.length})</Text>
      <Table
        size="small" pagination={false}
        columns={columns}
        dataSource={rows.map((r, i) => ({ ...r, _idx: i, key: i }))}
        style={{ marginTop: 6 }}
      />
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function TechpackImportModal({ open, onClose, onApply }) {
  const { message } = App.useApp();
  const [step, setStep]       = useState('upload');
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(null);

  // Buyer quick-create
  const [buyerForm]            = Form.useForm();
  const [buyerCreateOpen, setBuyerCreateOpen] = useState(false);
  const [savingBuyer, setSavingBuyer]         = useState(false);
  const [allBuyers, setAllBuyers]             = useState([]);
  const [matchedBuyer, setMatchedBuyer]       = useState({ id: null, name: null });

  // Style quick-create
  const [styleForm]            = Form.useForm();
  const [styleCreateOpen, setStyleCreateOpen] = useState(false);
  const [savingStyle, setSavingStyle]         = useState(false);
  const [matchedStyle, setMatchedStyle]       = useState({ id: null });

  // Item quick-create
  const [itemCreate, setItemCreate] = useState({ open: false, row: null, section: null, idx: null });

  // Per-row item overrides: section → { rowIdx → { itemId, itemName } }
  const [overrides, setOverrides] = useState({ fabric: {}, localTrim: {}, importedTrim: {}, manufacturing: {} });

  // Load buyers when modal opens (needed for Style form buyer dropdown)
  useEffect(() => {
    if (open) getBuyers().then((b) => setAllBuyers(b || [])).catch(() => {});
  }, [open]);

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleFile = async (file) => {
    if (file.type !== 'application/pdf') {
      message.error('Only PDF techpack files are supported');
      return false;
    }
    setLoading(true);
    try {
      const result = await extractTechpackForCosting(file);
      setExtracted(result);
      setOverrides({ fabric: {}, localTrim: {}, importedTrim: {}, manufacturing: {} });
      setMatchedBuyer({ id: result.matchedBuyerId, name: result.matchedBuyerName });
      setMatchedStyle({ id: result.matchedStyleId });

      // Pre-fill quick-create forms with extracted data
      buyerForm.setFieldsValue({ name: result.buyerName });
      styleForm.setFieldsValue({
        styleNo:     result.styleNo,
        garmentName: result.garmentName,
        seasonCode:  result.seasonCode,
        seasonYear:  result.seasonYear,
        isActive:    true,
      });

      setStep('review');
    } catch {
      message.error('AI extraction failed. Please try again.');
    } finally {
      setLoading(false);
    }
    return false;
  };

  // ── Quick Create: Buyer ───────────────────────────────────────────────────

  const handleSaveBuyer = async () => {
    try {
      const v = await buyerForm.validateFields();
      setSavingBuyer(true);
      const res    = await createBuyer({ ...v, shippingLocations: [] });
      const buyer  = res?.data || res;
      setMatchedBuyer({ id: buyer.id, name: buyer.name });
      setAllBuyers((prev) => [...prev, buyer]);
      // Auto-set buyer in the style form too
      styleForm.setFieldValue('buyerId', buyer.id);
      setBuyerCreateOpen(false);
      message.success(`Buyer "${buyer.name}" created — add shipping details in Buyer Master later`);
    } catch (err) {
      if (!err?.errorFields) message.error(err?.errorMessage || 'Failed to create buyer');
    } finally {
      setSavingBuyer(false);
    }
  };

  // ── Quick Create: Style ───────────────────────────────────────────────────

  const handleSaveStyle = async () => {
    try {
      const v     = await styleForm.validateFields();
      setSavingStyle(true);
      const saved = await saveStyle({ ...v, isActive: true });
      setMatchedStyle({ id: saved.id });
      setStyleCreateOpen(false);
      message.success(`Style "${saved.styleNo}" created and linked`);
    } catch (err) {
      if (!err?.errorFields) message.error(err?.errorMessage || 'Failed to create style');
    } finally {
      setSavingStyle(false);
    }
  };

  // ── Quick Create: Item (callback from sub-modal) ───────────────────────────

  const handleItemCreated = ({ id, name }) => {
    const { section, idx } = itemCreate;
    setOverrides((prev) => ({
      ...prev,
      [section]: { ...prev[section], [idx]: { itemId: id, itemName: name } },
    }));
    setItemCreate({ open: false, row: null, section: null, idx: null });
  };

  const setRowOverride = (section) => (idx, itemId, itemName) => {
    setOverrides((prev) => ({ ...prev, [section]: { ...prev[section], [idx]: { itemId, itemName } } }));
  };

  // ── Apply to Form ─────────────────────────────────────────────────────────

  const handleApply = () => {
    const resolveRow = (row, idx, sectionKey) => {
      const ov = overrides[sectionKey]?.[idx];
      return {
        matchedItemId:   ov?.itemId   ?? row.matchedItemId   ?? null,
        matchedItemName: ov?.itemName ?? row.matchedItemName ?? null,
        extractedName:   row.extractedName,
        classification:  row.classification,
        quantity:        row.quantity,
        uom:             row.uom,
        notes:           row.notes,
      };
    };

    onApply({
      styleNo:          extracted.styleNo,
      garmentName:      extracted.garmentName,
      seasonCode:       extracted.seasonCode,
      seasonYear:       extracted.seasonYear,
      sizes:            extracted.sizes || [],
      matchedBuyerId:   matchedBuyer.id,
      matchedBuyerName: matchedBuyer.name,
      matchedStyleId:   matchedStyle.id,
      colorReferences:  extracted.colorReferences,
      fabricRows:        (extracted.fabricRows        || []).map((r, i) => resolveRow(r, i, 'fabric')),
      localTrimRows:     (extracted.localTrimRows     || []).map((r, i) => resolveRow(r, i, 'localTrim')),
      importedTrimRows:  (extracted.importedTrimRows  || []).map((r, i) => resolveRow(r, i, 'importedTrim')),
      manufacturingRows: (extracted.manufacturingRows || []).map((r, i) => resolveRow(r, i, 'manufacturing')),
    });

    handleClose();
  };

  const handleClose = () => {
    onClose();
  };

  const handleAfterClose = () => {
    setStep('upload');
    setExtracted(null);
    setBuyerCreateOpen(false);
    setStyleCreateOpen(false);
    setMatchedBuyer({ id: null, name: null });
    setMatchedStyle({ id: null });
    setOverrides({ fabric: {}, localTrim: {}, importedTrim: {}, manufacturing: {} });
    buyerForm.resetFields();
    styleForm.resetFields();
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const countLinked = (rows, key) =>
    (rows || []).filter((r, i) => overrides[key]?.[i]?.itemId || r.matchedItemId).length;

  const totalRows    = [...(extracted?.fabricRows||[]),...(extracted?.localTrimRows||[]),...(extracted?.importedTrimRows||[]),...(extracted?.manufacturingRows||[])].length;
  const totalLinked  =
    countLinked(extracted?.fabricRows,        'fabric') +
    countLinked(extracted?.localTrimRows,     'localTrim') +
    countLinked(extracted?.importedTrimRows,  'importedTrim') +
    countLinked(extracted?.manufacturingRows, 'manufacturing');

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Modal
        open={open}
        onCancel={handleClose}
        afterClose={handleAfterClose}
        title={<Space><ImportOutlined /> Import from Techpack PDF</Space>}
        width={880}
        centered
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        footer={
          step === 'review' ? (
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Button onClick={() => setStep('upload')}>Upload Different File</Button>
              <Space>
                <Button onClick={handleClose}>Cancel</Button>
                <Button type="primary" onClick={handleApply} icon={<ImportOutlined />}>
                  Apply to Form ({totalLinked}/{totalRows} items linked)
                </Button>
              </Space>
            </Space>
          ) : null
        }
        destroyOnClose
      >

        {/* ── Step 1: Upload ─────────────────────────────────────── */}
        {step === 'upload' && (
          <Spin spinning={loading} tip="AI is analysing your techpack…">
            <Dragger
              accept=".pdf" multiple={false}
              beforeUpload={handleFile} showUploadList={false}
              style={{ padding: '32px 16px' }}
            >
              <p className="ant-upload-drag-icon">
                <FileTextOutlined style={{ fontSize: 48, color: 'var(--primary-color)' }} />
              </p>
              <p className="ant-upload-text">Click or drag a Buyer Techpack PDF here</p>
              <p className="ant-upload-hint">
                AI extracts style info, fabrics and accessories. You can create any missing
                master records directly here without leaving the screen.
              </p>
            </Dragger>
            <Alert
              style={{ marginTop: 16 }} type="info" showIcon
              message="How inline master creation works"
              description={
                <>
                  After extraction, unmatched <b>Buyer</b> and <b>Style</b> show an inline
                  quick-create form pre-filled with AI data. Unmatched <b>Items</b> (fabric,
                  trims) show a <i>Create Item</i> button per row that opens a small form.
                  Everything gets linked automatically — no need to go to master screens.
                </>
              }
            />
          </Spin>
        )}

        {/* ── Step 2: Review ─────────────────────────────────────── */}
        {step === 'review' && extracted && (
          <div>

            {/* ── Buyer & Style Card ── */}
            <Card size="small" style={{ marginBottom: 12, background: '#f6f8ff' }}>
              <Title level={5} style={{ margin: '0 0 12px 0' }}>Extracted Style Info</Title>

              {/* Buyer row */}
              <Row align="top" gutter={8} style={{ marginBottom: 10 }}>
                <Col style={{ paddingTop: 4, width: 80 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Buyer</Text>
                </Col>
                <Col flex="1">
                  <Space size={6} wrap>
                    <Text strong>{extracted.buyerName || '—'}</Text>
                    <MatchTag matched={!!matchedBuyer.id} />
                    {matchedBuyer.id
                      ? <Text style={{ fontSize: 12, color: 'var(--success-color)' }}>{matchedBuyer.name}</Text>
                      : (
                        <Button
                          size="small" icon={<PlusOutlined />}
                          type={buyerCreateOpen ? 'primary' : 'dashed'}
                          onClick={() => setBuyerCreateOpen((v) => !v)}
                        >
                          {buyerCreateOpen ? 'Close' : 'Quick Create Buyer'}
                        </Button>
                      )
                    }
                  </Space>

                  {buyerCreateOpen && !matchedBuyer.id && (
                    <Card
                      size="small"
                      style={{ marginTop: 8, borderStyle: 'dashed', borderColor: 'var(--primary-color)' }}
                    >
                      <Form form={buyerForm} layout="vertical" size="small">
                        <Row gutter={12}>
                          <Col span={8}>
                            <Form.Item name="name" label="Buyer Name"
                              rules={[{ required: true, message: 'Required' }]}
                              style={{ marginBottom: 8 }}>
                              <Input />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="contactPerson" label="Contact Person"
                              rules={[{ required: true, message: 'Required' }]}
                              style={{ marginBottom: 8 }}>
                              <Input placeholder="e.g. John Smith" />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="email" label="Email"
                              rules={[{ required: true, type: 'email', message: 'Valid email required' }]}
                              style={{ marginBottom: 8 }}>
                              <Input placeholder="buyer@brand.com" />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Space>
                          <Button type="primary" size="small" loading={savingBuyer}
                            onClick={handleSaveBuyer} icon={<PlusOutlined />}>
                            Create Buyer
                          </Button>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Shipping details can be added later in Buyer Master
                          </Text>
                        </Space>
                      </Form>
                    </Card>
                  )}
                </Col>
              </Row>

              {/* Style row */}
              <Row align="top" gutter={8} style={{ marginBottom: 10 }}>
                <Col style={{ paddingTop: 4, width: 80 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Style No</Text>
                </Col>
                <Col flex="1">
                  <Space size={6} wrap>
                    <Text strong>{extracted.styleNo || '—'}</Text>
                    <MatchTag matched={!!matchedStyle.id} />
                    {matchedStyle.id
                      ? <Text style={{ fontSize: 12, color: 'var(--success-color)' }}>Linked to existing style</Text>
                      : (
                        <Button
                          size="small" icon={<PlusOutlined />}
                          type={styleCreateOpen ? 'primary' : 'dashed'}
                          onClick={() => setStyleCreateOpen((v) => !v)}
                        >
                          {styleCreateOpen ? 'Close' : 'Quick Create Style'}
                        </Button>
                      )
                    }
                  </Space>

                  {styleCreateOpen && !matchedStyle.id && (
                    <Card
                      size="small"
                      style={{ marginTop: 8, borderStyle: 'dashed', borderColor: 'var(--primary-color)' }}
                    >
                      <Form form={styleForm} layout="vertical" size="small">
                        <Row gutter={12}>
                          <Col span={8}>
                            <Form.Item name="styleNo" label="Style No"
                              rules={[{ required: true, message: 'Required' }]}
                              style={{ marginBottom: 8 }}>
                              <Input />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="garmentName" label="Garment Name"
                              rules={[{ required: true, message: 'Required' }]}
                              style={{ marginBottom: 8 }}>
                              <Input />
                            </Form.Item>
                          </Col>
                          <Col span={8}>
                            <Form.Item name="buyerId" label="Buyer"
                              rules={[{ required: true, message: 'Required' }]}
                              style={{ marginBottom: 8 }}>
                              <Select
                                placeholder="Select Buyer" showSearch optionFilterProp="label"
                                options={allBuyers.map((b) => ({ value: b.id, label: b.name }))}
                              />
                            </Form.Item>
                          </Col>
                          <Col span={4}>
                            <Form.Item name="seasonCode" label="Season" style={{ marginBottom: 8 }}>
                              <Select placeholder="AW/SS" options={SEASON_CODES} allowClear />
                            </Form.Item>
                          </Col>
                          <Col span={4}>
                            <Form.Item name="seasonYear" label="Year" style={{ marginBottom: 8 }}>
                              <Select placeholder="Year" options={SEASON_YEARS} allowClear />
                            </Form.Item>
                          </Col>
                        </Row>
                        <Space>
                          <Button type="primary" size="small" loading={savingStyle}
                            onClick={handleSaveStyle} icon={<PlusOutlined />}>
                            Create Style
                          </Button>
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            Style will be auto-linked after creation
                          </Text>
                        </Space>
                      </Form>
                    </Card>
                  )}
                </Col>
              </Row>

              {/* Season / Garment / Sizes / Colors */}
              <Row gutter={[16, 4]}>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Season </Text>
                  <Text strong>{extracted.seasonCode || '—'} {extracted.seasonYear || ''}</Text>
                </Col>
                <Col span={12}>
                  <Text type="secondary" style={{ fontSize: 12 }}>Garment </Text>
                  <Text strong>{extracted.garmentName || '—'}</Text>
                </Col>
                {extracted.sizes?.length > 0 && (
                  <Col span={24}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Sizes </Text>
                    {extracted.sizes.map((s) => <Tag key={s}>{s}</Tag>)}
                  </Col>
                )}
                {extracted.colorReferences && (
                  <Col span={24}>
                    <Text type="secondary" style={{ fontSize: 12 }}>Colors </Text>
                    <Text style={{ fontSize: 12 }}>{extracted.colorReferences}</Text>
                  </Col>
                )}
              </Row>
            </Card>

            <Divider style={{ margin: '8px 0' }} />

            {/* ── Row Sections ── */}
            <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
              <RowsSection
                title="Fabric" rows={extracted.fabricRows}
                overrides={overrides.fabric} onOverride={setRowOverride('fabric')}
                onCreateItem={(row, idx) => setItemCreate({ open: true, row, section: 'fabric', idx })}
              />
              <RowsSection
                title="Local Trims" rows={extracted.localTrimRows}
                overrides={overrides.localTrim} onOverride={setRowOverride('localTrim')}
                onCreateItem={(row, idx) => setItemCreate({ open: true, row, section: 'localTrim', idx })}
              />
              <RowsSection
                title="Imported Trims" rows={extracted.importedTrimRows}
                overrides={overrides.importedTrim} onOverride={setRowOverride('importedTrim')}
                onCreateItem={(row, idx) => setItemCreate({ open: true, row, section: 'importedTrim', idx })}
              />
              <RowsSection
                title="Manufacturing Processes" rows={extracted.manufacturingRows}
                overrides={overrides.manufacturing} onOverride={setRowOverride('manufacturing')}
                onCreateItem={(row, idx) => setItemCreate({ open: true, row, section: 'manufacturing', idx })}
              />
            </div>

            <Alert
              style={{ marginTop: 12 }} type="info" showIcon
              message={`${totalLinked} of ${totalRows} rows linked to master items. Prices and consumption must be filled manually.`}
            />
          </div>
        )}
      </Modal>

      {/* Quick Create Item sub-modal */}
      <QuickCreateItemModal
        open={itemCreate.open}
        extractedRow={itemCreate.row}
        onClose={() => setItemCreate({ open: false, row: null, section: null, idx: null })}
        onCreated={handleItemCreated}
      />
    </>
  );
}
