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
  Row, Col, Typography, Space, Table, Form, Input, InputNumber, Card,
} from 'antd';
import {
  CheckCircleFilled, WarningFilled, FileTextOutlined,
  ImportOutlined, PlusOutlined,
} from '@ant-design/icons';
import { extractTechpackForCosting } from '../../services/costing/costingService';
import { searchItems, getItemMetaData, createItem, updateItem, getItemById } from '../../services/master/itemService';
import { searchVariants } from '../../services/master/variantService';
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

/** Master category to search variants within, per section. Manufacturing has no item variants. */
const SECTION_VARIANT_CATEGORY = {
  fabric:       'Fabric',
  localTrim:    'Trims',
  importedTrim: 'Trims',
  manufacturing: null,
};

// ── ItemSearchSelect ──────────────────────────────────────────────────────────
// When `category` is set (Fabric / Trims) this searches item VARIANTS by variant code/name and
// shows the variant name. Otherwise it falls back to an item search (used for manufacturing rows).

function ItemSearchSelect({ value, valueLabel, category, onChange }) {
  const [options, setOptions]   = useState([]);
  const [fetching, setFetching] = useState(false);

  const load = async (q) => {
    setFetching(true);
    try {
      if (category) {
        const res  = await searchVariants({ category, q: q || '', limit: 10 });
        const list = res?.data || res || [];
        setOptions(list.map((v) => ({ value: v.variantId, label: v.variantName, sub: v.variantCode, variant: v })));
      } else {
        const res   = await searchItems({ search: q, size: 10 });
        const items = res.data?.content || res.data || [];
        setOptions(items.map((i) => ({ value: i.id, label: i.itemName, sub: i.categoryName, item: i })));
      }
    } catch { setOptions([]); }
    finally  { setFetching(false); }
  };

  const handleSearch = (q) => {
    if (!category && (!q || q.length < 2)) { setOptions([]); return; }
    load(q);
  };

  return (
    <Select
      showSearch allowClear labelInValue
      value={value ? { value, label: valueLabel } : undefined}
      onChange={(opt) => onChange(opt || null)}
      onSearch={handleSearch}
      onDropdownVisibleChange={(open) => { if (open && category && options.length === 0) load(''); }}
      filterOption={false}
      notFoundContent={fetching ? <Spin size="small" /> : 'No results — use Create Item below'}
      placeholder={category ? 'Search variant (code or name)…' : 'Search existing items…'}
      style={{ width: '100%' }}
      options={options}
      optionRender={(opt) => (
        <Space direction="vertical" size={0}>
          <Text>{opt.data.label}</Text>
          {opt.data.sub && (
            <Text type="secondary" style={{ fontSize: 11 }}>{opt.data.sub}</Text>
          )}
        </Space>
      )}
    />
  );
}

// ── QuickCreateItemModal ──────────────────────────────────────────────────────

/** camelCase an attribute name so variant attribute keys match the Item Master payload shape. */
const toCamelCase = (str) =>
  (str || '')
    .trim()
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');

function QuickCreateItemModal({ open, onClose, onCreated, extractedRow }) {
  const { message }           = App.useApp();
  const [form]                = Form.useForm();
  const [meta, setMeta]       = useState([]);
  const [subs, setSubs]       = useState([]);
  const [types, setTypes]     = useState([]);
  const [uoms, setUoms]       = useState([]);
  const [attributes, setAttributes] = useState([]);
  const [existingItem, setExistingItem] = useState(null); // item already present for this classifier combo
  const [categorySelected, setCategorySelected]       = useState(false);
  const [subcategorySelected, setSubcategorySelected] = useState(false);
  const [itemTypeSelected, setItemTypeSelected]       = useState(false);
  const [saving, setSaving]   = useState(false);

  const noSubsForCategory    = categorySelected    && subs.length  === 0;
  const noTypesForSubcategory = subcategorySelected && types.length === 0;
  const noUomsForItemType    = itemTypeSelected    && uoms.length  === 0;
  const hasDeadEnd = noSubsForCategory || noTypesForSubcategory || noUomsForItemType;

  const resetDependent = () => {
    setTypes([]);
    setUoms([]);
    setAttributes([]);
    setExistingItem(null);
  };

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ isActive: true });
    getItemMetaData()
      .then((res) => {
        const data = Array.isArray(res) ? res : (res?.data || res?.content || []);
        setMeta(data);
        const keyword = ROW_TYPE_CATEGORY[extractedRow?.rowType] || '';
        const cat = data.find((c) => c.name?.toLowerCase().includes(keyword));
        if (cat) {
          form.setFieldValue('categoryId', String(cat.id));
          setSubs(cat.subCategories || []);
          setCategorySelected(true);
        }
        // Pre-seed the variant name with the extracted material name.
        if (extractedRow?.extractedName) form.setFieldValue('variantName', extractedRow.extractedName);
      })
      .catch(() => {});
  }, [open, extractedRow]);

  const handleCategoryChange = (catId) => {
    form.setFieldsValue({ subCategoryId: undefined, itemTypeId: undefined, uomId: undefined });
    const cat = meta.find((c) => String(c.id) === String(catId));
    setSubs(cat?.subCategories || []);
    resetDependent();
    setCategorySelected(!!catId);
    setSubcategorySelected(false);
    setItemTypeSelected(false);
  };

  const handleSubcategoryChange = (subId) => {
    form.setFieldsValue({ itemTypeId: undefined, uomId: undefined });
    const catId = form.getFieldValue('categoryId');
    const cat   = meta.find((c) => String(c.id) === String(catId));
    const sub   = cat?.subCategories?.find((s) => String(s.id) === String(subId));
    setTypes(sub?.itemTypes || []);
    setUoms([]);
    setAttributes([]);
    setExistingItem(null);
    setSubcategorySelected(!!subId);
    setItemTypeSelected(false);
  };

  const handleItemTypeChange = async (typeId) => {
    form.setFieldValue('uomId', undefined);
    const catId = form.getFieldValue('categoryId');
    const subId = form.getFieldValue('subCategoryId');
    const cat   = meta.find((c) => String(c.id) === String(catId));
    const sub   = cat?.subCategories?.find((s) => String(s.id) === String(subId));
    const type  = sub?.itemTypes?.find((t) => String(t.id) === String(typeId));
    setUoms(type?.uoms || []);
    setAttributes(type?.attributes || []);
    setItemTypeSelected(!!typeId);
    // The Category + Sub-Category + Item Type combination is unique. If an item already exists,
    // we'll add the new variant to it (find-or-create) and show its existing variant names.
    setExistingItem(null);
    if (catId && subId && typeId) {
      try {
        const res  = await searchItems({ categoryId: parseInt(catId), subCategoryId: parseInt(subId), itemTypeId: parseInt(typeId), page: 0, size: 1 });
        const item = res?.data?.content?.[0] || res?.content?.[0] || (Array.isArray(res?.data) ? res.data[0] : null);
        if (item) {
          setExistingItem(item);
          // Prefill UOM/HSN/allowance from the existing item so the new variant stays consistent.
          form.setFieldsValue({
            uomId: item.uomId != null ? String(item.uomId) : undefined,
            hsnCode: item.hsnCode || '',
            defaultAllowance: item.defaultAllowance != null ? Number(item.defaultAllowance) : undefined,
          });
        }
      } catch { /* ignore lookup failure */ }
    }
  };

  const handleSave = async () => {
    try {
      const v = await form.validateFields();
      setSaving(true);

      const attributeObject = {};
      attributes.forEach((attr) => {
        attributeObject[toCamelCase(attr.attributeName)] = (v[`attr_${attr.id}`] || '').toString().trim();
      });
      const newVariant = { variantName: v.variantName.trim(), attributes: attributeObject, isActive: true };

      let savedItem;
      if (existingItem) {
        // Append the new variant to the existing item (keep its existing variants).
        const full = (await getItemById(existingItem.id));
        const item = full?.data || full || existingItem;
        const payload = {
          ...item,
          categoryId:    item.categoryId,
          subCategoryId: item.subCategoryId,
          itemTypeId:    item.itemTypeId,
          uomId:         parseInt(v.uomId),
          hsnCode:       v.hsnCode || item.hsnCode || '',
          defaultAllowance: v.defaultAllowance,
          isActive:      true,
          version:       item.version,
          variants:      [...(item.variants || []), newVariant],
        };
        const res = await updateItem(item.id, payload);
        savedItem = res?.data || res;
      } else {
        const res = await createItem({
          categoryId:    parseInt(v.categoryId),
          subCategoryId: parseInt(v.subCategoryId),
          itemTypeId:    parseInt(v.itemTypeId),
          uomId:         parseInt(v.uomId),
          hsnCode:       v.hsnCode || '',
          defaultAllowance: v.defaultAllowance,
          isActive:      true,
          variants:      [newVariant],
        });
        savedItem = res?.data || res;
      }

      // Locate the just-added variant by name to return its id.
      const created = (savedItem?.variants || []).find(
        (vr) => (vr.variantName || '').trim().toLowerCase() === newVariant.variantName.toLowerCase(),
      );
      message.success(`Variant "${newVariant.variantName}" ${existingItem ? 'added to existing item' : 'created'}`);
      onCreated({
        itemId:      savedItem?.id,
        itemName:    savedItem?.itemName,
        variantId:   created?.id ?? null,
        variantName: newVariant.variantName,
      });
      form.resetFields();
      setExistingItem(null);
    } catch (err) {
      if (!err?.errorFields) message.error(err?.errorMessage || err?.response?.data?.message || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      afterClose={() => { form.resetFields(); resetDependent(); setCategorySelected(false); setSubcategorySelected(false); setItemTypeSelected(false); }}
      title={<span style={{ fontSize: 18, fontWeight: 600 }}>Quick Create Item</span>}
      width={640}
      centered
      onOk={handleSave}
      okText={existingItem ? 'Add Variant' : 'Create Item'}
      okButtonProps={{ loading: saving, disabled: hasDeadEnd }}
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
    >
      <Alert
        type="info" showIcon
        style={{ marginBottom: 16 }}
        message={`Creating a variant for: "${extractedRow?.extractedName}"`}
        description="Item name is derived from Category / Sub-Category / Item Type. Enter a variant name and its attributes."
      />
      {noSubsForCategory && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="No Subcategory configured for this Category"
          description="Add a subcategory under this category in the master screen first." />
      )}
      {noTypesForSubcategory && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="No Item Type configured for this Subcategory"
          description="Add an item type under this subcategory in the master screen first." />
      )}
      {noUomsForItemType && (
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="No UOM configured for this Item Type"
          description="Assign at least one UOM to this item type first." />
      )}
      {existingItem && (
        <Alert type="success" showIcon style={{ marginBottom: 16 }}
          message="This item already exists — your variant will be added to it"
          description={
            (existingItem.variants || []).length > 0
              ? <>Existing variants: {(existingItem.variants || []).map((vr) => vr.variantName).filter(Boolean).join(', ') || '—'}</>
              : 'This item currently has no variants.'
          } />
      )}
      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="categoryId" label="Category" rules={[{ required: true }]}>
              <Select placeholder="Category" showSearch optionFilterProp="label"
                options={meta.map((c) => ({ value: String(c.id), label: c.name }))}
                onChange={handleCategoryChange} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="subCategoryId" label="Subcategory" rules={[{ required: true }]}>
              <Select placeholder="Subcategory" showSearch optionFilterProp="label"
                disabled={subs.length === 0}
                options={subs.map((s) => ({ value: String(s.id), label: s.name }))}
                onChange={handleSubcategoryChange} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="itemTypeId" label="Item Type" rules={[{ required: true }]}>
              <Select placeholder="Item Type" showSearch optionFilterProp="label"
                disabled={types.length === 0}
                options={types.map((t) => ({ value: String(t.id), label: t.name }))}
                onChange={handleItemTypeChange} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="uomId" label="Unit of Measure" rules={[{ required: true }]}>
              <Select placeholder="UOM" disabled={uoms.length === 0}
                options={uoms.map((u) => ({ value: String(u.id), label: u.symbol || u.name }))} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="defaultAllowance" label="Allowance %" rules={[{ required: true, message: 'Required' }]}>
              <InputNumber min={0} step={0.5} style={{ width: '100%' }} placeholder="e.g. 3" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="hsnCode" label="HSN Code">
              <Input placeholder="Optional" />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ margin: '4px 0 12px' }}>Variant</Divider>
        <Form.Item
          name="variantName"
          label="Variant Name"
          rules={[
            { required: true, message: 'Variant name is required' },
            { min: 5, message: 'At least 5 characters' },
          ]}
        >
          <Input placeholder="e.g. Black 180 GSM" maxLength={100} />
        </Form.Item>
        {attributes.length > 0 && (
          <Row gutter={16}>
            {attributes.map((attr) => (
              <Col span={12} key={attr.id}>
                <Form.Item
                  name={`attr_${attr.id}`}
                  label={attr.attributeName}
                  rules={[{ required: true, message: `${attr.attributeName} is required` }]}
                >
                  <Input placeholder={attr.attributeName} />
                </Form.Item>
              </Col>
            ))}
          </Row>
        )}
      </Form>
    </Modal>
  );
}

// ── RowsSection ───────────────────────────────────────────────────────────────

function RowsSection({ title, rows, overrides, onOverride, onCreateItem, category }) {
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
      title: category ? 'Linked Variant' : 'Linked Master Item',
      width: 310,
      render: (_, row) => {
        const ov            = overrides[row._idx];
        // For fabric/trims the linkage is a variant; for manufacturing it stays an item.
        const effectiveId   = category
          ? (ov?.variantId ?? row.matchedVariantId)
          : (ov?.itemId ?? row.matchedItemId);
        const effectiveName = ov?.variantName ?? ov?.itemName ?? row.matchedVariantName ?? row.matchedItemName;
        return (
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <Space size={4}>
              <MatchTag matched={!!effectiveId} />
              {effectiveName && <Text style={{ fontSize: 12 }}>{effectiveName}</Text>}
            </Space>
            <ItemSearchSelect
              category={category}
              value={effectiveId || undefined}
              valueLabel={effectiveName}
              onChange={(opt) => onOverride(row._idx, opt)}
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

  const handleItemCreated = ({ itemId, itemName, variantId, variantName }) => {
    const { section, idx } = itemCreate;
    setOverrides((prev) => ({
      ...prev,
      [section]: { ...prev[section], [idx]: { itemId, itemName, variantId, variantName } },
    }));
    setItemCreate({ open: false, row: null, section: null, idx: null });
  };

  const setRowOverride = (section) => (idx, opt) => {
    // opt is the selected AntD option (labelInValue) carrying the full variant/item, or null on clear.
    const variant = opt?.variant;
    const item = opt?.item;
    const value = !opt
      ? {}
      : variant
        ? { itemId: variant.itemId, itemName: variant.variantName, variantId: variant.variantId, variantName: variant.variantName, variantCode: variant.variantCode }
        : { itemId: item?.id, itemName: item?.itemName };
    setOverrides((prev) => ({ ...prev, [section]: { ...prev[section], [idx]: value } }));
  };

  // ── Apply to Form ─────────────────────────────────────────────────────────

  const handleApply = () => {
    const resolveRow = (row, idx, sectionKey) => {
      const ov = overrides[sectionKey]?.[idx];
      return {
        matchedItemId:      ov?.itemId      ?? row.matchedItemId   ?? null,
        matchedItemName:    ov?.itemName    ?? row.matchedItemName ?? null,
        matchedVariantId:   ov?.variantId   ?? row.matchedVariantId   ?? null,
        matchedVariantName: ov?.variantName ?? row.matchedVariantName ?? null,
        matchedVariantCode: ov?.variantCode ?? row.matchedVariantCode ?? null,
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
        title={
          <Space size={8} style={{ fontSize: 18, fontWeight: 600 }}>
            <ImportOutlined /> Import from Techpack PDF
          </Space>
        }
        width={880}
        centered
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 12, paddingTop: 8, paddingBottom: 8 } }}
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
            <Card
              size="small"
              style={{ marginBottom: 12, background: '#f6f8ff' }}
              styles={{ body: { paddingTop: 20 } }}
            >
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
                          size="small" icon={<PlusOutlined />} type="dashed"
                          onClick={() => setBuyerCreateOpen(true)}
                        >
                          Quick Create Buyer
                        </Button>
                      )
                    }
                  </Space>
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
                          size="small" icon={<PlusOutlined />} type="dashed"
                          onClick={() => setStyleCreateOpen(true)}
                        >
                          Quick Create Style
                        </Button>
                      )
                    }
                  </Space>
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
            <div>
              <RowsSection
                title="Fabric" rows={extracted.fabricRows} category={SECTION_VARIANT_CATEGORY.fabric}
                overrides={overrides.fabric} onOverride={setRowOverride('fabric')}
                onCreateItem={(row, idx) => setItemCreate({ open: true, row, section: 'fabric', idx })}
              />
              <RowsSection
                title="Local Trims" rows={extracted.localTrimRows} category={SECTION_VARIANT_CATEGORY.localTrim}
                overrides={overrides.localTrim} onOverride={setRowOverride('localTrim')}
                onCreateItem={(row, idx) => setItemCreate({ open: true, row, section: 'localTrim', idx })}
              />
              <RowsSection
                title="Imported Trims" rows={extracted.importedTrimRows} category={SECTION_VARIANT_CATEGORY.importedTrim}
                overrides={overrides.importedTrim} onOverride={setRowOverride('importedTrim')}
                onCreateItem={(row, idx) => setItemCreate({ open: true, row, section: 'importedTrim', idx })}
              />
              <RowsSection
                title="Manufacturing Processes" rows={extracted.manufacturingRows} category={SECTION_VARIANT_CATEGORY.manufacturing}
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

      {/* Quick Create Buyer sub-modal */}
      <Modal
        open={buyerCreateOpen}
        onCancel={() => setBuyerCreateOpen(false)}
        title={<span style={{ fontSize: 18, fontWeight: 600 }}>Quick Create Buyer</span>}
        width={640}
        centered
        onOk={handleSaveBuyer}
        okText="Create Buyer"
        okButtonProps={{ loading: savingBuyer, icon: <PlusOutlined /> }}
        destroyOnClose={false}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Alert
          type="info" showIcon
          style={{ marginBottom: 16 }}
          message="Shipping details can be added later in Buyer Master"
        />
        <Form form={buyerForm} layout="vertical">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="name" label="Buyer Name"
                rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contactPerson" label="Contact Person"
                rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. John Smith" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="email" label="Email"
                rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
                <Input placeholder="buyer@brand.com" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Quick Create Style sub-modal */}
      <Modal
        open={styleCreateOpen}
        onCancel={() => setStyleCreateOpen(false)}
        title={<span style={{ fontSize: 18, fontWeight: 600 }}>Quick Create Style</span>}
        width={640}
        centered
        onOk={handleSaveStyle}
        okText="Create Style"
        okButtonProps={{ loading: savingStyle, icon: <PlusOutlined /> }}
        destroyOnClose={false}
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto', overflowX: 'hidden' } }}
      >
        <Alert
          type="info" showIcon
          style={{ marginBottom: 16 }}
          message="Style will be auto-linked after creation"
        />
        <Form form={styleForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="styleNo" label="Style No"
                rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="garmentName" label="Garment Name"
                rules={[{ required: true, message: 'Required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="buyerId" label="Buyer"
                rules={[{ required: true, message: 'Required' }]}>
                <Select
                  placeholder="Select Buyer" showSearch optionFilterProp="label"
                  options={allBuyers.map((b) => ({ value: b.id, label: b.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="seasonCode" label="Season">
                <Select placeholder="AW/SS" options={SEASON_CODES} allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="seasonYear" label="Year">
                <Select placeholder="Year" options={SEASON_YEARS} allowClear />
              </Form.Item>
            </Col>
          </Row>
        </Form>
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
