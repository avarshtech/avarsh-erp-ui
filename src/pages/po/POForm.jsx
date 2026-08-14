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
  App,
  Popconfirm,
  Divider,
  Spin,
  Skeleton,
  Modal,
  Tag,
  Descriptions,
  AutoComplete,
  Segmented,
  Popover,
} from 'antd';
import { numericInputProps } from '../../utils/inputHelpers';
import {
  PlusOutlined,
  DeleteOutlined,
  SendOutlined,
  ExclamationCircleOutlined,
  EditOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { ActionButton } from '../../components/buttons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrder,
  createActivity,
} from '../../services/po/purchaseOrderService';
import { getAllTermsConditions } from '../../services/master/termsConditionsService';
import { getSuppliers } from '../../services/master/supplierService';
import { autocompleteItems, getItemsByIds } from '../../services/master/itemService';
import { useStore } from '../../context/StoreContext';
import { getCurrentUser, hasPermission } from '../../utils/permissions';
import { PO_STATUS, LINE_ITEM_STATUS, PO_TYPE, PO_TYPE_OPTIONS, BOM_UNLOCK_STATUSES, EWAY_BILL_THRESHOLD } from '../../utils/poStatusConstants';
import { generateEwayBill } from '../../services/po/purchaseOrderService';
import { getBomByOrderNo, updateBomLinePoStatus } from '../../services/bom/bomService';
import BomLineSelectionDrawer from './BomLineSelectionDrawer';
import FabricStagesDialog from './FabricStagesDialog';
import PantoneColorSwatch from '../../components/PantoneColorSwatch';
import { isPantoneCode } from '../../services/core/pantoneService';
import { getFilesByEntity, downloadFileAsBlob } from '../../services/core/fileService';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';

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
  const lastQueryRef = useRef('');
  const noResultPrefixRef = useRef('');

  useEffect(() => {
    setSearchText(value || '');
  }, [value]);

  const handleSearch = (text) => {
    setSearchText(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text || text.length < 2) {
      setOptions([]);
      lastQueryRef.current = '';
      noResultPrefixRef.current = '';
      return;
    }

    // Reset no-result prefix on backspace/shortening
    const isShortening = text.length < lastQueryRef.current.length;
    if (isShortening && noResultPrefixRef.current) {
      if (text.length < noResultPrefixRef.current.length ||
          !text.toLowerCase().startsWith(noResultPrefixRef.current.toLowerCase())) {
        noResultPrefixRef.current = '';
      }
    }

    // Skip API call if extending a no-result prefix
    if (noResultPrefixRef.current &&
        text.toLowerCase().startsWith(noResultPrefixRef.current.toLowerCase())) {
      setOptions([]);
      lastQueryRef.current = text;
      return;
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
        lastQueryRef.current = text;
        if (items.length === 0) {
          noResultPrefixRef.current = text;
        } else {
          noResultPrefixRef.current = '';
        }
        setOptions(
          items.map((item) => ({
            value: `${item.itemCode || ''} - ${item.itemName || ''}`,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.itemCode || ''} - {item.itemName || ''}</span>
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
      centered
      closable={false}
      maskClosable={false}
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
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
  const prevIdRef = useRef(id);
  const [form] = Form.useForm();
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [pageLoading, setPageLoading] = useState(!!id);

  // Master data
  const [suppliersList, setSuppliersList] = useState([]);
  const [termsConditionsList, setTermsConditionsList] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Line items
  const [lineItems, setLineItems] = useState([createEmptyLineItem()]);

  // IGST applicability (determined by supplier)
  const [isIgstApplicable, setIsIgstApplicable] = useState(false);

  // Change detection for resubmit warning
  const [changeCheckLoading, setChangeCheckLoading] = useState(false);

  // Dirty state for unsaved changes warning
  const [isDirty, setIsDirtyState] = useState(false);
  const isDirtyRef = useRef(false);
  const setIsDirty = (val) => {
    isDirtyRef.current = val;
    setIsDirtyState(val);
  };

  const { clearDirty } = useUnsavedChanges(isDirty);

  // Variant modal state
  const [variantModalState, setVariantModalState] = useState({
    show: false,
    pendingItem: null,
    pendingLineKey: null,
    isChange: false,
    currentVariantId: null,
  });

  // Fabric processing stages dialog state
  const [stagesDialogState, setStagesDialogState] = useState({ open: false, lineKey: null });

  // Items with their variants (keyed by itemId) - used for variant column display
  const [itemsWithVariants, setItemsWithVariants] = useState({});

  // Variant images for line items { [variantId]: 'loading' | blobUrl }
  const [lineItemImages, setLineItemImages] = useState({});
  const loadedVariantIdsRef = useRef(new Set());
  const lineItemImagesRef = useRef({});

  // BOM-PO Integration state
  const [poType, setPoType] = useState(PO_TYPE.GENERAL);
  const [bomOrders, setBomOrders] = useState([]);
  const [bomLoading, setBomLoading] = useState(false);
  const [bomDrawerOpen, setBomDrawerOpen] = useState(false);

  // Original PO data for edit mode (to know previous status)
  const [originalPO, setOriginalPO] = useState(null);
  const [entityVersion, setEntityVersion] = useState(null);

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
      hsnCode: '',
      categoryName: '',
      processingStages: null,
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

  // If user navigates from Edit -> New (id changed from truthy to falsy), reset form and state
  useEffect(() => {
    const prev = prevIdRef.current;
    if (prev && !id) {
      // navigated from edit to new
      form.resetFields();
      setLineItems([createEmptyLineItem()]);
      setSelectedSupplier(null);
      setOriginalPO(null);
      setIsIgstApplicable(false);
      setVariantModalState({ show: false, pendingItem: null, pendingLineKey: null, isChange: false, currentVariantId: null });
      setItemsWithVariants({});
      setPoType(PO_TYPE.GENERAL);
      setBomOrders([]);
      setBomDrawerOpen(false);
      setIsDirty(false);
      // Clean up variant images
      Object.values(lineItemImagesRef.current).forEach((url) => {
        if (url && url !== 'loading') URL.revokeObjectURL(url);
      });
      setLineItemImages({});
      loadedVariantIdsRef.current.clear();
    }
    prevIdRef.current = id;
  }, [id, form]);

  // Keep lineItemImagesRef in sync with state for cleanup
  useEffect(() => {
    lineItemImagesRef.current = lineItemImages;
  }, [lineItemImages]);

  // Revoke blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(lineItemImagesRef.current).forEach((url) => {
        if (url && url !== 'loading') URL.revokeObjectURL(url);
      });
    };
  }, []);

  // Auto-load variant images whenever lineItems gains a new variantId
  useEffect(() => {
    lineItems.forEach((li) => {
      const vid = li.variantId;
      if (!vid || loadedVariantIdsRef.current.has(vid)) return;
      loadedVariantIdsRef.current.add(vid);
      (async () => {
        try {
          const files = await getFilesByEntity('ITEM_VARIANT', vid);
          const img = (files || []).find((f) => ['IMAGE', 'PHOTO'].includes(f.fileCategory));
          if (!img) return;
          setLineItemImages((prev) => ({ ...prev, [vid]: 'loading' }));
          const blob = await downloadFileAsBlob(img.fileId);
          const url = URL.createObjectURL(blob);
          setLineItemImages((prev) => ({ ...prev, [vid]: url }));
        } catch {
          loadedVariantIdsRef.current.delete(vid);
        }
      })();
    });
  }, [lineItems]);

  const loadMasterData = async () => {
    try {
      const [suppliersRes, termsRes] = await Promise.all([
        getSuppliers(),
        getAllTermsConditions(),
      ]);

      const suppData = suppliersRes?.data?.content || suppliersRes?.data || suppliersRes?.content || suppliersRes || [];
      const termsData = termsRes?.content || termsRes?.data || termsRes || [];

      setSuppliersList(Array.isArray(suppData) ? suppData : []);
      setTermsConditionsList(Array.isArray(termsData) ? termsData : []);

      // If we're in edit mode and the original PO was already loaded,
      // ensure the supplier is selected from the freshly loaded suppliers list.
      if (isEditMode && originalPO && originalPO.supplierId) {
        const supId = originalPO.supplierId;
        const matched = (Array.isArray(suppData) ? suppData : []).find((s) => Number(s.id) === Number(supId));
        if (matched) {
          setSelectedSupplier(matched);
          setIsIgstApplicable(matched?.igstApplicable || false);
          // Re-set the form value to the exact supplier id/type present in suppliers list
          form.setFieldsValue({ supplierId: matched.id });
        }
      }
    } catch {
      message.error('Failed to load master data');
    }
  };

  const loadPOData = async () => {
    setPageLoading(true);
    try {
      const data = await getPurchaseOrderById(id);
      setOriginalPO(data);
      setEntityVersion(data.version);

      // Set form fields
      form.setFieldsValue({
        supplierId: data.supplierId,
        poDate: data.poDate ? dayjs(data.poDate) : null,
        deliveryDate: data.deliveryDate ? dayjs(data.deliveryDate) : null,
        termsConditionId: data.termsConditionsId || data.termsConditionId,
        remarks: data.remarks || '',
      });

      // If suppliers list is already loaded, set selected supplier immediately
      const supplierIdFromPO = data.supplierId ?? data.supplier?.id ?? null;
      if (supplierIdFromPO && suppliersList.length > 0) {
        const sup = suppliersList.find((s) => Number(s.id) === Number(supplierIdFromPO));
        if (sup) {
          setSelectedSupplier(sup || null);
          setIsIgstApplicable(sup?.igstApplicable || false);
          // Ensure the form value matches the suppliers list id/type
          form.setFieldsValue({ supplierId: sup.id });
        }
      }
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

      // Restore PO type
      setPoType(data.poType || PO_TYPE.GENERAL);

      if (data.orderReferences && data.orderReferences.length > 0) {
        // Fetch BOM data for each order reference
        const bomPromises = data.orderReferences.map(async (ref) => {
          try {
            const bom = await getBomByOrderNo(ref.orderNo);
            return {
              orderNo: ref.orderNo,
              orderId: ref.orderId,
              bomId: ref.bomId,
              styleId: ref.styleId,
              styleName: ref.styleName,
              season: ref.season,
              orderQty: bom?.orderQty || null,
              bomLines: bom?.lines || [],
            };
          } catch {
            return { ...ref, bomLines: [] };
          }
        });
        const orders = await Promise.all(bomPromises);
        setBomOrders(orders);
      }

      // Map line items
      const mappedItems = (data.lineItems || []).map((item) => ({
        key: String(item.id || Date.now()) + Math.random(),
        itemId: item.itemId || '',
        itemCode: item.itemCode || '',
        itemName: item.itemName || '',
        description: item.description || '',
        qty: String(item.quantity || item.qty || ''),
        uom: item.uomSymbol || item.uom || '',
        uomId: item.uomId || null,
        primaryUom: item.uomSymbol || '',
        primaryUomId: item.uomId || null,
        secondaryUom: item.secondaryUomSymbol || '',
        secondaryUomId: item.secondaryUomId || null,
        unitPrice: item.unitPrice || 0,
        gstPercent:
          item.gstPercent ||
          (item.cgst || 0) + (item.sgst || 0) ||
          item.igst ||
          0,
        amount: item.totalAmount || item.amount || 0,
        variantId: item.variantId || null,
        variantName: item.variantName || '',
        variantCode: item.variantCode || '',
        variantAttributes: item.variantAttributes || null,
        hsnCode: item.hsnCode || '',
        categoryName: item.categoryName || '',
        processingStages: item.processingStages || null,
        bomLineSources: item.bomLineSources || null,
        _fromBom: !!(item.bomLineSources && item.bomLineSources.length > 0),
        status: item.status || null,
      }));

      setLineItems(mappedItems.length > 0 ? mappedItems : [createEmptyLineItem()]);
    } catch {
      message.error('Failed to load purchase order');
      navigate('/purchase-orders/list');
    } finally {
      // Defer so React paints the form with populated values before hiding the skeleton
      requestAnimationFrame(() => setPageLoading(false));
    }
  };

  // Reload supplier info when suppliers list loads (for edit mode)
  useEffect(() => {
    if (isEditMode && suppliersList.length > 0) {
      // Prefer explicit form value; if missing, fall back to originalPO's supplier info
      const formSupplierId = form.getFieldValue('supplierId');
      const supplierId =
        formSupplierId ?? originalPO?.supplierId;
      if (supplierId) {
        const sup = suppliersList.find((s) => Number(s.id) === Number(supplierId));
        if (sup) {
          setSelectedSupplier(sup);
          setIsIgstApplicable(sup?.igstApplicable || false);
          // Re-set form value with the exact type from suppliers list so Select matches
          form.setFieldsValue({ supplierId: sup.id });
        }
      }
    }
  }, [suppliersList, isEditMode, form, originalPO]);

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
              uom: item.uomSymbol || '',
              uomId: item.uomId || null,
              primaryUom: item.uomSymbol || '',
              primaryUomId: item.uomId || null,
              secondaryUom: item.secondaryUomSymbol || '',
              secondaryUomId: item.secondaryUomId || null,
              unitPrice,
              gstPercent: gst,
              variantId: variant?.id || null,
              variantName: variant?.variantName || '',
              variantCode: variant?.variantCode || '',
              variantAttributes: variant?.attributes || null,
              hsnCode: item.hsnCode || '',
              categoryName: item.categoryName || '',
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

  // PO Type change handler
  const handlePoTypeChange = useCallback((newType) => {
    const hasData = lineItems.length > 1 || (lineItems.length === 1 && lineItems[0].itemId);
    if (hasData) {
      modal.confirm({
        title: 'Change PO Type',
        content: 'Changing PO type will clear all line items. Continue?',
        okText: 'Yes, Change',
        cancelText: 'Cancel',
        onOk: () => {
          setPoType(newType);
          setBomOrders([]);
          setLineItems([createEmptyLineItem()]);
          setIsDirty(true);
        },
      });
    } else {
      setPoType(newType);
      setBomOrders([]);
      setLineItems([createEmptyLineItem()]);
    }
  }, [lineItems]);

  // BOM Fetch handler
  const handleFetchBom = useCallback(async (orderNo) => {
    if (!orderNo || !orderNo.trim()) {
      message.warning('Please enter an order number');
      return;
    }
    const trimmedOrderNo = orderNo.trim();

    // Check for duplicate in Combined mode
    if (poType === PO_TYPE.COMBINED && bomOrders.some(o => o.orderNo === trimmedOrderNo)) {
      message.warning('This order has already been added');
      return;
    }

    setBomLoading(true);
    try {
      const bom = await getBomByOrderNo(trimmedOrderNo);
      if (!bom || !bom.lines || bom.lines.length === 0) {
        message.error('No BOM found for order ' + trimmedOrderNo + ', or BOM has no lines');
        return;
      }

      if (bom.status === 'DRAFT') {
        message.error('BOM for order ' + trimmedOrderNo + ' is still in Draft status. Only Created BOMs can be used for PO.');
        return;
      }

      // Combined PO: validate same buyer across all orders
      if (poType === PO_TYPE.COMBINED && bomOrders.length > 0 && bom.buyerId) {
        const existingBuyerId = bomOrders[0].buyerId;
        const existingBuyerName = bomOrders[0].buyerName;
        if (existingBuyerId && bom.buyerId !== existingBuyerId) {
          message.error(
            `Cannot combine orders from different buyers. Existing orders belong to "${existingBuyerName || 'Buyer #' + existingBuyerId}",` +
            ` but order ${trimmedOrderNo} belongs to "${bom.buyerName || 'Buyer #' + bom.buyerId}".`
          );
          return;
        }
      }

      const orderData = {
        orderNo: bom.orderNo || trimmedOrderNo,
        orderId: bom.orderId,
        bomId: bom.id,
        styleId: bom.styleId,
        styleName: bom.styleName,
        season: bom.season,
        orderQty: bom.orderQty,
        buyerId: bom.buyerId,
        buyerName: bom.buyerName,
        bomLines: bom.lines,
      };

      if (poType === PO_TYPE.REGULAR) {
        setBomOrders([orderData]);
      } else {
        setBomOrders(prev => [...prev, orderData]);
      }
      message.success('BOM loaded for order ' + trimmedOrderNo);
    } catch (err) {
      if (err?.response?.status === 404) {
        message.error('No BOM found for order ' + trimmedOrderNo);
      } else {
        message.error('Failed to fetch BOM');
        console.error('BOM fetch error:', err);
      }
    } finally {
      setBomLoading(false);
    }
  }, [poType, bomOrders]);

  // Remove BOM order (for Combined PO)
  const removeOrder = useCallback((orderNo) => {
    setBomOrders(prev => prev.filter(o => o.orderNo !== orderNo));
    // Remove line items that came from this order's BOM
    setLineItems(prev => {
      const remaining = prev.filter(li => {
        if (!li.bomLineSources) return true;
        return !li.bomLineSources.every(src => {
          const order = bomOrders.find(o => o.bomId === src.bomId);
          return order && order.orderNo === orderNo;
        });
      });
      return remaining.length > 0 ? remaining : [createEmptyLineItem()];
    });
    setIsDirty(true);
  }, [bomOrders]);

  // BOM Line Selection confirm handler
  const handleBomLineSelectionConfirm = useCallback((selectedLines) => {
    // The PO is raised in the item's purchase (primary) UOM. BOM lines saved before UOM
    // conversion existed have no converted figure, so they fall back to the consumption UOM.
    const bomPurchaseQty = (bomLine) => bomLine.purchaseQtyPrimary ?? bomLine.purchaseQty ?? 0;
    const bomPurchaseUom = (bomLine) => bomLine.purchaseUom || bomLine.uom || '';
    // The BOM line carries the purchase UOM as a symbol only. Resolve it to the master
    // record so the saved line has a real uomId — without it the server persists no UOM
    // and every downstream read (PO view, GRN) shows a blank unit.
    const bomPurchaseUomId = (bomLine) => {
      const symbol = bomPurchaseUom(bomLine).trim().toLowerCase();
      if (!symbol) return null;
      const match = (uoms || []).find(
        (u) => (u.symbol || '').trim().toLowerCase() === symbol || (u.name || '').trim().toLowerCase() === symbol
      );
      return match?.id ?? null;
    };

    const createPoLineFromBom = (bomLine, bomId) => ({
      key: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      itemId: bomLine.itemId,
      itemCode: bomLine.itemCode,
      itemName: bomLine.itemName || '',
      description: [bomLine.categoryName, bomLine.subCategoryName].filter(Boolean).join(' - '),
      // The PO is raised in the BOM line's purchase UOM. When the item defines a UOM
      // conversion the BOM snapshots the converted quantity; otherwise both are the same.
      qty: String(bomPurchaseQty(bomLine)),
      uom: bomPurchaseUom(bomLine),
      uomId: bomPurchaseUomId(bomLine),
      primaryUom: '',
      primaryUomId: null,
      secondaryUom: '',
      secondaryUomId: null,
      unitPrice: '',
      gstPercent: 0,
      amount: 0,
      variantId: bomLine.variantId || null,
      variantName: bomLine.variantName || '',
      variantCode: bomLine.variantCode || '',
      variantAttributes: bomLine.variants || null,
      hsnCode: bomLine.hsnCode || '',
      categoryName: bomLine.categoryName || '',
      processingStages: null,
      bomLineSources: [{ bomId, lineId: bomLine.id }],
      _fromBom: true,
      status: LINE_ITEM_STATUS.DRAFT,
    });

    let newLines;
    if (poType === PO_TYPE.COMBINED) {
      // Merge duplicate item+variant+uom lines
      const mergeMap = new Map();
      selectedLines.forEach(({ bomLine, bomId }) => {
        // Group by the unit actually being purchased, so quantities only merge when comparable
        const key = `${bomLine.itemId}|${bomLine.variantId || 'null'}|${bomPurchaseUom(bomLine)}`;
        if (mergeMap.has(key)) {
          const existing = mergeMap.get(key);
          existing.qty = String(parseFloat(existing.qty || 0) + parseFloat(bomPurchaseQty(bomLine)));
          existing.bomLineSources.push({ bomId, lineId: bomLine.id });
        } else {
          mergeMap.set(key, createPoLineFromBom(bomLine, bomId));
        }
      });
      newLines = Array.from(mergeMap.values());

      // Check if any merging happened
      if (newLines.length < selectedLines.length) {
        message.info('Lines with same item+variant+UOM merged: quantities combined from multiple orders');
      }
    } else {
      newLines = selectedLines.map(({ bomLine, bomId }) => createPoLineFromBom(bomLine, bomId));
    }

    setLineItems(newLines);
    setIsDirty(true);
  }, [poType, uoms]);

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

    // BOM-PO type validations
    if (poType === PO_TYPE.REGULAR && bomOrders.length === 0) {
      errors.push('Please load a BOM by entering an order number');
    }
    if (poType === PO_TYPE.COMBINED && bomOrders.length < 2) {
      errors.push('Combined PO requires at least 2 orders');
    }

    // Line items validation
    const isBomPo = poType === PO_TYPE.REGULAR || poType === PO_TYPE.COMBINED;

    {
      // Standard PO validation
      const validItems = lineItems.filter((item) => item.itemId);
      if (validItems.length === 0) {
        errors.push('At least one line item with an item selected is required');
      }

      lineItems.forEach((item, idx) => {
        const lineNum = idx + 1;

        if (!item.itemId) {
          if (lineItems.length > 1 || validItems.length > 0) {
            errors.push(`Line item ${lineNum}: Item is required`);
          }
          return;
        }

        const qty = parseFloat(item.qty);
        const unitPrice = parseFloat(item.unitPrice);

        if (!item.description || !item.description.trim()) {
          errors.push(`Line item ${lineNum}: Description is required`);
        }

        if (isBomPo) {
          if (item.unitPrice === '' || isNaN(unitPrice) || unitPrice <= 0) {
            errors.push(`Line item ${lineNum}: Unit Price must be greater than 0`);
          }
        } else {
          if (item.qty === '' || isNaN(qty) || qty < 1) {
            errors.push(`Line item ${lineNum}: Quantity must be at least 1`);
          }
          if (isSubmit) {
            if (item.unitPrice === '' || isNaN(unitPrice) || unitPrice <= 0) {
              errors.push(`Line item ${lineNum}: Unit Price must be greater than 0`);
            }
          } else {
            if (item.unitPrice !== '' && !isNaN(unitPrice) && unitPrice < 0) {
              errors.push(`Line item ${lineNum}: Unit Price cannot be negative`);
            }
          }

        }
      });

      // Duplicate check — only for General PO
      if (poType === PO_TYPE.GENERAL) {
        const seen = [];
        const validItems2 = lineItems.filter((item) => item.itemId);
        validItems2.forEach((item) => {
          const variantKey = item.variantId
            ? String(item.variantId)
            : item.variantAttributes
              ? JSON.stringify(item.variantAttributes)
              : 'none';
          const dupKey = `${item.itemId}|${variantKey}`;
          const existingIdx = seen.findIndex((s) => s.key === dupKey);
          if (existingIdx >= 0) {
            const origLineNum = seen[existingIdx].lineNum;
            const currLineNum = lineItems.findIndex((li) => li.key === item.key) + 1;
            errors.push(
              `Line items ${origLineNum} and ${currLineNum} are duplicates (same item and variant)`
            );
          } else {
            seen.push({ key: dupKey, lineNum: lineItems.findIndex((li) => li.key === item.key) + 1 });
          }
        });
      }
    }

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
      version: entityVersion,
      poType: poType,
      orderReferences: poType !== PO_TYPE.GENERAL ? bomOrders.map(o => ({ orderId: o.orderId, orderNo: o.orderNo, bomId: o.bomId, styleId: o.styleId, styleName: o.styleName, season: o.season })) : null,
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
          hsnCode: item.hsnCode || null,
          categoryName: item.categoryName || null,
          processingStages: item.processingStages || null,
          bomLineSources: item.bomLineSources || null,
          status: lineItemStatus,
        };
      }),
    };
  };

  // Save as Draft
  const handleSaveDraft = async () => {
    if (isEditMode && !isDirty) {
      message.warning('No changes detected.');
      return;
    }
    // For draft, validate all fields
    const errors = validateForm(false);
    if (errors.length > 0) {
      errors.forEach((e) => message.error(e, 5));
      focusFirstErrorField(errors[0]);
      return;
    }

    setSavingDraft(true);
    try {
      const payload = buildPayload(PO_STATUS.DRAFT);

      const currentUser = getCurrentUser();
      const name = currentUser?.name || '';

      if (isEditMode) {
        const saved = await updatePurchaseOrder(id, payload);
        if (saved?.version != null) setEntityVersion(saved.version);

        // Activity log for re-saving rejected/referred-back POs
        const previousStatus = originalPO?.status;
        if (previousStatus === PO_STATUS.REJECTED || previousStatus === PO_STATUS.REFERRED_BACK) {
          await createActivity(id, {
            comment: `PO saved as draft by ${name}. Previous status: ${previousStatus}`,
            status: PO_STATUS.DRAFT,
            isSystemGenerated: true,
            name,
          });
        }

        message.success('Purchase order saved as draft');
      } else {
        const createdPO = await createPurchaseOrder(payload);
        if (createdPO?.version != null) setEntityVersion(createdPO.version);

        // Activity log for new draft
        if (createdPO?.id) {
          await createActivity(createdPO.id, {
            comment: `PO created as draft by ${name}`,
            status: PO_STATUS.DRAFT,
            isSystemGenerated: true,
            name,
          });
        }

        message.success('Purchase order created as draft');
      }
      setIsDirty(false);
      clearDirty();
      navigate('/purchase-orders/list');
    } catch {
      message.error('Failed to save purchase order');
    } finally {
      setSavingDraft(false);
    }
  };

  // Check if the PO has changes compared to the last submitted version
  const hasChangesFromLastVersion = async () => {
    if (!isEditMode || !id) return true; // new PO always has "changes"
    try {
      const { getPoLatestVersion } = await import('../../services/po/purchaseOrderService');
      const latest = await getPoLatestVersion(id);
      if (!latest?.snapshot) return true; // no previous version, treat as changed

      const snapshot = latest.snapshot;
      const currentPayload = buildPayload(PO_STATUS.PENDING_APPROVAL);

      // Compare key fields
      const fieldsToCompare = ['supplierId', 'deliveryDate', 'remarks', 'poType'];
      for (const field of fieldsToCompare) {
        if (String(currentPayload[field] ?? '') !== String(snapshot[field] ?? '')) return true;
      }

      // Compare line items
      const currentLines = currentPayload.lineItems || [];
      const snapshotLines = snapshot.lineItems || [];
      if (currentLines.length !== snapshotLines.length) return true;

      for (let i = 0; i < currentLines.length; i++) {
        const cl = currentLines[i];
        const sl = snapshotLines[i];
        const lineFields = ['itemId', 'variantId', 'quantity', 'unitPrice', 'description'];
        for (const f of lineFields) {
          if (String(cl[f] ?? '') !== String(sl[f] ?? '')) return true;
        }
      }

      return false;
    } catch {
      return true; // on error, allow submit
    }
  };

  // Submit for Approval — with resubmit change detection
  const handleSubmitClick = async () => {
    if (isEditMode && !isDirty && originalPO?.status !== PO_STATUS.DRAFT) {
      message.warning('No changes detected.');
      return;
    }
    const errors = validateForm(true);
    if (errors.length > 0) {
      errors.forEach((e) => message.error(e, 5));
      focusFirstErrorField(errors[0]);
      return;
    }

    try {
      await form.validateFields();
    } catch {
      return;
    }

    // For resubmit: check if user made any changes
    const isResubmit = isEditMode && originalPO &&
      (originalPO.status === PO_STATUS.REJECTED || originalPO.status === PO_STATUS.REFERRED_BACK);

    if (isResubmit) {
      setChangeCheckLoading(true);
      const changed = await hasChangesFromLastVersion();
      setChangeCheckLoading(false);

      if (!changed) {
        modal.confirm({
          title: 'No Changes Detected',
          icon: <ExclamationCircleOutlined />,
          content: 'No changes were made since the last submission. Are you sure you want to re-submit without changes?',
          okText: 'Re-submit Anyway',
          cancelText: 'Go Back & Edit',
          onOk: () => doSubmit(),
        });
        return;
      }
    }

    // Confirm before submit
    modal.confirm({
      title: 'Submit for Approval',
      icon: <SendOutlined style={{ color: 'var(--primary-color)' }} />,
      content: 'Are you sure you want to submit this purchase order for approval?',
      okText: 'Submit',
      onOk: () => doSubmit(),
    });
  };

  // Actual submit logic
  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = buildPayload(PO_STATUS.PENDING_APPROVAL);
      let result;
      if (isEditMode) {
        result = await updatePurchaseOrder(id, payload);
      } else {
        result = await createPurchaseOrder(payload);
      }
      if (result?.version != null) setEntityVersion(result.version);

      // Create system activity log
      const currentUser = getCurrentUser();
      const name = currentUser?.name || '';
      const poId = result?.id || id;

      if (poId) {
        const previousStatus = originalPO?.status;
        if (isEditMode && (previousStatus === PO_STATUS.REJECTED || previousStatus === PO_STATUS.REFERRED_BACK)) {
          await createActivity(poId, {
            comment: `PO re-submitted for approval by ${name}. Previous status: ${previousStatus}`,
            status: PO_STATUS.PENDING_APPROVAL,
            isSystemGenerated: true,
            name,
          });
        } else {
          await createActivity(poId, {
            comment: `PO submitted for approval by ${name}`,
            status: PO_STATUS.PENDING_APPROVAL,
            isSystemGenerated: true,
            name,
          });
        }
      }

      // Lock BOM lines on submit (Pending_Approval)
      if (poType !== PO_TYPE.GENERAL) {
        const byBomId = {};
        lineItems.forEach(li => {
          (li.bomLineSources || []).forEach(src => {
            if (!byBomId[src.bomId]) byBomId[src.bomId] = [];
            byBomId[src.bomId].push(src.lineId);
          });
        });
        try {
          await Promise.allSettled(
            Object.entries(byBomId).map(([bomId, lineIds]) =>
              updateBomLinePoStatus(Number(bomId), [...new Set(lineIds)], true)
            )
          );
        } catch (err) {
          console.error('Failed to update BOM line PO status:', err);
        }
      }

      message.success('Purchase order submitted for approval');
      setIsDirty(false);
      clearDirty();
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
      modal.confirm({
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
      render: (_, record) => {
        // BOM-sourced line: show plain text
        if (record._fromBom) {
          return (
            <div>
              <Text strong style={{ fontSize: 13 }}>{record.variantCode}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>{record.variantName}</Text>
            </div>
          );
        }
        return (
          <ItemSearchInput
            value={
              record.variantCode || record.variantName
                ? `${record.variantCode || ''} - ${record.variantName || ''}`
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
            disabled={!selectedSupplier || submitting || savingDraft}
          />
        );
      },
    },
    {
      title: 'Variant',
      width: 200,
      render: (_, record) => {
        if (!record.variantId) {
          return <div style={{ display: 'flex', justifyContent: 'center' }}><Text type="secondary" style={{ fontSize: 12 }}>-</Text></div>;
        }
        const attrs = record.variantAttributes || {};
        const hasMultipleVariants =
          record._fromBom ? false : itemsWithVariants[record.itemId]?.variants?.length > 1;
        const imgUrl = lineItemImages[record.variantId];

        return (
          <div
            style={{
              display: 'flex',
              gap: 6,
              alignItems: 'flex-start',
              cursor: hasMultipleVariants ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (hasMultipleVariants && !submitting && !savingDraft) {
                handleChangeVariant(record.key, record.itemId);
              }
            }}
            title={hasMultipleVariants ? 'Click to change variant' : ''}
          >
            {/* Variant image thumbnail with hover enlarge */}
            {imgUrl === 'loading' && (
              <div style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Spin size="small" />
              </div>
            )}
            {imgUrl && imgUrl !== 'loading' && (
              <Popover
                content={
                  <img
                    src={imgUrl}
                    alt="variant enlarged"
                    style={{ width: 200, height: 200, objectFit: 'cover', borderRadius: 6 }}
                  />
                }
                trigger="hover"
                placement="right"
                overlayInnerStyle={{ padding: 4 }}
              >
                <img
                  src={imgUrl}
                  alt="variant"
                  style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4, flexShrink: 0, border: '1px solid var(--border-color, #d9d9d9)', cursor: 'pointer' }}
                />
              </Popover>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', flex: 1, minWidth: 0 }}>
              {hasMultipleVariants && (
                <EditOutlined style={{ fontSize: 11, color: 'var(--primary-color)', flexShrink: 0 }} />
              )}
              {/* Variant identity leads; attributes follow as supporting detail. */}
              {(record.variantName || record.variantCode) && (
                <div style={{ width: '100%', minWidth: 0 }}>
                  {record.variantName && (
                    <Text strong style={{ fontSize: 11, display: 'block' }} ellipsis={{ tooltip: record.variantName }}>
                      {record.variantName}
                    </Text>
                  )}
                  {record.variantCode && (
                    <Text type="secondary" style={{ fontSize: 10, fontFamily: 'monospace' }}>
                      {record.variantCode}
                    </Text>
                  )}
                </div>
              )}
              {Object.entries(attrs).length > 0 ? (
                Object.entries(attrs).map(([key, val]) => {
                  const kLower = key.toLowerCase();
                  const isColorAttr = kLower.includes('color') || kLower.includes('colour');
                  const showSwatch = isColorAttr && isPantoneCode(val);
                  return (
                    <Tag
                      key={key}
                      className="bom-variant-tag"
                      style={{ margin: 0, fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 3 }}
                    >
                      {showSwatch && <PantoneColorSwatch value={val} size={10} />}
                      {`${key}:${val}`}
                    </Tag>
                  );
                })
              ) : (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Default
                </Text>
              )}
            </div>
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
          disabled={submitting || savingDraft || !record.itemId}
        />
      ),
    },
    {
      title: 'HSN',
      dataIndex: 'hsnCode',
      width: 120,
      align: 'center',
      render: (value, record) => {
        const isFabric = (record.categoryName || '').toLowerCase().includes('fabric');
        const hasStages = record.processingStages && record.processingStages.length > 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>{value || '-'}</Text>
            {isFabric && record.itemId && (
              <Button
                type="text"
                size="small"
                icon={<ExperimentOutlined />}
                style={{
                  fontSize: 13,
                  color: hasStages ? 'var(--success-color, #52c41a)' : 'var(--primary-color)',
                  padding: '0 4px',
                }}
                onClick={() => {
                  const deliveryDate = form.getFieldValue('deliveryDate');
                  if (!deliveryDate) {
                    message.warning('Please select an Expected Delivery Date before adding processing stages.');
                    return;
                  }
                  setStagesDialogState({ open: true, lineKey: record.key });
                }}
                title={hasStages ? `${record.processingStages.length} processing stage(s)` : 'Add processing stages'}
              />
            )}
          </div>
        );
      },
    },
    {
      title: 'Qty',
      dataIndex: 'qty',
      width: 100,
      align: 'center',
      render: (value, record) => {
        if (record._fromBom) {
          const uomLabel = (record.uom || record.primaryUom || '').toUpperCase();
          return <Text strong style={{ color: 'var(--primary-color)' }}>{value}{uomLabel ? ` ${uomLabel}` : ''}</Text>;
        }
        return (
          <InputNumber
            min={0}
            step={1}
            precision={2}
            controls={false}
            style={{ width: '100%', height: 40 }}
            value={value === '' ? null : Number(value)}
            onChange={(v) =>
              handleLineItemChange(record.key, 'qty', v !== null ? String(v) : '')
            }
            disabled={submitting || savingDraft || !record.itemId}
            placeholder="0"
            addonAfter={record.itemId ? (record.uom || record.primaryUom || '').toUpperCase() || undefined : undefined}
            {...numericInputProps}
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
          controls={false}
          style={{ width: '100%', height: 40 }}
          value={value === '' ? null : Number(value)}
          onChange={(v) =>
            handleLineItemChange(
              record.key,
              'unitPrice',
              v !== null ? v : ''
            )
          }
          disabled={submitting || savingDraft || !record.itemId}
          placeholder="0.00"
          {...numericInputProps}
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
          disabled={submitting || savingDraft || !record.itemId}
        />
      ),
    },
    ...(isIgstApplicable
      ? [
          {
            title: 'IGST',
            width: 100,
            align: 'center',
            render: (_, record) => {
              const base =
                (parseFloat(record.qty) || 0) * (parseFloat(record.unitPrice) || 0);
              const gst = (base * (parseFloat(record.gstPercent) || 0)) / 100;
              return <Text style={{ whiteSpace: 'nowrap' }}>₹ {gst.toFixed(2)}</Text>;
            },
          },
        ]
      : [
          {
            title: 'SGST',
            width: 90,
            align: 'center',
            render: (_, record) => {
              const base =
                (parseFloat(record.qty) || 0) * (parseFloat(record.unitPrice) || 0);
              const gst =
                (base * (parseFloat(record.gstPercent) || 0)) / 100 / 2;
              return <Text style={{ whiteSpace: 'nowrap' }}>₹ {gst.toFixed(2)}</Text>;
            },
          },
          {
            title: 'CGST',
            width: 90,
            align: 'center',
            render: (_, record) => {
              const base =
                (parseFloat(record.qty) || 0) * (parseFloat(record.unitPrice) || 0);
              const gst =
                (base * (parseFloat(record.gstPercent) || 0)) / 100 / 2;
              return <Text style={{ whiteSpace: 'nowrap' }}>₹ {gst.toFixed(2)}</Text>;
            },
          },
        ]),
    {
      title: 'Amount (₹)',
      dataIndex: 'amount',
      width: 120,
      align: 'center',
      render: (value) => (
        <Text strong style={{ color: 'var(--success-color)', whiteSpace: 'nowrap' }}>
          ₹ {(value || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: '',
      width: 50,
      render: (_, record) => {
        if (record._fromBom) return null;
        return (
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
              disabled={lineItems.length === 1 || submitting || savingDraft}
            />
          </Popconfirm>
        );
      },
    },
  ];

  if (pageLoading) {
    return (
      <div className="animate-fade-in-up">
        <div className="page-header" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
          <Space>
            <Skeleton.Button active size="small" style={{ width: 32, height: 32 }} />
            <Skeleton.Input active style={{ width: 200 }} />
          </Space>
          <Space>
            <Skeleton.Button active style={{ width: 120 }} />
            <Skeleton.Button active style={{ width: 140 }} />
          </Space>
        </div>
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Card style={{ marginBottom: 24 }}>
              <Skeleton.Input active style={{ width: 180, marginBottom: 24 }} />
              <Row gutter={24}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Col xs={24} md={12} key={i} style={{ marginBottom: 16 }}>
                    <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                    <Skeleton.Input active block />
                  </Col>
                ))}
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={8}>
            <Card style={{ marginBottom: 24 }}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          </Col>
        </Row>
        <Card>
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEditMode ? 'Edit Purchase Order' : 'Create Purchase Order'}
        onBack={handleGoBack}
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        {hasPermission('purchase-orders', isEditMode ? 'update' : 'add') &&
          !(isEditMode && originalPO && (originalPO.status === PO_STATUS.REJECTED || originalPO.status === PO_STATUS.REFERRED_BACK)) && (
          <ActionButton
            action="save"
            variant="draft"
            text="Save as Draft"
            onClick={handleSaveDraft}
            loading={savingDraft}
            disabled={submitting || (isEditMode && !isDirty)}
          />
        )}
        {hasPermission('purchase-orders', isEditMode ? 'update' : 'add') && (
          <ActionButton
            action="save"
            text="Submit for Approval"
            onClick={handleSubmitClick}
            loading={submitting}
            disabled={savingDraft}
          />
        )}
      </PageHeader>

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
                      showSearch={{
                        filterOption: (input, option) =>
                          (option?.label || '')
                            .toLowerCase()
                            .includes(input.toLowerCase()),
                      }}
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
                      showSearch={{
                        filterOption: (input, option) =>
                          (option?.label || '')
                            .toLowerCase()
                            .includes(input.toLowerCase()),
                      }}
                      allowClear
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
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>PO Type</Text>
                <Segmented
                  size="small"
                  value={poType}
                  options={PO_TYPE_OPTIONS}
                  className="po-type-toggle"
                  block
                  onChange={handlePoTypeChange}
                  disabled={submitting || savingDraft}
                />
              </div>
              <Title level={5} style={{ marginBottom: 16 }}>
                Supplier Information
              </Title>
              {selectedSupplier ? (
                <Descriptions size="small" column={1} items={[
                  {
                    key: 'name',
                    label: 'Name',
                    children: selectedSupplier.name,
                  },
                  selectedSupplier.gstin && {
                    key: 'gstin',
                    label: 'GSTIN',
                    children: selectedSupplier.gstin,
                  },
                  selectedSupplier.email && {
                    key: 'email',
                    label: 'Email',
                    children: selectedSupplier.email,
                  },
                  selectedSupplier.phone && {
                    key: 'phone',
                    label: 'Phone',
                    children: selectedSupplier.phone,
                  },
                  (selectedSupplier.city || selectedSupplier.state) && {
                    key: 'location',
                    label: 'Location',
                    children: [selectedSupplier.city, selectedSupplier.state]
                      .filter(Boolean)
                      .join(', '),
                  },
                  {
                    key: 'supplies',
                    label: 'Supplies',
                    children: (
                      <Space size={4}>
                        {selectedSupplier.suppliesFabric && <Tag color="success">Fabric</Tag>}
                        {selectedSupplier.suppliesTrims && <Tag color="processing">Trims</Tag>}
                        {!selectedSupplier.suppliesFabric && !selectedSupplier.suppliesTrims && (
                          <Tag color="default">Not specified</Tag>
                        )}
                      </Space>
                    ),
                  },
                  {
                    key: 'igst',
                    label: 'IGST Applicable',
                    children: (
                      <Tag color={isIgstApplicable ? 'blue' : 'default'}>
                        {isIgstApplicable ? 'Yes' : 'No'}
                      </Tag>
                    ),
                  },
                ].filter(Boolean)} />
              ) : (
                <Text type="secondary">Select a supplier to view details</Text>
              )}
            </Card>
          </Col>
        </Row>

        {/* Order Info (Regular/Combined PO) — statistic-style grid */}
        {poType !== PO_TYPE.GENERAL && bomOrders.length > 0 && (
          <Card size="small" style={{ marginBottom: 24 }}>
            <Title level={5} style={{ marginTop: 0, marginBottom: 12 }}>Order Information</Title>
            {bomOrders.map((order, idx) => (
              <div key={order.orderNo}>
                {idx > 0 && <Divider style={{ margin: '12px 0' }} />}
                <Row gutter={[24, 12]}>
                  <Col xs={12} sm={8} md={6} lg={4}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Order No</Text>
                    <Text strong style={{ fontSize: 14, color: 'var(--primary-color)' }}>{order.orderNo}</Text>
                  </Col>
                  <Col xs={12} sm={8} md={6} lg={4}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Style</Text>
                    <Text strong style={{ fontSize: 14 }}>{order.styleName || '-'}</Text>
                  </Col>
                  <Col xs={12} sm={8} md={6} lg={4}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Season</Text>
                    <Text strong style={{ fontSize: 14 }}>{order.season || '-'}</Text>
                  </Col>
                  <Col xs={12} sm={8} md={6} lg={4}>
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Order Qty</Text>
                    <Text strong style={{ fontSize: 14 }}>{order.orderQty?.toLocaleString('en-IN') || '-'}</Text>
                  </Col>
                </Row>
              </div>
            ))}
          </Card>
        )}

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
            {poType === PO_TYPE.GENERAL ? (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addLineItem}
                disabled={!selectedSupplier || submitting || savingDraft}
              >
                Add Item
              </Button>
            ) : (
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setBomDrawerOpen(true)}
                disabled={!selectedSupplier || submitting || savingDraft}
              >
                Select BOM Lines
              </Button>
            )}
          </div>
          <Table
            columns={lineColumns}
            dataSource={lineItems}
            pagination={false}
            scroll={{ x: 2000 }}
            size="middle"
            rowKey="key"
            className="centered-header-table"
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

      {/* Variant Selection Modal */}
      <VariantSelectionModal
        open={variantModalState.show}
        item={variantModalState.pendingItem}
        onSelect={handleVariantSelect}
        currentVariantId={variantModalState.currentVariantId || null}
      />

      {/* BOM Line Selection Drawer */}
      <BomLineSelectionDrawer
        open={bomDrawerOpen}
        onClose={() => setBomDrawerOpen(false)}
        poType={poType}
        bomOrders={bomOrders}
        onBomOrdersChange={setBomOrders}
        onFetchBom={handleFetchBom}
        bomLoading={bomLoading}
        supplierFabric={selectedSupplier?.suppliesFabric || false}
        supplierTrims={selectedSupplier?.suppliesTrims || false}
        existingBomLineIds={new Set(lineItems.flatMap(li => (li.bomLineSources || []).map(s => s.lineId)))}
        onConfirm={handleBomLineSelectionConfirm}
      />
      {/* Fabric processing stages dialog */}
      {stagesDialogState.open && (() => {
        const lineItem = lineItems.find((li) => li.key === stagesDialogState.lineKey);
        return lineItem ? (
          <FabricStagesDialog
            open
            onClose={() => setStagesDialogState({ open: false, lineKey: null })}
            onSave={(stages) => {
              handleLineItemChange(stagesDialogState.lineKey, 'processingStages', stages);
            }}
            stages={lineItem.processingStages}
            poDate={form.getFieldValue('poDate')}
            deliveryDate={form.getFieldValue('deliveryDate')}
            itemName={lineItem.variantName}
            itemCode={lineItem.variantCode}
            variantAttributes={lineItem.variantAttributes}
          />
        ) : null;
      })()}
    </div>
  );
};

export default POForm;
