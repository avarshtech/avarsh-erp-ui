import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  Table,
  Space,
  Typography,
  message,
  Popconfirm,
  Divider,
  Spin,
  Modal,
  Tag,
  Descriptions,
  AutoComplete,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  SearchOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  getTermsConditions,
  createActivity,
} from '../../services/purchaseOrderService';
import { getSuppliers } from '../../services/supplierService';
import { autocompleteItems, getItemsByIds } from '../../services/itemService';
import { useStore } from '../../context/StoreContext';
import { getCurrentUser } from '../../utils/permissions';
import { PO_STATUS, LINE_ITEM_STATUS } from '../../utils/poStatusConstants';
import PantoneColorSwatch from '../../components/PantoneColorSwatch';
import { isPantoneCode } from '../../services/pantoneService';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============================================================
// ItemSearchInput - Debounced item search with dropdown
// ============================================================
const ItemSearchInput = ({ value, onSelect, onChange, disabled }) => {
  const [searchText, setSearchText] = useState(value || '');
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const noResultCacheRef = useRef(new Set());

  useEffect(() => {
    setSearchText(value || '');
  }, [value]);

  const handleSearch = (text) => {
    setSearchText(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text || text.length < 2) {
      setOptions([]);
      return;
    }

    // Smart no-result caching
    for (const cached of noResultCacheRef.current) {
      if (text.startsWith(cached)) {
        setOptions([]);
        return;
      }
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await autocompleteItems(text);
        // API returns: { content: [...], pageNumber, pageSize, totalElements, ... }
        // Axios interceptor returns the full response, so response.data has the payload
        const payload = response?.data || response || {};
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.content)
            ? payload.content
            : [];
        if (items.length === 0) {
          noResultCacheRef.current.add(text);
        }
        setOptions(
          items.map((item) => ({
            value: `${item.itemCode || ''} - ${item.itemName || ''}`,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.itemCode || ''} - {item.itemName || ''}</span>
                {item.categoryName && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.categoryName}</span>
                )}
              </div>
            ),
            item,
          }))
        );
      } catch {
        setOptions([]);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleSelect = (_, option) => {
    const item = option.item;
    setSearchText(`${item.itemCode || ''} - ${item.itemName || ''}`);
    setOptions([]);
    if (onSelect) onSelect(item);
  };

  const handleChange = (text) => {
    setSearchText(text || '');
    if (!text) {
      setOptions([]);
      if (onChange) onChange('');
    }
  };

  return (
    <AutoComplete
      value={searchText}
      options={options}
      onSearch={handleSearch}
      onSelect={handleSelect}
      onChange={handleChange}
      placeholder="Search items..."
      disabled={disabled}
      style={{ width: '100%' }}
      allowClear
      notFoundContent={searching ? <Spin size="small" /> : null}
    />
  );
};

// ============================================================
// VariantSelectionModal - Select variant for multi-variant items
// ============================================================
const VariantSelectionModal = ({ open, item, onSelect, currentVariantId }) => {
  if (!item) return null;

  const variants = (item.variants || []).filter((v) => v.isActive !== false);

  const handleCardClick = (variant) => {
    onSelect(item, variant);
  };

  return (
    <Modal
      title={
        <Space>
          <Text strong>Select Variant</Text>
          <Tag color="blue">{item.itemCode}</Tag>
          <Text type="secondary">- {item.itemName}</Text>
        </Space>
      }
      open={open}
      onCancel={() => onSelect(null, null)}
      width={600}
      footer={null}
      closable={false}
      maskClosable={false}
    >
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        This item has {variants.length} variants. Please select one:
      </Text>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          maxHeight: 400,
          overflowY: 'auto',
          paddingRight: 4,
        }}
      >
        {variants.map((variant) => {
          const isCurrent = currentVariantId && variant.id === currentVariantId;
          const attrs = variant.attributes || {};
          return (
            <div
              key={variant.id}
              onClick={() => handleCardClick(variant)}
              style={{
                padding: '12px 16px',
                borderRadius: 8,
                border: isCurrent
                  ? '2px solid var(--primary-color)'
                  : '2px solid var(--border-color)',
                background: isCurrent
                  ? 'var(--bg-tertiary)'
                  : 'var(--card-bg)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                {Object.entries(attrs).length > 0 ? (
                  Object.entries(attrs).map(([key, val]) => {
                    const kLower = key.toLowerCase();
                    const isColorAttr = kLower.includes('color') || kLower.includes('colour');
                    const showSwatch = isColorAttr && isPantoneCode(val);
                    return (
                      <Tag key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {showSwatch && <PantoneColorSwatch value={val} size={16} />}
                        <Text style={{ fontSize: 12 }}>
                          {key.charAt(0).toUpperCase() + key.slice(1)}: {val}
                        </Text>
                      </Tag>
                    );
                  })
                ) : (
                  <Text type="secondary">Default variant</Text>
                )}
                {isCurrent && (
                  <Tag color="green" style={{ marginLeft: 'auto', fontWeight: 600 }}>
                    Current
                  </Tag>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

// Tax options for GST
const TAX_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' },
];

const POForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  // Master data
  const [suppliersList, setSuppliersList] = useState([]);
  const [termsConditionsList, setTermsConditionsList] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Line items
  const [lineItems, setLineItems] = useState([createEmptyLineItem()]);

  // IGST applicability (determined by supplier)
  const [isIgstApplicable, setIsIgstApplicable] = useState(false);

  // Preview dialog
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  // Dirty state for unsaved changes warning
  const [isDirty, setIsDirty] = useState(false);

  // Variant modal state
  const [variantModalState, setVariantModalState] = useState({
    show: false,
    pendingItem: null,
    pendingLineKey: null,
    isChange: false,
    currentVariantId: null,
  });

  // Items with their variants (keyed by itemId) - used for variant column display
  const [itemsWithVariants, setItemsWithVariants] = useState({});

  // Original PO data for edit mode (to know previous status)
  const [originalPO, setOriginalPO] = useState(null);

  // Store context
  const { suppliers, uoms, setData, isCacheValid, setLoading: setStoreLoading } = useStore();

  const isEditMode = !!id;

  // Create empty line item
  function createEmptyLineItem() {
    return {
      key: String(Date.now()) + Math.random(),
      itemId: '',
      itemCode: '',
      itemName: '',
      description: '',
      qty: '',
      uom: '',
      uomId: null,
      primaryUom: '',
      primaryUomId: null,
      secondaryUom: '',
      secondaryUomId: null,
      unitPrice: '',
      gstPercent: 0,
      amount: 0,
      variantId: null,
      variantAttributes: null,
    };
  }

  // Load master data on mount
  useEffect(() => {
    loadMasterData();
    if (isEditMode) {
      loadPOData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadMasterData = async () => {
    try {
      const [suppliersRes, termsRes] = await Promise.all([
        getSuppliers(),
        getTermsConditions(),
      ]);

      const suppData = suppliersRes?.data?.content || suppliersRes?.data || suppliersRes?.content || suppliersRes || [];
      const termsData = termsRes?.content || termsRes?.data || termsRes || [];

      setSuppliersList(Array.isArray(suppData) ? suppData : []);
      setTermsConditionsList(Array.isArray(termsData) ? termsData : []);
    } catch {
      message.error('Failed to load master data');
    }
  };

  const loadPOData = async () => {
    setPageLoading(true);
    try {
      const data = await getPurchaseOrderById(id);
      setOriginalPO(data);

      // Set form fields
      form.setFieldsValue({
        supplierId: data.supplierId,
        poDate: data.poDate ? dayjs(data.poDate) : null,
        deliveryDate: data.deliveryDate ? dayjs(data.deliveryDate) : null,
        termsConditionId: data.termsConditionsId || data.termsConditionId,
        remarks: data.remarks || '',
      });

      // Find supplier (will be retried when suppliersList loads)
      if (data.supplierId && suppliersList.length > 0) {
        const sup = suppliersList.find((s) => Number(s.id) === Number(data.supplierId));
        setSelectedSupplier(sup || null);
        setIsIgstApplicable(sup?.igstApplicable || false);
      }

      // Fetch items with variants for existing line items
      const itemIdsToFetch = [
        ...new Set(
          (data.lineItems || [])
            .map((li) => li.itemId)
            .filter((itemId) => itemId)
        ),
      ];
      if (itemIdsToFetch.length > 0) {
        try {
          const itemsResponse = await getItemsByIds(itemIdsToFetch);
          const rawItems = itemsResponse?.data || itemsResponse || {};
          const itemsData = Array.isArray(rawItems)
            ? rawItems
            : Array.isArray(rawItems?.content)
              ? rawItems.content
              : [];
          const itemsMap = {};
          itemsData.forEach((item) => {
            itemsMap[item.id] = item;
          });
          setItemsWithVariants(itemsMap);
        } catch {
          // Items fetch is non-critical for display
        }
      }

      // Map line items
      const mappedItems = (data.lineItems || []).map((item) => ({
        key: String(item.id || Date.now()) + Math.random(),
        itemId: item.itemId || '',
        itemCode: item.itemCode || '',
        itemName: item.itemName || '',
        description: item.description || '',
        qty: String(item.quantity || item.qty || ''),
        uom: item.uomName || item.uom || '',
        uomId: item.uomId || null,
        primaryUom: item.uomName || '',
        primaryUomId: item.uomId || null,
        secondaryUom: item.secondaryUomName || '',
        secondaryUomId: item.secondaryUomId || null,
        unitPrice: item.unitPrice || 0,
        gstPercent:
          item.gstPercent ||
          (item.cgst || 0) + (item.sgst || 0) ||
          item.igst ||
          0,
        amount: item.totalAmount || item.amount || 0,
        variantId: item.variantId || null,
        variantAttributes: item.variantAttributes || null,
        status: item.status || null,
      }));

      setLineItems(mappedItems.length > 0 ? mappedItems : [createEmptyLineItem()]);
    } catch {
      message.error('Failed to load purchase order');
      navigate('/purchase-orders/list');
    } finally {
      setPageLoading(false);
    }
  };

  // Reload supplier info when suppliers list loads (for edit mode)
  useEffect(() => {
    if (isEditMode && suppliersList.length > 0) {
      const supplierId = form.getFieldValue('supplierId');
      if (supplierId) {
        const sup = suppliersList.find((s) => Number(s.id) === Number(supplierId));
        setSelectedSupplier(sup || null);
        setIsIgstApplicable(sup?.igstApplicable || false);
      }
    }
  }, [suppliersList, isEditMode, form]);

  // Handle supplier change
  const handleSupplierChange = (value) => {
    const supplier = suppliersList.find((s) => s.id === value);
    setSelectedSupplier(supplier || null);
    setIsIgstApplicable(supplier?.igstApplicable || false);
    setIsDirty(true);
  };

  // Line item handlers
  const handleLineItemChange = useCallback((key, field, value) => {
    setLineItems((prev) =>
      prev.map((item) => {
        if (item.key === key) {
          const updated = { ...item, [field]: value };
          // Recalculate amount
          const qty = parseFloat(updated.qty) || 0;
          const unitPrice = parseFloat(updated.unitPrice) || 0;
          const gstPercent = parseFloat(updated.gstPercent) || 0;
          updated.amount = parseFloat((qty * unitPrice * (1 + gstPercent / 100)).toFixed(2));
          return updated;
        }
        return item;
      })
    );
    setIsDirty(true);
  }, []);

  // Handle item selection from search - with variant support
  const handleItemSelect = useCallback(
    (selectedItem, lineKey) => {
      const variants = (selectedItem.variants || []).filter(
        (v) => v.isActive !== false
      );

      // Store item for variant column display
      setItemsWithVariants((prev) => ({
        ...prev,
        [selectedItem.id]: selectedItem,
      }));

      // If item has multiple variants, show variant selection modal
      if (variants.length > 1) {
        setVariantModalState({
          show: true,
          pendingItem: selectedItem,
          pendingLineKey: lineKey,
          isChange: false,
          currentVariantId: null,
        });
        return;
      }

      // If item has exactly one variant, auto-select it
      const selectedVariant = variants.length === 1 ? variants[0] : null;
      populateLineItemWithVariant(lineKey, selectedItem, selectedVariant);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Populate line item with item + variant data
  const populateLineItemWithVariant = useCallback(
    (lineKey, item, variant) => {
      setLineItems((prev) =>
        prev.map((li) => {
          if (li.key === lineKey) {
            // Build description including variant attributes
            const descParts = [];
            if (item.itemName) descParts.push(item.itemName);
            const catInfo = [];
            if (item.subCategoryName) catInfo.push(item.subCategoryName);
            if (item.itemTypeName) catInfo.push(item.itemTypeName);
            if (catInfo.length > 0) descParts.push(`(${catInfo.join(' - ')})`);

            // Include variant attributes in description
            const attrs = variant?.attributes || item.attributes;
            if (attrs && typeof attrs === 'object') {
              const attrStrings = Object.entries(attrs)
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => `${k.charAt(0).toUpperCase() + k.slice(1)}: ${v}`);
              if (attrStrings.length > 0) descParts.push(`[${attrStrings.join(', ')}]`);
            }

            const gst = item.gstPercent ?? item.gst ?? (((item.cgst || 0) + (item.sgst || 0)) || 0);
            const rawPrice = item.unitPrice ?? item.price ?? item.rate ?? null;
            const unitPrice = (rawPrice !== null && rawPrice !== undefined && rawPrice > 0) ? rawPrice : '';
            const qty = parseFloat(li.qty) || 0;
            const numericPrice = parseFloat(unitPrice) || 0;
            const amount = parseFloat(
              (qty * numericPrice * (1 + gst / 100)).toFixed(2)
            );

            return {
              ...li,
              itemId: item.id,
              itemCode: item.itemCode || '',
              itemName: item.itemName || '',
              description: descParts.join(' '),
              uom: item.uomName || '',
              uomId: item.uomId || null,
              primaryUom: item.uomName || '',
              primaryUomId: item.uomId || null,
              secondaryUom: item.secondaryUomName || '',
              secondaryUomId: item.secondaryUomId || null,
              unitPrice,
              gstPercent: gst,
              variantId: variant?.id || null,
              variantAttributes: variant?.attributes || null,
              amount,
            };
          }
          return li;
        })
      );
      setIsDirty(true);
    },
    []
  );

  // Handle variant selection from modal
  const handleVariantSelect = (item, variant) => {
    if (item && variant && variantModalState.pendingLineKey) {
      populateLineItemWithVariant(variantModalState.pendingLineKey, item, variant);
    }
    // If item is null (modal dismissed without selection on new item), clear the line
    // but only if it's a new selection (not a change)
    if (!item && !variantModalState.isChange && variantModalState.pendingLineKey) {
      setLineItems((prev) =>
        prev.map((li) =>
          li.key === variantModalState.pendingLineKey
            ? { ...createEmptyLineItem(), key: variantModalState.pendingLineKey }
            : li
        )
      );
    }
    setVariantModalState({
      show: false,
      pendingItem: null,
      pendingLineKey: null,
      isChange: false,
      currentVariantId: null,
    });
  };

  // Handle variant modal cancel
  const handleVariantModalCancel = () => {
    // If it's a new item selection (not change), clear the line item
    if (!variantModalState.isChange && variantModalState.pendingLineKey) {
      setLineItems((prev) =>
        prev.map((li) =>
          li.key === variantModalState.pendingLineKey
            ? { ...createEmptyLineItem(), key: variantModalState.pendingLineKey }
            : li
        )
      );
    }
    setVariantModalState({
      show: false,
      pendingItem: null,
      pendingLineKey: null,
      isChange: false,
      currentVariantId: null,
    });
  };

  // Handle "Change Variant" click from variant column
  const handleChangeVariant = (lineKey, itemId) => {
    const item = itemsWithVariants[itemId];
    if (!item) return;
    // Find the current variant ID for this line item
    const lineItem = lineItems.find((li) => li.key === lineKey);
    setVariantModalState({
      show: true,
      pendingItem: item,
      pendingLineKey: lineKey,
      isChange: true,
      currentVariantId: lineItem?.variantId || null,
    });
  };

  const addLineItem = () => {
    setLineItems((prev) => [...prev, createEmptyLineItem()]);
  };

  const removeLineItem = (key) => {
    if (lineItems.length === 1) {
      message.warning('At least one line item is required');
      return;
    }
    setLineItems((prev) => prev.filter((item) => item.key !== key));
    setIsDirty(true);
  };

  // Calculate totals
  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => {
      return sum + (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
    }, 0);

    let sgst = 0;
    let cgst = 0;
    let igst = 0;

    lineItems.forEach((item) => {
      const base = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
      const gstPercent = parseFloat(item.gstPercent) || 0;
      const gstAmount = (base * gstPercent) / 100;

      if (isIgstApplicable) {
        igst += gstAmount;
      } else {
        sgst += gstAmount / 2;
        cgst += gstAmount / 2;
      }
    });

    const grandTotal = isIgstApplicable ? subtotal + igst : subtotal + sgst + cgst;

    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      sgst: parseFloat(sgst.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)),
      igst: parseFloat(igst.toFixed(2)),
      grandTotal: parseFloat(grandTotal.toFixed(2)),
    };
  }, [lineItems, isIgstApplicable]);

  // GST Breakup by percentage
  const gstBreakup = useMemo(() => {
    const groups = {};
    lineItems.forEach((item) => {
      const qty = parseFloat(item.qty) || 0;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const base = qty * unitPrice;
      const gstPercent = parseFloat(item.gstPercent) || 0;
      if (gstPercent === 0 || base === 0) return;
      const gstAmount = (base * gstPercent) / 100;

      if (!groups[gstPercent]) {
        groups[gstPercent] = { igst: 0, sgst: 0, cgst: 0, taxableAmount: 0 };
      }
      if (isIgstApplicable) {
        groups[gstPercent].igst += gstAmount;
      } else {
        groups[gstPercent].sgst += gstAmount / 2;
        groups[gstPercent].cgst += gstAmount / 2;
      }
      groups[gstPercent].taxableAmount += base;
    });

    return Object.entries(groups)
      .map(([pct, vals]) => ({
        percent: parseFloat(pct),
        ...vals,
      }))
      .sort((a, b) => a.percent - b.percent);
  }, [lineItems, isIgstApplicable]);

  // Validate form
  const validateForm = (isSubmit = false) => {
    const errors = [];

    if (!form.getFieldValue('supplierId')) errors.push('Supplier is required');

    // PO Date validation
    const poDate = form.getFieldValue('poDate');
    if (!poDate) {
      errors.push('PO Date is required');
    } else if (!isEditMode && poDate.isBefore(dayjs().startOf('day'))) {
      errors.push('PO Date cannot be in the past');
    }

    // Delivery Date validation
    const deliveryDate = form.getFieldValue('deliveryDate');
    if (!deliveryDate) {
      errors.push('Expected Delivery Date is required');
    } else {
      const tomorrow = dayjs().add(1, 'day').startOf('day');
      if (deliveryDate.isBefore(tomorrow)) {
        errors.push('Expected Delivery Date must be in the future');
      } else if (poDate && !deliveryDate.isAfter(poDate)) {
        errors.push('Expected Delivery Date must be after PO Date');
      }
    }

    // Terms & Conditions required on submit
    if (isSubmit && !form.getFieldValue('termsConditionId')) {
      errors.push('Terms and Conditions is required');
    }

    // Remarks validation
    const remarks = form.getFieldValue('remarks') || '';
    if (remarks.length > 500) {
      errors.push('Remarks cannot exceed 500 characters');
    }

    // Line items validation
    const validItems = lineItems.filter((item) => item.itemId);
    if (validItems.length === 0) {
      errors.push('At least one line item with an item selected is required');
    }

    lineItems.forEach((item, idx) => {
      // If item is not selected but row exists among multiple rows, flag it
      if (!item.itemId) {
        // Allow a single empty row only if it's the sole row (default state)
        if (lineItems.length > 1 || validItems.length > 0) {
          errors.push(`Line item ${idx + 1}: Item is required`);
        }
        return;
      }

      const qty = parseFloat(item.qty);
      const unitPrice = parseFloat(item.unitPrice);

      if (item.qty === '' || isNaN(qty) || qty < 1) {
        errors.push(`Line item ${idx + 1}: Quantity must be at least 1`);
      }

      if (isSubmit) {
        // Submit requires unit price > 0
        if (item.unitPrice === '' || isNaN(unitPrice) || unitPrice <= 0) {
          errors.push(`Line item ${idx + 1}: Unit Price must be greater than 0`);
        }
      } else {
        // Draft allows unit price = 0, but not negative
        if (item.unitPrice !== '' && !isNaN(unitPrice) && unitPrice < 0) {
          errors.push(`Line item ${idx + 1}: Unit Price cannot be negative`);
        }
      }

      // UOM validation
      if (!item.uomId) {
        errors.push(`Line item ${idx + 1}: UOM is required`);
      }
    });

    // Duplicate line item validation (same item + variant + UOM)
    const seen = [];
    validItems.forEach((item, idx) => {
      const variantKey = item.variantId
        ? String(item.variantId)
        : item.variantAttributes
          ? JSON.stringify(item.variantAttributes)
          : 'none';
      const dupKey = `${item.itemId}|${variantKey}|${item.uomId || ''}`;
      const existingIdx = seen.findIndex((s) => s.key === dupKey);
      if (existingIdx >= 0) {
        const origLineNum = seen[existingIdx].lineNum;
        const currLineNum = lineItems.findIndex((li) => li.key === item.key) + 1;
        errors.push(
          `Line items ${origLineNum} and ${currLineNum} are duplicates (same item, variant, and UOM)`
        );
      } else {
        seen.push({ key: dupKey, lineNum: lineItems.findIndex((li) => li.key === item.key) + 1 });
      }
    });

    return errors;
  };

  // Focus the first field that has an error
  const focusFirstErrorField = (errorMsg) => {
    const lower = errorMsg.toLowerCase();
    // Map error messages to form field IDs
    const fieldMap = [
      { match: 'supplier', field: 'supplierId' },
      { match: 'po date', field: 'poDate' },
      { match: 'delivery date', field: 'deliveryDate' },
      { match: 'terms', field: 'termsConditionId' },
      { match: 'remarks', field: 'remarks' },
    ];

    for (const { match, field } of fieldMap) {
      if (lower.includes(match)) {
        // Scroll to and focus the AntD form field
        form.scrollToField(field, { behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const el = document.getElementById(field);
          if (el) el.focus();
        }, 300);
        return;
      }
    }

    // Check for line item errors - scroll to the line items table
    if (lower.includes('line item')) {
      const tableEl = document.querySelector('.ant-table-wrapper');
      if (tableEl) {
        tableEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Build API payload
  const buildPayload = (status) => {
    const values = form.getFieldsValue();
    const supplier = suppliersList.find((s) => s.id === values.supplierId);
    const terms = termsConditionsList.find(
      (t) => t.id === values.termsConditionId
    );

    const validItems = lineItems.filter((item) => item.itemId);
    const isIgst = supplier?.igstApplicable || false;

    // Determine line item status based on PO status
    const lineItemStatus =
      status === PO_STATUS.PENDING_APPROVAL
        ? LINE_ITEM_STATUS.IN_PROGRESS
        : status === PO_STATUS.CANCELLED
          ? LINE_ITEM_STATUS.CANCELLED
          : LINE_ITEM_STATUS.DRAFT;

    return {
      supplierId: values.supplierId,
      supplierName: supplier?.name || '',
      poDate: values.poDate?.format('YYYY-MM-DD'),
      deliveryDate: values.deliveryDate?.format('YYYY-MM-DD'),
      termsConditionsId: values.termsConditionId || null,
      termsConditionsTitle: terms?.name || '',
      remarks: values.remarks || '',
      status,
      subtotal: totals.subtotal,
      tax: isIgst ? totals.igst : totals.sgst + totals.cgst,
      sgstValue: isIgst ? null : totals.sgst,
      cgstValue: isIgst ? null : totals.cgst,
      igstValue: isIgst ? totals.igst : null,
      grandTotal: totals.grandTotal,
      lineItems: validItems.map((item) => {
        const qty = parseFloat(item.qty) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const gstPercent = parseFloat(item.gstPercent) || 0;
        const taxableBase = qty * unitPrice;

        let cgst = 0,
          sgst = 0,
          igst = 0;
        let cgstValue = 0,
          sgstValue = 0,
          igstValue = 0;

        if (isIgst) {
          igst = gstPercent;
          igstValue = parseFloat(((taxableBase * gstPercent) / 100).toFixed(2));
        } else {
          const halfGst = gstPercent / 2;
          cgst = halfGst;
          sgst = halfGst;
          cgstValue = parseFloat(((taxableBase * halfGst) / 100).toFixed(2));
          sgstValue = parseFloat(((taxableBase * halfGst) / 100).toFixed(2));
        }

        const taxValue = parseFloat((cgstValue + sgstValue + igstValue).toFixed(2));

        return {
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          description: item.description,
          quantity: qty,
          uomId: item.uomId,
          uomName: item.uom,
          unitPrice,
          cgst: isIgst ? null : cgst,
          sgst: isIgst ? null : sgst,
          igst: isIgst ? igst : null,
          cgstValue: isIgst ? null : cgstValue,
          sgstValue: isIgst ? null : sgstValue,
          igstValue: isIgst ? igstValue : null,
          taxValue,
          totalAmount: item.amount,
          variantId: item.variantId,
          variantAttributes: item.variantAttributes,
          status: lineItemStatus,
        };
      }),
    };
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    // For draft, validate all fields
    const errors = validateForm(false);
    if (errors.length > 0) {
      message.error(errors[0], 5);
      focusFirstErrorField(errors[0]);
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload(PO_STATUS.DRAFT);

      const currentUser = getCurrentUser();
      const userName = currentUser?.name || currentUser?.username || 'User';

      if (isEditMode) {
        await updatePurchaseOrder(id, payload);

        // Activity log for re-saving rejected/referred-back POs
        const previousStatus = originalPO?.status;
        if (previousStatus === PO_STATUS.REJECTED || previousStatus === PO_STATUS.REFERRED_BACK) {
          await createActivity(id, {
            comment: `PO saved as draft by ${userName}. Previous status: ${previousStatus}`,
            status: PO_STATUS.DRAFT,
            isSystemGenerated: true,
          });
        }

        message.success('Purchase order saved as draft');
      } else {
        const createdPO = await createPurchaseOrder(payload);

        // Activity log for new draft
        if (createdPO?.id) {
          await createActivity(createdPO.id, {
            comment: `PO created as draft by ${userName}`,
            status: PO_STATUS.DRAFT,
            isSystemGenerated: true,
          });
        }

        message.success('Purchase order created as draft');
      }
      setIsDirty(false);
      navigate('/purchase-orders/list');
    } catch {
      message.error('Failed to save purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit for Approval - show preview first
  const handleSubmitClick = async () => {
    const errors = validateForm(true);
    if (errors.length > 0) {
      message.error(errors[0], 5);
      focusFirstErrorField(errors[0]);
      return;
    }

    // Validate Ant form fields
    try {
      await form.validateFields();
    } catch {
      return;
    }

    // Build preview data and show preview
    const supplier = suppliersList.find((s) => s.id === form.getFieldValue('supplierId'));
    const terms = termsConditionsList.find(
      (t) => t.id === form.getFieldValue('termsConditionId')
    );

    setPreviewData({
      supplierDisplay: supplier?.name || '',
      supplierGstin: supplier?.gstin || '',
      supplierCity: supplier?.city || '',
      supplierState: supplier?.state || '',
      termsDisplay: terms?.name || '',
      poDateDisplay: form.getFieldValue('poDate')?.format('DD-MMM-YYYY'),
      deliveryDateDisplay: form.getFieldValue('deliveryDate')?.format('DD-MMM-YYYY'),
      remarks: form.getFieldValue('remarks') || '',
      lineItemsDisplay: lineItems.filter((item) => item.itemId),
      totals,
      gstBreakup,
      isIgstApplicable,
    });
    setPreviewVisible(true);
  };

  // Confirm submit from preview
  const handleConfirmSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = buildPayload(PO_STATUS.PENDING_APPROVAL);
      let result;
      if (isEditMode) {
        result = await updatePurchaseOrder(id, payload);
      } else {
        result = await createPurchaseOrder(payload);
      }

      // Create system activity log
      const currentUser = getCurrentUser();
      const userName = currentUser?.name || currentUser?.username || 'User';
      const poId = result?.id || id;

      if (poId) {
        const previousStatus = originalPO?.status;
        if (isEditMode && (previousStatus === PO_STATUS.REJECTED || previousStatus === PO_STATUS.REFERRED_BACK)) {
          await createActivity(poId, {
            comment: `PO re-submitted for approval by ${userName}. Previous status: ${previousStatus}`,
            status: PO_STATUS.PENDING_APPROVAL,
            isSystemGenerated: true,
          });
        } else {
          await createActivity(poId, {
            comment: `PO submitted for approval by ${userName}`,
            status: PO_STATUS.PENDING_APPROVAL,
            isSystemGenerated: true,
          });
        }
      }

      message.success('Purchase order submitted for approval');
      setIsDirty(false);
      setPreviewVisible(false);
      navigate('/purchase-orders/list');
    } catch {
      message.error('Failed to submit purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  // Unsaved changes warning
  const handleGoBack = () => {
    if (isDirty) {
      Modal.confirm({
        title: 'Unsaved Changes',
        icon: <ExclamationCircleOutlined />,
        content: 'You have unsaved changes. Are you sure you want to leave?',
        okText: 'Leave',
        cancelText: 'Stay',
        onOk: () => navigate('/purchase-orders/list'),
      });
    } else {
      navigate('/purchase-orders/list');
    }
  };

  // Date disabled functions
  const disabledPoDate = (current) => {
    // For new POs, disable dates before today
    if (!isEditMode) {
      return current && current < dayjs().startOf('day');
    }
    return false;
  };

  const disabledDeliveryDate = (current) => {
    const poDate = form.getFieldValue('poDate');
    const tomorrow = dayjs().add(1, 'day').startOf('day');
    // Must be after today and after PO date
    if (current && current < tomorrow) return true;
    if (current && poDate && current <= poDate) return true;
    return false;
  };

  // Build UOM options for a line item
  const getUomOptions = (record) => {
    const opts = [];
    const primaryId = record.primaryUomId ?? record.uomId;
    const primaryName = record.primaryUom ?? record.uom;
    const secondaryId = record.secondaryUomId;
    const secondaryName = record.secondaryUom;

    if (primaryId && primaryName) {
      opts.push({ value: primaryId, label: primaryName.toUpperCase() });
    }
    if (secondaryId && secondaryName && secondaryId !== primaryId) {
      opts.push({ value: secondaryId, label: secondaryName.toUpperCase() });
    }
    // Fallback
    if (opts.length === 0 && (record.uom || record.primaryUom)) {
      const fallbackName = record.uom || record.primaryUom;
      opts.push({
        value: record.uomId || fallbackName,
        label: fallbackName.toUpperCase(),
      });
    }
    return opts;
  };

  // Line items table columns
  const lineColumns = [
    {
      title: '#',
      width: 45,
      align: 'center',
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Item',
      dataIndex: 'itemId',
      width: 220,
      render: (_, record) => (
        <ItemSearchInput
          value={
            record.itemCode || record.itemName
              ? `${record.itemCode || ''} - ${record.itemName || ''}`
              : ''
          }
          onSelect={(item) => handleItemSelect(item, record.key)}
          onChange={(val) => {
            if (!val) {
              // Clear all fields when item is cleared
              setLineItems((prev) =>
                prev.map((li) =>
                  li.key === record.key
                    ? {
                        ...createEmptyLineItem(),
                        key: record.key,
                      }
                    : li
                )
              );
            }
          }}
          disabled={submitting}
        />
      ),
    },
    {
      title: 'Variant',
      width: 130,
      render: (_, record) => {
        if (!record.variantId) {
          return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
        }
        const attrs = record.variantAttributes || {};
        const hasMultipleVariants =
          itemsWithVariants[record.itemId]?.variants?.length > 1;

        return (
          <div
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              gap: 4,
              alignItems: 'center',
              cursor: hasMultipleVariants ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (hasMultipleVariants && !submitting) {
                handleChangeVariant(record.key, record.itemId);
              }
            }}
            title={hasMultipleVariants ? 'Click to change variant' : ''}
          >
            {Object.entries(attrs).length > 0 ? (
              <>
                {Object.entries(attrs)
                  .slice(0, 2)
                  .map(([key, val]) => {
                    const kLower = key.toLowerCase();
                    const isColorAttr = kLower.includes('color') || kLower.includes('colour');
                    const showSwatch = isColorAttr && isPantoneCode(val);
                    return (
                      <Tag key={key} style={{ fontSize: 11, margin: 0, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        {showSwatch && <PantoneColorSwatch value={val} size={14} />}
                        {showSwatch ? (val.split('/')[0]?.trim() || val) : val}
                      </Tag>
                    );
                  })}
                {Object.entries(attrs).length > 2 && (
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    +{Object.entries(attrs).length - 2}
                  </Text>
                )}
                {hasMultipleVariants && (
                  <EditOutlined style={{ fontSize: 11, color: 'var(--primary-color)' }} />
                )}
              </>
            ) : (
              <Text type="secondary" style={{ fontSize: 11 }}>
                Default
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      width: 180,
      render: (value, record) => (
        <Input
          placeholder="Description"
          value={value}
          onChange={(e) =>
            handleLineItemChange(record.key, 'description', e.target.value)
          }
          disabled={submitting || !record.itemId}
        />
      ),
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      width: 100,
      render: (value, record) => (
        <InputNumber
          min={0}
          step={1}
          precision={2}
          style={{ width: '100%', height: 40 }}
          value={value === '' ? null : Number(value)}
          onChange={(v) =>
            handleLineItemChange(record.key, 'qty', v !== null ? String(v) : '')
          }
          disabled={submitting || !record.itemId}
          placeholder="0"
        />
      ),
    },
    {
      title: 'UOM',
      dataIndex: 'uomId',
      width: 110,
      render: (_, record) => {
        const uomOpts = getUomOptions(record);
        if (uomOpts.length === 0) {
          return <Text type="secondary">-</Text>;
        }
        if (uomOpts.length === 1) {
          return <Text>{uomOpts[0].label}</Text>;
        }
        return (
          <Select
            style={{ width: '100%' }}
            value={record.uomId || undefined}
            onChange={(val) => {
              const found = uomOpts.find((o) => o.value === val);
              handleLineItemChange(record.key, 'uomId', val);
              handleLineItemChange(record.key, 'uom', found?.label || '');
            }}
            options={uomOpts}
            disabled={submitting || !record.itemId}
          />
        );
      },
    },
    {
      title: 'Unit Price (₹)',
      dataIndex: 'unitPrice',
      width: 120,
      render: (value, record) => (
        <InputNumber
          min={0}
          step={0.01}
          precision={2}
          style={{ width: '100%', height: 40 }}
          value={value === '' ? null : Number(value)}
          onChange={(v) =>
            handleLineItemChange(
              record.key,
              'unitPrice',
              v !== null ? v : ''
            )
          }
          disabled={submitting || !record.itemId}
          placeholder="0.00"
        />
      ),
    },
    {
      title: 'GST %',
      dataIndex: 'gstPercent',
      width: 90,
      render: (value, record) => (
        <Select
          style={{ width: '100%' }}
          value={value}
          onChange={(v) => handleLineItemChange(record.key, 'gstPercent', v)}
          options={TAX_OPTIONS}
          disabled={submitting || !record.itemId}
        />
      ),
    },
    ...(isIgstApplicable
      ? [
          {
            title: 'IGST',
            width: 100,
            align: 'right',
            render: (_, record) => {
              const base =
                (parseFloat(record.qty) || 0) * (parseFloat(record.unitPrice) || 0);
              const gst = (base * (parseFloat(record.gstPercent) || 0)) / 100;
              return <Text>₹ {gst.toFixed(2)}</Text>;
            },
          },
        ]
      : [
          {
            title: 'SGST',
            width: 90,
            align: 'right',
            render: (_, record) => {
              const base =
                (parseFloat(record.qty) || 0) * (parseFloat(record.unitPrice) || 0);
              const gst =
                (base * (parseFloat(record.gstPercent) || 0)) / 100 / 2;
              return <Text>₹ {gst.toFixed(2)}</Text>;
            },
          },
          {
            title: 'CGST',
            width: 90,
            align: 'right',
            render: (_, record) => {
              const base =
                (parseFloat(record.qty) || 0) * (parseFloat(record.unitPrice) || 0);
              const gst =
                (base * (parseFloat(record.gstPercent) || 0)) / 100 / 2;
              return <Text>₹ {gst.toFixed(2)}</Text>;
            },
          },
        ]),
    {
      title: 'Amount (₹)',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: (value) => (
        <Text strong style={{ color: 'var(--success-color)' }}>
          ₹ {(value || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '',
      width: 50,
      render: (_, record) => (
        <Popconfirm
          title="Remove this line item?"
          onConfirm={() => removeLineItem(record.key)}
          disabled={lineItems.length === 1}
        >
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            size="small"
            disabled={lineItems.length === 1 || submitting}
          />
        </Popconfirm>
      ),
    },
  ];

  if (pageLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <div className="page-header" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={handleGoBack} />
          <h1>{isEditMode ? 'Edit Purchase Order' : 'Create Purchase Order'}</h1>
        </Space>
        <div className="header-actions">
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveDraft}
            loading={submitting}
          >
            Save as Draft
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSubmitClick}
            loading={submitting}
          >
            Submit for Approval
          </Button>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          poDate: dayjs(),
        }}
        onValuesChange={() => setIsDirty(true)}
      >
        <Row gutter={24}>
          {/* PO Details */}
          <Col xs={24} lg={16}>
            <Card style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 24 }}>
                Purchase Order Details
              </Title>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="supplierId"
                    label="Supplier"
                    rules={[{ required: true, message: 'Please select a supplier' }]}
                  >
                    <Select
                      placeholder="Search and select supplier"
                      showSearch
                      filterOption={(input, option) =>
                        (option?.label || '')
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                      onChange={handleSupplierChange}
                      options={suppliersList.map((s) => ({
                        value: s.id,
                        label: `${s.name}${s.code ? ` (${s.code})` : ''}`,
                      }))}
                      loading={suppliersList.length === 0}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="poDate"
                    label="PO Date"
                    rules={[{ required: true, message: 'PO Date is required' }]}
                  >
                    <DatePicker
                      style={{ width: '100%', height: 40 }}
                      format="DD-MMM-YYYY"
                      disabledDate={disabledPoDate}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="termsConditionId"
                    label="Terms & Conditions"
                    rules={[{ required: true, message: 'Terms & Conditions is required' }]}
                  >
                    <Select
                      placeholder="Select terms & conditions"
                      showSearch
                      allowClear
                      filterOption={(input, option) =>
                        (option?.label || '')
                          .toLowerCase()
                          .includes(input.toLowerCase())
                      }
                      options={termsConditionsList.map((t) => ({
                        value: t.id,
                        label: t.name,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="deliveryDate"
                    label="Expected Delivery Date"
                    rules={[{ required: true, message: 'Delivery date is required' }]}
                  >
                    <DatePicker
                      style={{ width: '100%', height: 40 }}
                      format="DD-MMM-YYYY"
                      disabledDate={disabledDeliveryDate}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={24}>
                <Col xs={24}>
                  <Form.Item name="remarks" label="Remarks">
                    <TextArea
                      rows={3}
                      placeholder="Additional notes (max 500 chars)"
                      maxLength={500}
                      showCount
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Supplier Info */}
          <Col xs={24} lg={8}>
            <Card style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 16 }}>
                Supplier Information
              </Title>
              {selectedSupplier ? (
                <Descriptions size="small" column={1}>
                  <Descriptions.Item label="Name">
                    {selectedSupplier.name}
                  </Descriptions.Item>
                  {selectedSupplier.gstin && (
                    <Descriptions.Item label="GSTIN">
                      {selectedSupplier.gstin}
                    </Descriptions.Item>
                  )}
                  {selectedSupplier.email && (
                    <Descriptions.Item label="Email">
                      {selectedSupplier.email}
                    </Descriptions.Item>
                  )}
                  {selectedSupplier.phone && (
                    <Descriptions.Item label="Phone">
                      {selectedSupplier.phone}
                    </Descriptions.Item>
                  )}
                  {(selectedSupplier.city || selectedSupplier.state) && (
                    <Descriptions.Item label="Location">
                      {[selectedSupplier.city, selectedSupplier.state]
                        .filter(Boolean)
                        .join(', ')}
                    </Descriptions.Item>
                  )}
                  <Descriptions.Item label="IGST Applicable">
                    <Tag color={isIgstApplicable ? 'blue' : 'default'}>
                      {isIgstApplicable ? 'Yes' : 'No'}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">Select a supplier to view details</Text>
              )}
            </Card>
          </Col>
        </Row>

        {/* Line Items */}
        <Card style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Title level={5} style={{ margin: 0 }}>
              Line Items
            </Title>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={addLineItem}
              disabled={submitting}
            >
              Add Item
            </Button>
          </div>
          <Table
            columns={lineColumns}
            dataSource={lineItems}
            pagination={false}
            scroll={{ x: 1400 }}
            size="middle"
            rowKey="key"
          />
        </Card>

        {/* Order Summary */}
        <Row gutter={24}>
          <Col xs={24} md={12}>
            {/* Empty space or future content */}
          </Col>
          <Col xs={24} md={12}>
            <Card>
              <Title level={5} style={{ marginBottom: 16 }}>
                Order Summary
              </Title>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Subtotal:</Text>
                  <Text strong>₹ {totals.subtotal.toFixed(2)}</Text>
                </div>

                {/* GST Breakup */}
                {gstBreakup.length > 0 && (
                  <>
                    <Divider style={{ margin: '4px 0' }} />
                    <Text strong style={{ color: 'var(--primary-color)', fontSize: 12 }}>
                      GST BREAKUP
                    </Text>
                    {gstBreakup.map((group) => (
                      <div key={group.percent} style={{ paddingLeft: 12 }}>
                        <Text
                          type="secondary"
                          style={{ fontSize: 12, display: 'block' }}
                        >
                          GST @ {group.percent}%
                        </Text>
                        {isIgstApplicable ? (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              paddingLeft: 12,
                            }}
                          >
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              IGST ({group.percent}%)
                            </Text>
                            <Text style={{ fontSize: 12 }}>
                              ₹ {group.igst.toFixed(2)}
                            </Text>
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                paddingLeft: 12,
                              }}
                            >
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                SGST ({group.percent / 2}%)
                              </Text>
                              <Text style={{ fontSize: 12 }}>
                                ₹ {group.sgst.toFixed(2)}
                              </Text>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                paddingLeft: 12,
                              }}
                            >
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                CGST ({group.percent / 2}%)
                              </Text>
                              <Text style={{ fontSize: 12 }}>
                                ₹ {group.cgst.toFixed(2)}
                              </Text>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </>
                )}

                <Divider style={{ margin: '4px 0' }} />

                {isIgstApplicable ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Text>Total IGST:</Text>
                    <Text>₹ {totals.igst.toFixed(2)}</Text>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Total SGST:</Text>
                      <Text>₹ {totals.sgst.toFixed(2)}</Text>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text>Total CGST:</Text>
                      <Text>₹ {totals.cgst.toFixed(2)}</Text>
                    </div>
                  </>
                )}

                <Divider style={{ margin: '8px 0' }} />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px',
                    borderRadius: 8,
                    background: 'var(--primary-color)',
                  }}
                >
                  <Text strong style={{ color: '#fff', fontSize: 16 }}>
                    Grand Total
                  </Text>
                  <Text strong style={{ color: '#fff', fontSize: 20 }}>
                    ₹ {totals.grandTotal.toFixed(2)}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      </Form>

      {/* Preview Dialog */}
      <Modal
        title="Purchase Order Preview"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        width={900}
        footer={[
          <Button key="back" onClick={() => setPreviewVisible(false)}>
            Go Back & Edit
          </Button>,
          <Button
            key="submit"
            type="primary"
            icon={<SendOutlined />}
            loading={submitting}
            onClick={handleConfirmSubmit}
          >
            Confirm & Submit
          </Button>,
        ]}
      >
        {previewData && (
          <div>
            {/* Supplier & Header Info */}
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
              <Descriptions.Item label="Supplier">
                <Text strong>{previewData.supplierDisplay}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="PO Date">
                {previewData.poDateDisplay}
              </Descriptions.Item>
              {previewData.supplierGstin && (
                <Descriptions.Item label="Supplier GSTIN">
                  {previewData.supplierGstin}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Expected Delivery Date">
                {previewData.deliveryDateDisplay}
              </Descriptions.Item>
              {(previewData.supplierCity || previewData.supplierState) && (
                <Descriptions.Item label="Supplier Location">
                  {[previewData.supplierCity, previewData.supplierState]
                    .filter(Boolean)
                    .join(', ')}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Terms & Conditions">
                {previewData.termsDisplay || 'Not specified'}
              </Descriptions.Item>
              {previewData.remarks && (
                <Descriptions.Item label="Remarks" span={2}>
                  {previewData.remarks}
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Tax Type">
                <Tag color={previewData.isIgstApplicable ? 'blue' : 'green'}>
                  {previewData.isIgstApplicable ? 'IGST' : 'SGST / CGST'}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {/* Line Items */}
            <Title level={5} style={{ marginBottom: 12 }}>
              Line Items ({previewData.lineItemsDisplay.length})
            </Title>
            <Table
              dataSource={previewData.lineItemsDisplay}
              size="small"
              pagination={false}
              rowKey="key"
              scroll={{ x: 900 }}
              columns={[
                {
                  title: '#',
                  width: 40,
                  render: (_, __, i) => i + 1,
                },
                {
                  title: 'Item',
                  render: (_, r) => (
                    <div>
                      <Text strong>{r.itemName}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {r.itemCode}
                      </Text>
                      {r.variantAttributes &&
                        Object.keys(r.variantAttributes).length > 0 && (
                          <div style={{ marginTop: 4 }}>
                            {Object.entries(r.variantAttributes).map(([k, v]) => {
                              const kLower = k.toLowerCase();
                              const isColorAttr = kLower.includes('color') || kLower.includes('colour');
                              const showSwatch = isColorAttr && isPantoneCode(v);
                              return (
                                <Tag
                                  key={k}
                                  style={{ fontSize: 10, margin: '0 4px 2px 0', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                >
                                  {showSwatch && <PantoneColorSwatch value={v} size={14} />}
                                  {k}: {showSwatch ? (v.split('/')[0]?.trim() || v) : v}
                                </Tag>
                              );
                            })}
                          </div>
                        )}
                    </div>
                  ),
                },
                { title: 'Qty', dataIndex: 'qty', width: 70, align: 'center' },
                { title: 'UOM', dataIndex: 'uom', width: 80 },
                {
                  title: 'Unit Price',
                  dataIndex: 'unitPrice',
                  width: 100,
                  align: 'right',
                  render: (v) => `₹ ${parseFloat(v || 0).toFixed(2)}`,
                },
                {
                  title: 'GST %',
                  dataIndex: 'gstPercent',
                  width: 70,
                  align: 'center',
                  render: (v) => `${v}%`,
                },
                {
                  title: 'Amount',
                  dataIndex: 'amount',
                  width: 110,
                  align: 'right',
                  render: (v) => (
                    <Text strong>₹ {(v || 0).toFixed(2)}</Text>
                  ),
                },
              ]}
            />

            {/* Totals */}
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <div style={{ width: 350 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 8,
                  }}
                >
                  <Text>Subtotal:</Text>
                  <Text strong>₹ {previewData.totals.subtotal.toFixed(2)}</Text>
                </div>

                {/* GST Breakup in preview */}
                {previewData.gstBreakup?.length > 0 &&
                  previewData.gstBreakup.map((group) => (
                    <div key={group.percent} style={{ paddingLeft: 8, marginBottom: 4 }}>
                      {previewData.isIgstApplicable ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            IGST @ {group.percent}%
                          </Text>
                          <Text style={{ fontSize: 12 }}>₹ {group.igst.toFixed(2)}</Text>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              SGST @ {group.percent / 2}%
                            </Text>
                            <Text style={{ fontSize: 12 }}>₹ {group.sgst.toFixed(2)}</Text>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              CGST @ {group.percent / 2}%
                            </Text>
                            <Text style={{ fontSize: 12 }}>₹ {group.cgst.toFixed(2)}</Text>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                <Divider style={{ margin: '8px 0' }} />

                {previewData.isIgstApplicable ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <Text>Total IGST:</Text>
                    <Text>₹ {previewData.totals.igst.toFixed(2)}</Text>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 4,
                      }}
                    >
                      <Text>Total SGST:</Text>
                      <Text>₹ {previewData.totals.sgst.toFixed(2)}</Text>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                      }}
                    >
                      <Text>Total CGST:</Text>
                      <Text>₹ {previewData.totals.cgst.toFixed(2)}</Text>
                    </div>
                  </>
                )}

                <Divider style={{ margin: '8px 0' }} />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'var(--primary-color)',
                  }}
                >
                  <Text strong style={{ color: '#fff' }}>
                    Grand Total
                  </Text>
                  <Text strong style={{ color: '#fff', fontSize: 18 }}>
                    ₹ {previewData.totals.grandTotal.toFixed(2)}
                  </Text>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Variant Selection Modal */}
      <VariantSelectionModal
        open={variantModalState.show}
        item={variantModalState.pendingItem}
        onSelect={handleVariantSelect}
        currentVariantId={variantModalState.currentVariantId || null}
      />
    </div>
  );
};

export default POForm;
