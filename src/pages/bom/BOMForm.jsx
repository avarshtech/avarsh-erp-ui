import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Input,
  Select,
  InputNumber,
  Button,
  Card,
  Table,
  Tag,
  Upload,
  Space,
  Typography,
  message,
  Spin,
  Popconfirm,
  AutoComplete,
  Tooltip,
  Modal,
  Row,
  Col,
  Radio,
  Popover,
  ConfigProvider,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  SendOutlined,
  LoadingOutlined,
  UploadOutlined,
  EditOutlined,
  CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import { hasPermission } from '../../utils/permissions';
import { createBom, updateBom, getBomById } from '../../services/bomService';
import { getActiveProcesses } from '../../services/processService';
import { getOrderByOrderNo } from '../../services/orderService';
import { getStyleById } from '../../services/styleService';
import { searchItems, getItemMetaData, getItemsByIds } from '../../services/itemService';
import { getActiveParts } from '../../services/partsService';
import { uploadFile, deleteFile, downloadFileAsBlob, getFilesByEntity } from '../../services/fileService';
import {
  BOM_STATUS,
  QTY_CALC_BASIS,
  calcPurchaseQty,
  calcTrimsTotal,
} from '../../utils/bomConstants';
import ProcessAllowanceModal from './ProcessAllowanceModal';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ==================== HELPERS ====================

const createEmptyLine = () => ({
  key: `line_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  categoryId: null,
  categoryName: '',
  subCategoryId: null,
  subCategoryName: '',
  itemId: null,
  itemName: '',
  itemCode: '',
  itemTypeName: '',
  variants: {},
  variantId: null,
  availableVariants: [],
  primaryUom: '',
  primaryUomId: null,
  secondaryUom: '',
  secondaryUomId: null,
  uom: '',
  partsName: '',
  consumptionPerGarment: null,
  selectedBuyerPoNo: null, // set when Buyer PO basis + color in multiple lines
  colorInvalid: false, // true when variant color not found in order lines
  qtyCalcBasis: 'TOTAL', // per-line calc basis (only editable for trims)
  baseQtyMatchAttr: null, // which variant attr to match for trims base qty: 'color', 'size', or 'color+size'
  processes: [],
  processAllowances: [],
  totalQty: null,
  cadPreviewUrl: null,
  _cadFileId: null,
  isPoGenerated: false,
  remarks: '',
});

/** Check if a BOM line's category is Fabric */
const isFabricCategory = (line) => (line?.categoryName || '').toLowerCase().includes('fabric');

/** Auto-format order number: user types after "SG/" prefix, auto-inserts - and / */
const formatOrderNo = (raw, prev = '') => {
  const prefix = 'SG/';
  if (!raw || raw.length < prefix.length) return prefix;
  const isDeleting = raw.length < prev.length;
  if (isDeleting && raw.length <= prefix.length) return prefix;
  const after = raw.slice(prefix.length).replace(/[^0-9]/g, '');
  let result = prefix;
  for (let i = 0; i < after.length; i++) {
    if (i === 2) result += '-';
    if (i === 4) result += '/';
    result += after[i];
  }
  if (!isDeleting) {
    if (after.length === 2 && !result.endsWith('-')) result += '-';
    if (after.length === 4 && !result.endsWith('/')) result += '/';
  }
  return result;
};

/**
 * Format variants object { GSM: '180', W: '58"' } as array of strings ["GSM:180", "W:58\""]
 */
const variantsToTags = (variants) => {
  if (!variants || typeof variants !== 'object') return [];
  return Object.entries(variants)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}:${v}`);
};

// ==================== ITEM SEARCH (Debounced AutoComplete) ====================

const BomItemSearch = ({ value, onSelect, onClear, disabled, categoryId, subCategoryId, itemTypeId }) => {
  const [searchText, setSearchText] = useState(value || '');
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const noResultPrefixRef = useRef('');
  const lastQueryRef = useRef('');

  useEffect(() => { setSearchText(value || ''); }, [value]);

  const handleSearch = (text) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text || text.length < 3) {
      setOptions([]);
      lastQueryRef.current = '';
      noResultPrefixRef.current = '';
      return;
    }
    const isShortening = text.length < lastQueryRef.current.length;
    if (isShortening && noResultPrefixRef.current) {
      if (text.length < noResultPrefixRef.current.length ||
          !text.toLowerCase().startsWith(noResultPrefixRef.current.toLowerCase())) {
        noResultPrefixRef.current = '';
      }
    }
    if (noResultPrefixRef.current && text.toLowerCase().startsWith(noResultPrefixRef.current.toLowerCase())) {
      setOptions([]);
      lastQueryRef.current = text;
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await searchItems({
          search: text,
          categoryId,
          subCategoryId,
          itemTypeId,
          size: 20,
        });
        const payload = response?.data || response || {};
        const items = Array.isArray(payload) ? payload : Array.isArray(payload?.content) ? payload.content : [];
        lastQueryRef.current = text;
        if (items.length === 0) { noResultPrefixRef.current = text; } else { noResultPrefixRef.current = ''; }
        setOptions(items.map((item) => {
          const displayText = `${item.itemCode || ''} - ${item.itemName || ''}`;
          return {
            // value must match what handleSelect sets on searchText
            // so that onChange (which fires after onSelect) doesn't overwrite it
            value: item.itemName || '',
            key: item.id,
            label: (
              <Tooltip title={displayText} placement="right" mouseEnterDelay={0.4}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {displayText}
                </div>
              </Tooltip>
            ),
            item,
          };
        }));
      } catch { setOptions([]); }
      finally { setSearching(false); }
    }, 300);
  };

  const handleSelect = (_, option) => {
    setSearchText(option.item.itemName || '');
    setOptions([]);
    if (onSelect) onSelect(option.item);
  };

  const handleChange = (text) => {
    setSearchText(text || '');
    if (!text) {
      setOptions([]);
      if (onClear) onClear();
    }
  };

  return (
    <AutoComplete
      value={searchText}
      options={options}
      onSearch={handleSearch}
      onSelect={handleSelect}
      onChange={handleChange}
      placeholder={!itemTypeId ? 'Select item type first' : 'Search items (min 3 chars)...'}
      disabled={disabled}
      style={{ width: '100%' }}
      size="small"
      allowClear
      popupMatchSelectWidth={true}
      notFoundContent={searching ? <Spin size="small" /> : null}
    />
  );
};

// ==================== COMPONENT ====================

const BOMForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEdit = Boolean(id);
  const { isDarkMode } = useTheme();
  const bomFromState = location.state?.bomData;

  // ── Unsaved changes guard ────────────────────────────────────────
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  // ── Page-level state ─────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entityVersion, setEntityVersion] = useState(null);

  // ── Section A: General Info ──────────────────────────────────────
  const [orderNoInput, setOrderNoInput] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSummaryLoading, setOrderSummaryLoading] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [orderNo, setOrderNo] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState(null);
  const [styleNo, setStyleNo] = useState('');
  const [garmentName, setGarmentName] = useState('');
  const [material, setMaterial] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [colors, setColors] = useState([]);
  const [orderLineSummary, setOrderLineSummary] = useState([]); // [{ buyerPoNo, colors: [{ name, qty }], lineQty }]
  const [orderQty, setOrderQty] = useState(null);
  const [remarks, setRemarks] = useState('');

  // ── Section B: BOM Lines ─────────────────────────────────────────
  const [lines, setLines] = useState([createEmptyLine()]);

  // ── Dropdown options (fetched from APIs) ─────────────────────────
  const [metaData, setMetaData] = useState([]);  // category → subCategory → itemType hierarchy
  const [processesList, setProcessesList] = useState([]);
  const [partsList, setPartsList] = useState([]);

  // ── Process Allowance Modal ──────────────────────────────────────
  const [allowanceModalOpen, setAllowanceModalOpen] = useState(false);
  const [allowanceLineKey, setAllowanceLineKey] = useState(null);
  const [allowanceProcesses, setAllowanceProcesses] = useState([]);
  const [allowanceFinishedWidth, setAllowanceFinishedWidth] = useState(0);
  const [allowanceBaseQty, setAllowanceBaseQty] = useState(0);
  const [allowanceIsFabric, setAllowanceIsFabric] = useState(true);

  // ── Trims Match By Modal ────────────────────────────────────────
  const [matchByModalOpen, setMatchByModalOpen] = useState(false);
  const [matchByLineKey, setMatchByLineKey] = useState(null);

  // ── Auto-focus variant dropdown after edit button click ─────────
  const [variantEditLineKey, setVariantEditLineKey] = useState(null);

  // ── Resizable variant column ────────────────────────────────────
  const [variantColWidth, setVariantColWidth] = useState(300);
  const variantColWidthRef = useRef(300);

  // ── Buyer PO picker (when color exists in multiple order lines) ──
  const [buyerPoPickerOpen, setBuyerPoPickerOpen] = useState(false);
  const [buyerPoPickerLineKey, setBuyerPoPickerLineKey] = useState(null);
  const [buyerPoPickerOptions, setBuyerPoPickerOptions] = useState([]); // [{ buyerPoNo, qty }]
  const [pendingProcessData, setPendingProcessData] = useState(null); // stashed data to open allowance after PO pick


  // ==================== LOAD DROPDOWN DATA ====================

  useEffect(() => {
    const loadData = async () => {
      const [processResult, metaResult, partsResult] = await Promise.allSettled([getActiveProcesses(), getItemMetaData(), getActiveParts()]);
      if (processResult.status === 'fulfilled') {
        const res = processResult.value;
        setProcessesList(Array.isArray(res) ? res : res?.data || []);
      }
      if (metaResult.status === 'fulfilled') {
        const res = metaResult.value;
        setMetaData(Array.isArray(res) ? res : res?.data || []);
      }
      if (partsResult.status === 'fulfilled') {
        const res = partsResult.value;
        setPartsList(Array.isArray(res) ? res : res?.data || []);
      }
    };
    loadData();
  }, []);

  // ==================== LOAD EXISTING BOM (Edit Mode) ====================

  useEffect(() => {
    if (!isEdit) return;
    const loadBom = async () => {
      setLoading(true);
      try {
        // Use location state if lines available, otherwise fetch from API (direct URL access)
        const bom = bomFromState?.lines?.length > 0 ? bomFromState : await getBomById(id);

        // Set header fields from BOM
        setEntityVersion(bom.version);
        setOrderId(bom.orderId);
        setOrderNo(bom.orderNo || '');
        setOrderNoInput(bom.orderNo || '');
        setSelectedStyleId(bom.styleId);
        setStyleNo(bom.styleName || '');
        setGarmentName(bom.garmentName || '');
        setMaterial(bom.material || '');
        setBuyerName(bom.buyerName || '');
        setOrderQty(bom.orderQty);
        setRemarks(bom.remarks || '');

        if (bom.lines?.length > 0) {
          // Step 1: Render lines immediately from BOM response (no API wait)
          const mappedLines = bom.lines.map((l) => {
            let itemTypeId = null;
            if (l.categoryId && l.subCategoryId && l.itemTypeName && metaData.length > 0) {
              const cat = metaData.find((c) => c.id === l.categoryId);
              const sub = (cat?.subCategories || []).find((sc) => sc.id === l.subCategoryId);
              const it = (sub?.itemTypes || []).find((t) => t.name === l.itemTypeName);
              if (it) itemTypeId = it.id;
            }
            return {
              key: `line_${l.id || Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              id: l.id,
              categoryId: l.categoryId,
              categoryName: l.categoryName || '',
              subCategoryId: l.subCategoryId,
              subCategoryName: l.subCategoryName || '',
              itemTypeId,
              itemId: l.itemId,
              itemName: l.itemName || '',
              itemCode: l.itemCode || '',
              itemTypeName: l.itemTypeName || '',
              variants: l.variants || {},
              variantId: l.variantId || null,
              availableVariants: [],
              primaryUom: l.uom || '',
              primaryUomId: null,
              secondaryUom: '',
              secondaryUomId: null,
              uom: l.uom || '',
              partsName: l.partsName || [],
              consumptionPerGarment: l.consumptionPerGarment,
              processes: Array.isArray(l.processes) ? l.processes.map((p) => (typeof p === 'object' ? p.id : p)) : [],
              processAllowances: l.processAllowances || [],
              qtyCalcBasis: l.qtyCalcBasis || 'TOTAL',
              baseQtyMatchAttr: l.baseQtyMatchAttr || null,
              selectedBuyerPoNo: l.selectedBuyerPoNo || null,
              totalQty: l.totalQty,
              cadPreviewUrl: null,
              _cadFileId: null,
              isPoGenerated: l.isPoGenerated || false,
              remarks: l.remarks || '',
            };
          });
          setLines(mappedLines);

          // Step 2: Single bulk fetch for all item details (variants, UOM, itemTypeId)
          const itemIds = [...new Set(bom.lines.map((l) => l.itemId).filter(Boolean))];
          if (itemIds.length > 0) {
            getItemsByIds(itemIds)
              .then((res) => {
                const items = res?.data || res || [];
                const itemMap = {};
                (Array.isArray(items) ? items : []).forEach((item) => { itemMap[item.id] = item; });
                setLines((prev) => prev.map((line) => {
                  const item = itemMap[line.itemId];
                  if (!item) return line;
                  const activeVariants = (item.variants || []).filter((v) => v.isActive !== false);
                  return {
                    ...line,
                    availableVariants: activeVariants,
                    primaryUom: item.uomSymbol || line.primaryUom,
                    secondaryUom: item.secondaryUomSymbol || '',
                    itemTypeId: line.itemTypeId || item.itemTypeId || null,
                  };
                }));
              })
              .catch(() => { /* item details unavailable — variant editing won't work */ });
          }

          // Load CAD files for fabric lines (async, non-blocking)
          const fabricLinesWithId = (bom.lines || []).filter((l) =>
            l.id && (l.categoryName || '').toLowerCase().includes('fabric'),
          );
          for (const l of fabricLinesWithId) {
            getFilesByEntity('BOM_LINE', l.id)
              .then((files) => {
                const cadFile = (files?.data || files || []).find((f) => f.fileCategory === 'CAD_MARKER');
                if (!cadFile) return;
                return downloadFileAsBlob(cadFile.fileId).then((blob) => {
                  const url = URL.createObjectURL(blob);
                  setLines((prev) => prev.map((line) =>
                    line.id === l.id ? { ...line, cadPreviewUrl: url, _cadFileId: cadFile.fileId } : line,
                  ));
                });
              })
              .catch(() => { /* CAD file unavailable */ });
          }
        }
      } catch {
        message.error('Failed to load BOM');
        navigate('/bom/list');
      } finally {
        setLoading(false);
      }
    };
    loadBom();
  }, [id, isEdit, navigate]);

  // Lazy-load order summary for edit mode (non-blocking, runs after form renders)
  useEffect(() => {
    if (!isEdit || !orderNo || orderLineSummary.length > 0) return;
    const loadOrderSummary = async () => {
      setOrderSummaryLoading(true);
      try {
        const order = await getOrderByOrderNo(orderNo);
        const allColors = [];
        const lineSummary = (order.orderLines || []).map((line) => {
          const colorDetails = (line.colorRows || []).map((cr) => {
            if (cr.colorName && !allColors.some((c) => c.toLowerCase() === cr.colorName.trim().toLowerCase())) {
              allColors.push(cr.colorName.trim());
            }
            return { name: cr.colorName?.trim() || '', qty: cr.total || 0, quantities: cr.quantities || {} };
          });
          return { buyerPoNo: line.buyerPoNo || '-', colors: colorDetails, lineQty: line.lineQty || colorDetails.reduce((sum, c) => sum + c.qty, 0) };
        });
        setColors(allColors);
        setOrderLineSummary(lineSummary);
      } catch {
        // Order summary unavailable — existing line values still work
      } finally {
        setOrderSummaryLoading(false);
      }
    };
    loadOrderSummary();
  }, [isEdit, orderNo]);

  // ==================== ORDER NO LOOKUP ====================

  const ORDER_NO_PATTERN = /^SG\/\d{2}-\d{2}\/\d{4,}$/;

  const handleOrderNoBlur = async (e) => {
    const val = e.target.value?.trim();
    if (!val || val === orderNo) return;
    if (!ORDER_NO_PATTERN.test(val)) return; // incomplete pattern — don't call API
    setOrderLoading(true);
    try {
      const order = await getOrderByOrderNo(val);
      if (order.status?.toUpperCase() !== 'CONFIRMED') {
        message.error('Order is not confirmed. Only confirmed orders can be used for BOM creation.');
        setOrderLoading(false);
        return;
      }

      // Build order line summary and consolidate colors (case-insensitive dedup)
      // Preserve per-size quantities for trims base qty matching
      const allColors = [];
      const allSizes = [];
      const lineSummary = (order.orderLines || []).map((line) => {
        const colorDetails = (line.colorRows || []).map((cr) => {
          if (cr.colorName && !allColors.some((c) => c.toLowerCase() === cr.colorName.trim().toLowerCase())) {
            allColors.push(cr.colorName.trim());
          }
          // Collect size names from the quantities map
          if (cr.quantities) {
            Object.keys(cr.quantities).forEach((s) => {
              if (s && !allSizes.some((sz) => sz.toLowerCase() === s.trim().toLowerCase())) {
                allSizes.push(s.trim());
              }
            });
          }
          return { name: cr.colorName?.trim() || '', qty: cr.total || 0, quantities: cr.quantities || {} };
        });
        return {
          buyerPoNo: line.buyerPoNo || '-',
          colors: colorDetails,
          lineQty: line.lineQty || colorDetails.reduce((sum, c) => sum + c.qty, 0),
        };
      });

      // Fetch style to get garmentName and styleId — wait before rendering
      let resolvedGarmentName = '';
      let resolvedStyleId = null;
      if (order.costingId) {
        try {
          const { getCostSheetByCostingId } = await import('../../services/costingService');
          const costing = await getCostSheetByCostingId(order.costingId);
          if (costing.styleId) {
            resolvedStyleId = costing.styleId;
            const style = await getStyleById(costing.styleId);
            resolvedGarmentName = style.garmentName || '';
          }
        } catch {
          // Costing/style lookup failed — fields remain empty
        }
      }

      // Set all state at once — single render
      setOrderId(order.id);
      setOrderNo(order.orderNo);
      setStyleNo(order.styleNo || '');
      setMaterial(order.material || '');
      setOrderQty(order.totalOrderQty || 0);
      setBuyerName(order.buyerName || '');
      setColors(allColors);
      setOrderLineSummary(lineSummary);
      setSelectedStyleId(resolvedStyleId);
      setGarmentName(resolvedGarmentName);
      setIsDirty(true);
    } catch {
      // Error toast is shown by the global interceptor with backend message
      setOrderId(null);
      setOrderNo('');
      setStyleNo('');
      setGarmentName('');
      setMaterial('');
      setBuyerName('');
      setColors([]);
      setOrderLineSummary([]);
      setOrderQty(null);
      setSelectedStyleId(null);
    } finally {
      setOrderLoading(false);
    }
  };

  // ==================== LINE UPDATE HELPERS ====================

  const updateLine = useCallback((key, field, value) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        return { ...line, [field]: value };
      }),
    );
    setIsDirty(true);
  }, []);

  const updateLineMulti = useCallback((key, updates) => {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        return { ...line, ...updates };
      }),
    );
    setIsDirty(true);
  }, []);

  // ── Cascading: Category → Sub Category → Item Type ────────────────
  const getSubCategoriesForCategory = useCallback(
    (categoryId) => {
      if (!categoryId) return [];
      const cat = metaData.find((c) => c.id === categoryId);
      return cat?.subCategories || [];
    },
    [metaData],
  );

  const getItemTypesForSubCategory = useCallback(
    (categoryId, subCategoryId) => {
      if (!categoryId || !subCategoryId) return [];
      const cat = metaData.find((c) => c.id === categoryId);
      const sub = (cat?.subCategories || []).find((sc) => sc.id === subCategoryId);
      return sub?.itemTypes || [];
    },
    [metaData],
  );

  /** Check if a line has downstream data that would be lost on hierarchy change */
  const lineHasData = useCallback((lineKey) => {
    const line = lines.find((l) => l.key === lineKey);
    if (!line) return false;
    return !!(line.consumptionPerGarment || line.partsName || (line.processes?.length > 0) || (line.processAllowances?.length > 0));
  }, [lines]);

  /** Wrap a hierarchy change with confirmation if the line already has data */
  const confirmIfHasData = useCallback((lineKey, doChange) => {
    if (lineHasData(lineKey)) {
      Modal.confirm({
        title: 'Change will clear entered data',
        content: 'Consumption, Parts, Process and Allowance data for this line will be lost. Continue?',
        okText: 'Yes, change',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: doChange,
      });
    } else {
      doChange();
    }
  }, [lineHasData]);

  // Fields to reset when hierarchy changes (downstream of item)
  const resetItemFields = {
    itemId: null, itemName: '', itemCode: '',
    variants: {}, variantId: null, availableVariants: [],
    primaryUom: '', secondaryUom: '', uom: '',
    consumptionPerGarment: null, colorInvalid: false,
    partsName: '', processes: [], processAllowances: [],
    baseQtyMatchAttr: null, selectedBuyerPoNo: null,
  };

  const handleCategoryChange = useCallback(
    (lineKey, categoryId) => {
      const doChange = () => {
        const cat = metaData.find((c) => c.id === categoryId);
        updateLineMulti(lineKey, {
          categoryId, categoryName: cat?.name || '',
          subCategoryId: null, subCategoryName: '',
          itemTypeId: null, itemTypeName: '',
          ...resetItemFields,
          qtyCalcBasis: 'TOTAL', // reset calc basis on category change
        });
      };
      confirmIfHasData(lineKey, doChange);
    },
    [metaData, updateLineMulti, confirmIfHasData],
  );

  const handleSubCategoryChange = useCallback(
    (lineKey, subCategoryId, categoryId) => {
      const doChange = () => {
        const cat = metaData.find((c) => c.id === categoryId);
        const sub = (cat?.subCategories || []).find((sc) => sc.id === subCategoryId);
        updateLineMulti(lineKey, {
          subCategoryId, subCategoryName: sub?.name || '',
          itemTypeId: null, itemTypeName: '',
          ...resetItemFields,
        });
      };
      confirmIfHasData(lineKey, doChange);
    },
    [metaData, updateLineMulti, confirmIfHasData],
  );

  const handleItemTypeChange = useCallback(
    (lineKey, itemTypeId, categoryId, subCategoryId) => {
      const doChange = () => {
        const cat = metaData.find((c) => c.id === categoryId);
        const sub = (cat?.subCategories || []).find((sc) => sc.id === subCategoryId);
        const it = (sub?.itemTypes || []).find((t) => t.id === itemTypeId);
        updateLineMulti(lineKey, {
          itemTypeId, itemTypeName: it?.name || '',
          ...resetItemFields,
        });
      };
      confirmIfHasData(lineKey, doChange);
    },
    [metaData, updateLineMulti, confirmIfHasData],
  );

  /**
   * Validate variant attributes against order data.
   * Fabric: color must exist in order lines.
   * Trims: at least one of color/size must match order data; if neither matches → invalid.
   * Returns { valid, errorMsg }.
   */
  const validateVariantInOrder = useCallback(
    (variants, fabric = true) => {
      if (!variants || typeof variants !== 'object') return { valid: true };
      const colorKey = Object.keys(variants).find((k) => k.toLowerCase() === 'color');
      const sizeKey = Object.keys(variants).find((k) => k.toLowerCase() === 'size');
      const color = colorKey ? String(variants[colorKey]).trim().toLowerCase() : null;
      const size = sizeKey ? String(variants[sizeKey]).trim().toLowerCase() : null;

      if (fabric) {
        // Fabric: validate color only
        if (!color) return { valid: true };
        const found = orderLineSummary.some((ol) =>
          ol.colors.some((c) => c.name && c.name.trim().toLowerCase() === color),
        );
        return found
          ? { valid: true }
          : { valid: false, errorMsg: `Color "${variants[colorKey]}" not found in order lines.` };
      }

      // Trims: check if color or size exists in order data
      if (!color && !size) return { valid: true }; // no matchable attributes

      const colorExists = color && orderLineSummary.some((ol) =>
        ol.colors.some((c) => c.name && c.name.trim().toLowerCase() === color),
      );
      const sizeExists = size && orderLineSummary.some((ol) =>
        ol.colors.some((c) =>
          c.quantities && Object.keys(c.quantities).some((s) => s.trim().toLowerCase() === size),
        ),
      );

      if (colorExists || sizeExists) return { valid: true };

      // Neither matched
      const parts = [];
      if (color) parts.push(`Color "${variants[colorKey]}"`);
      if (size) parts.push(`Size "${variants[sizeKey]}"`);
      return {
        valid: false,
        errorMsg: `${parts.join(' and ')} ${parts.length > 1 ? 'do' : 'does'} not match any order line values. Verify the variant attributes match the order data.`,
      };
    },
    [orderLineSummary],
  );

  /** Check if a variant is already used in another BOM line */
  const isVariantDuplicate = useCallback((variantId, excludeLineKey) => {
    if (!variantId) return false;
    return lines.some((l) => l.key !== excludeLineKey && l.variantId === variantId);
  }, [lines]);

  // ── Sort variant attributes: Color first ─────────────────────────
  const sortAttrs = (attrs) => {
    if (!attrs) return {};
    const entries = Object.entries(attrs);
    entries.sort(([a], [b]) => {
      if (a.toLowerCase() === 'color') return -1;
      if (b.toLowerCase() === 'color') return 1;
      return 0;
    });
    return Object.fromEntries(entries);
  };

  // ── Item selection from autocomplete ────────────────────────────
  const handleBomItemSelect = useCallback(
    (lineKey, item) => {
      const doChange = () => {
        const line = lines.find((l) => l.key === lineKey);
        const fabric = isFabricCategory(line);
        const activeVariants = (item.variants || []).filter((v) => v.isActive !== false);
        let firstVariant = activeVariants.length === 1 ? activeVariants[0] : null;
        // Check duplicate variant
        if (firstVariant && isVariantDuplicate(firstVariant.id, lineKey)) {
          message.error({ content: 'This variant is already added to another BOM line. Please select a different variant.', key: 'variant-duplicate' });
          firstVariant = null; // force dropdown to show for manual selection
        }
        const selectedAttrs = sortAttrs(firstVariant?.attributes);
        const { valid, errorMsg } = firstVariant ? validateVariantInOrder(selectedAttrs, fabric) : { valid: true };
        updateLineMulti(lineKey, {
          itemId: item.id,
          itemName: item.itemName || '',
          itemCode: item.itemCode || '',
          primaryUom: item.uomSymbol || '',
          primaryUomId: item.uomId || null,
          secondaryUom: item.secondaryUomSymbol || '',
          secondaryUomId: item.secondaryUomId || null,
          uom: item.uomSymbol || '',
          availableVariants: activeVariants,
          variantId: firstVariant?.id || null,
          variants: firstVariant ? selectedAttrs : {},
          colorInvalid: firstVariant ? !valid : false,
          consumptionPerGarment: null,
          partsName: '',
          processes: [],
          processAllowances: [],
          baseQtyMatchAttr: null,
          selectedBuyerPoNo: null,
        });
        if (!valid) message.error({ content: errorMsg, key: 'variant-validation' });
      };
      confirmIfHasData(lineKey, doChange);
    },
    [lines, updateLineMulti, validateVariantInOrder, confirmIfHasData, isVariantDuplicate],
  );

  // ── Variant selection (when item has multiple variants) ─────────
  const handleVariantSelect = useCallback(
    (lineKey, variantId) => {
      if (variantId === null) {
        updateLineMulti(lineKey, { variantId: null, variants: {}, colorInvalid: false, baseQtyMatchAttr: null, selectedBuyerPoNo: null });
        return;
      }
      // Check duplicate
      if (isVariantDuplicate(variantId, lineKey)) {
        message.error({ content: 'This variant is already added to another BOM line. Please select a different variant.', key: 'variant-duplicate' });
        // Clear selection and keep dropdown open
        updateLineMulti(lineKey, { variantId: null, variants: {}, colorInvalid: false, baseQtyMatchAttr: null, selectedBuyerPoNo: null });
        setVariantEditLineKey(lineKey);
        return;
      }
      setLines((prev) => {
        const line = prev.find((l) => l.key === lineKey);
        const fabric = isFabricCategory(line);
        const variant = (line?.availableVariants || []).find((v) => v.id === variantId);
        const sorted = sortAttrs(variant?.attributes || {});
        const { valid, errorMsg } = validateVariantInOrder(sorted, fabric);
        if (!valid) message.error({ content: errorMsg, key: 'variant-validation' });
        return prev.map((l) =>
          l.key === lineKey ? { ...l, variantId, variants: sorted, colorInvalid: !valid, baseQtyMatchAttr: null, selectedBuyerPoNo: null } : l,
        );
      });
      setIsDirty(true);
    },
    [validateVariantInOrder, updateLineMulti, isVariantDuplicate],
  );

  // ── Color-based quantity resolution ──────────────────────────────
  /**
   * Extract a variant attribute value by key (case-insensitive).
   */
  const getVariantAttr = useCallback((line, attrName) => {
    if (!line?.variants || typeof line.variants !== 'object') return null;
    const key = Object.keys(line.variants).find((k) => k.toLowerCase() === attrName.toLowerCase());
    return key ? String(line.variants[key]).trim() : null;
  }, []);

  /**
   * Get garment quantity for a BOM line based on category (Fabric vs Trims).
   *
   * FABRIC: Always Total basis — sum matching color qty across ALL order lines.
   *         No color attribute → use total order qty.
   *
   * TRIMS:  Uses per-line qtyCalcBasis (Total / Buyer PO).
   *         Matches by the user-selected attribute(s): color, size, or color+size.
   *         If no baseQtyMatchAttr selected yet → returns qty: 0 (pending config).
   *
   * Returns { qty, needsPoPick, matchingLines }.
   */
  const getColorQty = useCallback(
    (line) => {
      const fabric = isFabricCategory(line);

      if (fabric) {
        // ── FABRIC: always Total across all lines, match by color ──
        const color = getVariantAttr(line, 'color');
        if (!color) return { qty: orderQty || 0, needsPoPick: false, matchingLines: [] };

        let totalColorQty = 0;
        orderLineSummary.forEach((ol) => {
          const match = ol.colors.find((c) => c.name && c.name.trim().toLowerCase() === color.toLowerCase());
          if (match) totalColorQty += match.qty || 0;
        });
        return { qty: totalColorQty, needsPoPick: false, matchingLines: [] };
      }

      // ── TRIMS: per-line calc basis + attribute matching ──
      const calcBasis = line.qtyCalcBasis || 'TOTAL';
      const matchAttr = line.baseQtyMatchAttr; // 'color' | 'size' | 'color+size' | null

      // No attribute configured yet → qty not resolved
      if (!matchAttr) {
        return { qty: orderQty || 0, needsPoPick: false, matchingLines: [] };
      }

      const varColor = getVariantAttr(line, 'color');
      const varSize = getVariantAttr(line, 'size');

      // Build matching lines based on the chosen attribute(s)
      const matchingLines = [];
      orderLineSummary.forEach((ol) => {
        ol.colors.forEach((cr) => {
          if (matchAttr === 'color') {
            if (varColor && cr.name && cr.name.trim().toLowerCase() === varColor.toLowerCase()) {
              matchingLines.push({ buyerPoNo: ol.buyerPoNo, qty: cr.qty });
            }
          } else if (matchAttr === 'size') {
            // Sum the given size across all colors in this order line
            if (varSize && cr.quantities) {
              const sizeKey = Object.keys(cr.quantities).find((s) => s.trim().toLowerCase() === varSize.toLowerCase());
              if (sizeKey && cr.quantities[sizeKey]) {
                matchingLines.push({ buyerPoNo: ol.buyerPoNo, qty: cr.quantities[sizeKey] });
              }
            }
          } else if (matchAttr === 'color+size') {
            if (varColor && varSize && cr.name && cr.name.trim().toLowerCase() === varColor.toLowerCase() && cr.quantities) {
              const sizeKey = Object.keys(cr.quantities).find((s) => s.trim().toLowerCase() === varSize.toLowerCase());
              if (sizeKey && cr.quantities[sizeKey]) {
                matchingLines.push({ buyerPoNo: ol.buyerPoNo, qty: cr.quantities[sizeKey] });
              }
            }
          }
        });
      });

      // Deduplicate by buyerPoNo (sum if same PO matched multiple color rows for 'size' attr)
      const poMap = {};
      matchingLines.forEach((m) => {
        poMap[m.buyerPoNo] = (poMap[m.buyerPoNo] || 0) + m.qty;
      });
      const deduped = Object.entries(poMap).map(([buyerPoNo, qty]) => ({ buyerPoNo, qty }));

      if (calcBasis === QTY_CALC_BASIS.TOTAL) {
        const total = deduped.reduce((sum, m) => sum + (m.qty || 0), 0);
        return { qty: total, needsPoPick: false, matchingLines: deduped };
      }

      // Buyer PO basis
      if (line.selectedBuyerPoNo) {
        const match = deduped.find((m) => m.buyerPoNo === line.selectedBuyerPoNo);
        return { qty: match?.qty || 0, needsPoPick: false, matchingLines: deduped };
      }
      if (deduped.length === 1) {
        return { qty: deduped[0].qty, needsPoPick: false, matchingLines: deduped };
      }
      if (deduped.length > 1) {
        return { qty: 0, needsPoPick: true, matchingLines: deduped };
      }
      return { qty: 0, needsPoPick: false, matchingLines: [] };
    },
    [orderLineSummary, orderQty, getVariantAttr],
  );

  // ── Process selection & allowance popup ────────────────────────
  const openAllowanceDialog = useCallback(
    (lineKey, line, allSelectedProcesses) => {
      const consumption = line?.consumptionPerGarment || 0;
      const { qty: colorQty } = getColorQty(line);
      const base = consumption * colorQty;
      const wVariant = line?.variants?.W || line?.variants?.Width || line?.variants?.width || 0;
      const finWidth = Number(String(wVariant).replace(/[^0-9.]/g, '')) || 0;

      setAllowanceLineKey(lineKey);
      setAllowanceIsFabric(isFabricCategory(line));
      setAllowanceProcesses(
        allSelectedProcesses.map((p) => ({
          id: p.id,
          processName: p.processName,
          defaultShrinkageInches: p.defaultShrinkageInches ?? 0,
          defaultProcessLossPercent: p.defaultProcessLossPercent ?? 0,
          defaultRejectionPercent: p.defaultRejectionPercent ?? 0,
          defaultShipmentAllowancePercent: p.defaultShipmentAllowancePercent ?? 0,
        })),
      );
      setAllowanceFinishedWidth(finWidth);
      setAllowanceBaseQty(base);
      setAllowanceModalOpen(true);
    },
    [getColorQty],
  );

  /** Re-open allowance dialog with previously saved values for editing */
  const editAllowanceDialog = useCallback(
    (lineKey) => {
      const line = lines.find((l) => l.key === lineKey);
      if (!line || !line.processAllowances?.length) return;

      const consumption = line.consumptionPerGarment || 0;
      const { qty: colorQty } = getColorQty(line);
      const base = consumption * colorQty;
      const wVariant = line.variants?.W || line.variants?.Width || line.variants?.width || 0;
      const finWidth = Number(String(wVariant).replace(/[^0-9.]/g, '')) || 0;

      setAllowanceLineKey(lineKey);
      setAllowanceIsFabric(isFabricCategory(line));
      // Load saved allowance values as defaults so the dialog shows existing data
      setAllowanceProcesses(
        line.processAllowances.map((a) => ({
          id: a.processId,
          processName: a.processName,
          defaultShrinkageInches: a.shrinkageInches ?? 0,
          defaultProcessLossPercent: a.processLossPercent ?? 0,
          defaultRejectionPercent: a.rejectionPercent ?? 0,
          defaultShipmentAllowancePercent: a.shipmentAllowancePercent ?? 0,
        })),
      );
      setAllowanceFinishedWidth(finWidth);
      setAllowanceBaseQty(base);
      setAllowanceModalOpen(true);
    },
    [lines, getColorQty],
  );

  const handleProcessChange = useCallback(
    (lineKey, selectedProcessIds) => {
      const line = lines.find((l) => l.key === lineKey);
      const prevIds = line?.processes || [];
      updateLine(lineKey, 'processes', selectedProcessIds);

      const isAdding = selectedProcessIds.some((pid) => !prevIds.includes(pid));
      const allSelectedProcesses = selectedProcessIds
        .map((pid) => processesList.find((p) => p.id === pid))
        .filter(Boolean);

      if (!isAdding || allSelectedProcesses.length === 0) return;

      // Check if we need Buyer PO picker
      const { needsPoPick, matchingLines } = getColorQty(line);

      if (needsPoPick) {
        // Stash data and show Buyer PO picker first
        setBuyerPoPickerLineKey(lineKey);
        setBuyerPoPickerOptions(matchingLines);
        setPendingProcessData(allSelectedProcesses);
        setBuyerPoPickerOpen(true);
      } else {
        openAllowanceDialog(lineKey, line, allSelectedProcesses);
      }
    },
    [lines, processesList, updateLine, getColorQty, openAllowanceDialog],
  );

  const handleBuyerPoPick = useCallback(
    (buyerPoNo) => {
      if (!buyerPoPickerLineKey) return;
      // Set the selected PO on the line
      updateLine(buyerPoPickerLineKey, 'selectedBuyerPoNo', buyerPoNo);
      setBuyerPoPickerOpen(false);

      // Now open the allowance dialog with the updated line
      const line = lines.find((l) => l.key === buyerPoPickerLineKey);
      if (line && pendingProcessData) {
        // Compute with the selected PO's qty
        const selectedMatch = buyerPoPickerOptions.find((m) => m.buyerPoNo === buyerPoNo);
        const consumption = line.consumptionPerGarment || 0;
        const base = consumption * (selectedMatch?.qty || 0);
        const wVariant = line?.variants?.W || line?.variants?.Width || line?.variants?.width || 0;
        const finWidth = Number(String(wVariant).replace(/[^0-9.]/g, '')) || 0;

        setAllowanceLineKey(buyerPoPickerLineKey);
        setAllowanceIsFabric(isFabricCategory(line));
        setAllowanceProcesses(
          pendingProcessData.map((p) => ({
            id: p.id,
            processName: p.processName,
            defaultShrinkageInches: p.defaultShrinkageInches ?? 0,
            defaultProcessLossPercent: p.defaultProcessLossPercent ?? 0,
            defaultRejectionPercent: p.defaultRejectionPercent ?? 0,
            defaultShipmentAllowancePercent: p.defaultShipmentAllowancePercent ?? 0,
          })),
        );
        setAllowanceFinishedWidth(finWidth);
        setAllowanceBaseQty(base);
        setAllowanceModalOpen(true);
      }
      setPendingProcessData(null);
    },
    [buyerPoPickerLineKey, buyerPoPickerOptions, lines, pendingProcessData, updateLine],
  );

  const handleAllowanceApply = useCallback(
    (allowances) => {
      if (!allowanceLineKey) return;

      // Store allowances on the line
      updateLine(allowanceLineKey, 'processAllowances', allowances);
      setIsDirty(true);
      setAllowanceModalOpen(false);
    },
    [allowanceLineKey, lines, orderQty, updateLine],
  );

  // ── Add / Remove lines ─────────────────────────────────────────
  const addLine = useCallback(() => {
    setLines((prev) => [...prev, createEmptyLine()]);
    setIsDirty(true);
  }, []);

  const removeLine = useCallback(
    (key) => {
      setLines((prev) => prev.filter((l) => l.key !== key));
      setIsDirty(true);
    },
    [],
  );

  // ==================== TOTAL QTY CALCULATION ====================

  const computeTotalQty = useCallback(
    (line) => {
      const consumption = Number(line.consumptionPerGarment) || 0;
      if (!consumption) return 0;
      if (!isFabricCategory(line)) {
        // Trims: don't calculate until match-by is selected
        if (!line.baseQtyMatchAttr) return 0;
        // Trims + Buyer PO basis: don't calculate until a PO is selected
        if ((line.qtyCalcBasis || 'TOTAL') === QTY_CALC_BASIS.BUYER_PO && !line.selectedBuyerPoNo) return 0;
      }
      const { qty: colorQty } = getColorQty(line);
      return calcTrimsTotal(consumption, colorQty);
    },
    [getColorQty],
  );

  // ==================== PROCESS OPTIONS ====================

  const processOptions = useMemo(() => {
    return processesList
      .sort((a, b) => (a.processName || '').localeCompare(b.processName || ''))
      .map((p) => ({
        value: p.id,
        label: p.processName,
        process: p,
      }));
  }, [processesList]);

  // ==================== SUMMARY ====================

  const summary = useMemo(() => {
    const linesWithCategory = lines.filter((l) => l.categoryId);
    const total = linesWithCategory.length;
    const fabricLines = linesWithCategory.filter((l) => isFabricCategory(l)).length;
    const trimLines = total - fabricLines;
    const completedLines = lines.filter((l) => {
      if (!l.categoryId || !l.itemId || !l.consumptionPerGarment || !l.processes?.length) return false;
      if (!isFabricCategory(l) && !l.baseQtyMatchAttr) return false;
      return true;
    }).length;
    const totalPurchaseQty = lines.reduce((sum, l) => {
      const tq = computeTotalQty(l);
      if (!tq) return sum;
      const allowances = l.processAllowances || [];
      if (!allowances.length) return sum + tq;
      const loss = allowances.reduce((s, a) => s + (Number(a.processLossPercent) || 0), 0);
      const rej = allowances.reduce((s, a) => s + (Number(a.rejectionPercent) || 0), 0);
      const ship = allowances.reduce((s, a) => s + (Number(a.shipmentAllowancePercent) || 0), 0);
      return sum + calcPurchaseQty(tq, loss, rej + ship);
    }, 0);
    return { total, fabricLines, trimLines, completedLines, totalPurchaseQty };
  }, [lines, computeTotalQty]);

  // ==================== SAVE / SUBMIT ====================

  const buildPayload = (status) => {
    const cleanLines = lines.filter((l) => !l.isPoGenerated).map(({ key, availableVariants, primaryUom, primaryUomId, secondaryUom, secondaryUomId, itemName: _in, categoryName: _cn, subCategoryName: _sn, itemTypeName: _itn, colorInvalid: _ci, cadPreviewUrl: _cpu, _cadUploading, _cadFileName, _cadFileId, variants: _v, categoryId: _cid, subCategoryId: _scid, isPoGenerated: _ipg, ...rest }, idx) => ({
      ...rest,
      baseQty: (() => {
        const { qty } = getColorQty(lines[idx]);
        return qty || 0;
      })(),
      totalQty: computeTotalQty(lines[idx]),
      purchaseQty: (() => {
        const tq = computeTotalQty(lines[idx]);
        if (!tq) return 0;
        const allowances = rest.processAllowances || [];
        if (!allowances.length) return tq;
        const loss = allowances.reduce((s, a) => s + (Number(a.processLossPercent) || 0), 0);
        const rej = allowances.reduce((s, a) => s + (Number(a.rejectionPercent) || 0), 0);
        const ship = allowances.reduce((s, a) => s + (Number(a.shipmentAllowancePercent) || 0), 0);
        return calcPurchaseQty(tq, loss, rej + ship);
      })(),
      // Convert process IDs to objects for JSONB storage
      processes: (rest.processes || []).map((pid) => {
        const proc = processesList.find((p) => p.id === pid);
        return proc ? { id: proc.id, processName: proc.processName } : { id: pid };
      }),
    }));

    return {
      version: entityVersion,
      styleId: selectedStyleId,
      orderId,
      orderNo,
      orderQty,
      status,
      remarks,
      lines: cleanLines,
    };
  };

  /**
   * Validate BOM lines.
   * mode: 'draft' — all columns required except CAD
   * mode: 'submit' — all columns required including CAD for fabric
   * Returns { valid, errors[] }
   */
  const validateBom = (mode) => {
    const errors = [];
    if (!orderId) {
      errors.push('Order number is required.');
      return { valid: false, errors };
    }
    if (lines.length === 0) {
      errors.push('At least one BOM line is required.');
      return { valid: false, errors };
    }

    lines.forEach((l, idx) => {
      const n = idx + 1;
      const fabric = isFabricCategory(l);
      if (!l.categoryId) errors.push(`Line ${n}: Category is required.`);
      if (!l.subCategoryId) errors.push(`Line ${n}: Sub Category is required.`);
      if (!l.itemTypeId) errors.push(`Line ${n}: Item Type is required.`);
      if (!l.itemId) errors.push(`Line ${n}: Item is required.`);
      if (!l.variantId && (l.availableVariants || []).length > 1) errors.push(`Line ${n}: Variant selection is required.`);
      if (!l.consumptionPerGarment || Number(l.consumptionPerGarment) <= 0) errors.push(`Line ${n}: Consumption is required.`);
      if (!l.uom) errors.push(`Line ${n}: UOM is required.`);
      if (!l.partsName) errors.push(`Line ${n}: Parts Name is required.`);
      if (!l.processes?.length) errors.push(`Line ${n}: At least one process is required.`);
      if (!fabric) {
        // Trims: calc basis match-by is required
        if (!l.baseQtyMatchAttr) errors.push(`Line ${n}: Base quantity match-by is required. Open Calc Basis dialog.`);
        if ((l.qtyCalcBasis || 'TOTAL') === 'BUYER_PO' && !l.selectedBuyerPoNo) errors.push(`Line ${n}: Buyer PO selection is required.`);
      }
      if (mode === 'submit' && fabric && !l._cadFileId && !l.cadPreviewUrl) {
        errors.push(`Line ${n}: CAD marker file is required for submission.`);
      }
    });

    return { valid: errors.length === 0, errors };
  };

  const handleSaveDraft = async () => {
    const { valid, errors } = validateBom('draft');
    if (!valid) {
      message.warning(errors[0]);
      return;
    }

    setSavingDraft(true);
    try {
      const payload = buildPayload(BOM_STATUS.DRAFT);
      let saved;
      if (isEdit) {
        saved = await updateBom(id, payload);
        message.success('BOM saved as draft');
      } else {
        saved = await createBom(payload);
        message.success('BOM created as draft');
      }
      if (saved?.version != null) setEntityVersion(saved.version);
      setIsDirty(false);
      clearDirty();
      navigate('/bom/list');
    } catch {
      message.error('Failed to save BOM');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    const { valid, errors } = validateBom('submit');
    if (!valid) {
      message.warning(errors[0]);
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload(BOM_STATUS.CREATED);
      let saved;
      if (isEdit) {
        saved = await updateBom(id, payload);
        message.success('BOM updated successfully');
      } else {
        saved = await createBom(payload);
        message.success('BOM created successfully');
      }
      if (saved?.version != null) setEntityVersion(saved.version);
      setIsDirty(false);
      clearDirty();
      navigate('/bom/list');
    } catch {
      message.error('Failed to create BOM');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== TABLE COLUMNS ====================

  const columns = [
      // 1. #
      {
        title: '#',
        width: 55,
        fixed: 'left',
        align: 'center',
        render: (_, record, idx) => record.isPoGenerated
          ? <Tooltip title="PO placed — this line cannot be modified"><span style={{ color: '#faad14' }}>🔒</span></Tooltip>
          : idx + 1,
      },
      // 2. Category
      {
        title: 'Category',
        dataIndex: 'categoryId',
        width: 160,
        render: (value, record) => (
          <Select
            placeholder={!orderId ? 'Enter order first' : 'Category'}
            style={{ width: '100%' }}
            size="small"
            value={value || undefined}
            onChange={(v) => handleCategoryChange(record.key, v)}
            options={metaData.map((c) => ({ value: c.id, label: c.name }))}
            showSearch={{ optionFilterProp: 'label' }}
            disabled={!orderId}
          />
        ),
      },
      // 3. Sub Category
      {
        title: 'Sub Category',
        dataIndex: 'subCategoryId',
        width: 160,
        render: (value, record) => {
          const opts = getSubCategoriesForCategory(record.categoryId);
          return (
            <Select
              placeholder="Sub Category"
              style={{ width: '100%' }}
              size="small"
              value={value || undefined}
              onChange={(v) => handleSubCategoryChange(record.key, v, record.categoryId)}
              options={opts.map((sc) => ({ value: sc.id, label: sc.name }))}
              showSearch={{ optionFilterProp: 'label' }}
              disabled={!record.categoryId}
            />
          );
        },
      },
      // 4. Item Type
      {
        title: 'Item Type',
        dataIndex: 'itemTypeId',
        width: 160,
        render: (value, record) => {
          const opts = getItemTypesForSubCategory(record.categoryId, record.subCategoryId);
          return (
            <Select
              placeholder="Item Type"
              style={{ width: '100%' }}
              size="small"
              value={value || undefined}
              onChange={(v) => handleItemTypeChange(record.key, v, record.categoryId, record.subCategoryId)}
              options={opts.map((it) => ({ value: it.id, label: it.name }))}
              showSearch={{ optionFilterProp: 'label' }}
              disabled={!record.subCategoryId}
            />
          );
        },
      },
      // 5. Item Name (autocomplete search)
      {
        title: 'Item Name',
        dataIndex: 'itemName',
        width: 280,
        render: (value, record) => (
          <BomItemSearch
            value={value || ''}
            onSelect={(item) => handleBomItemSelect(record.key, item)}
            onClear={() => {
              const doClear = () => updateLineMulti(record.key, { ...resetItemFields });
              confirmIfHasData(record.key, doClear);
            }}
            disabled={!record.itemTypeId}
            categoryId={record.categoryId}
            subCategoryId={record.subCategoryId}
            itemTypeId={record.itemTypeId}
          />
        ),
      },
      // 6. Item Code (read-only)
      {
        title: 'Item Code',
        dataIndex: 'itemCode',
        width: 100,
        align: 'center',
        render: (value) => <Text type="secondary" style={{ fontSize: 12 }}>{value || '-'}</Text>,
      },
      // 7. Variant (resizable)
      {
        title: (
          <div style={{ position: 'relative', userSelect: 'none' }}>
            Variant
            <div
              className="variant-col-resize-handle"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const startX = e.clientX;
                const startW = variantColWidthRef.current;
                const onMove = (ev) => {
                  const diff = ev.clientX - startX;
                  const newW = Math.max(140, startW + diff);
                  variantColWidthRef.current = newW;
                  setVariantColWidth(newW);
                };
                const onUp = () => {
                  document.removeEventListener('mousemove', onMove);
                  document.removeEventListener('mouseup', onUp);
                  document.body.style.cursor = '';
                  document.body.style.userSelect = '';
                };
                document.body.style.cursor = 'col-resize';
                document.body.style.userSelect = 'none';
                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
              }}
            />
          </div>
        ),
        width: variantColWidth,
        render: (_, record) => {
          const variants = record.availableVariants || [];
          if (variants.length > 1 && !record.variantId) {
            const shouldAutoOpen = variantEditLineKey === record.key;
            return (
              <Select
                placeholder="Select variant"
                style={{ width: '100%', minWidth: 180 }}
                size="small"
                value={record.variantId || undefined}
                onChange={(v) => { setVariantEditLineKey(null); handleVariantSelect(record.key, v); }}
                showSearch={{ optionFilterProp: 'label' }}
                open={shouldAutoOpen || undefined}
                ref={(node) => {
                  if (shouldAutoOpen && node) {
                    setTimeout(() => { node.focus(); }, 50);
                  }
                }}
                onDropdownVisibleChange={(open) => { if (!open) setVariantEditLineKey(null); }}
                options={variants.map((v) => {
                  const entries = Object.entries(v.attributes || {});
                  entries.sort(([a], [b]) => a.toLowerCase() === 'color' ? -1 : b.toLowerCase() === 'color' ? 1 : 0);
                  return { value: v.id, label: entries.map(([k, val]) => `${k}: ${val}`).join(' | ') };
                })}
              />
            );
          }
          const tags = variantsToTags(record.variants);
          if (tags.length === 0) return <div style={{ textAlign: 'center' }}><Text type="secondary">—</Text></div>;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {variants.length > 1 && (
                <Tooltip title="Change variant">
                  <EditOutlined
                    style={{ fontSize: 13, color: '#1677ff', cursor: 'pointer', flexShrink: 0 }}
                    onClick={() => {
                      const line = lines.find((l) => l.key === record.key);
                      if (line?.baseQtyMatchAttr || line?.selectedBuyerPoNo) {
                        Modal.confirm({
                          title: 'Change variant?',
                          content: 'Calculation basis and match-by selection for this line will be reset. Continue?',
                          okText: 'Yes, change',
                          okType: 'danger',
                          cancelText: 'Cancel',
                          onOk: () => { setVariantEditLineKey(record.key); handleVariantSelect(record.key, null); },
                        });
                      } else {
                        setVariantEditLineKey(record.key);
                        handleVariantSelect(record.key, null);
                      }
                    }}
                  />
                </Tooltip>
              )}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {tags.map((t) => (
                  <Tag key={t} color="geekblue" style={{ margin: 0, fontSize: 11 }}>{t}</Tag>
                ))}
              </div>
            </div>
          );
        },
      },
      // 9. Consumption/Garment
      {
        title: 'Consumption',
        dataIndex: 'consumptionPerGarment',
        width: 110,
        render: (value, record) => (
          <InputNumber
            min={0}
            step={0.001}
            precision={4}
            size="small"
            style={{ width: '100%' }}
            placeholder={record.colorInvalid ? 'Invalid color' : !record.itemId ? 'Select item first' : !record.variantId && (record.availableVariants || []).length > 1 ? 'Select variant first' : '0.0000'}
            value={value}
            onChange={(v) => updateLine(record.key, 'consumptionPerGarment', v)}
            controls={false}
            disabled={record.colorInvalid || !record.itemId || (!record.variantId && (record.availableVariants || []).length > 1)}
          />
        ),
      },
      // 10. UOM
      {
        title: 'UOM',
        dataIndex: 'uom',
        width: 100,
        render: (value, record) => {
          const primary = record.primaryUom;
          const secondary = record.secondaryUom;
          const hasSecondary = secondary && secondary !== primary;
          if (!hasSecondary) {
            // No secondary — just show the symbol centered
            return <div style={{ textAlign: 'center' }}><Text strong style={{ fontSize: 12 }}>{(primary || value || '-').toUpperCase()}</Text></div>;
          }
          // Both primary and secondary — show dropdown
          const opts = [
            { value: primary, label: primary.toUpperCase() },
            { value: secondary, label: secondary.toUpperCase() },
          ];
          return (
            <Select
              style={{ width: '100%' }}
              size="small"
              value={value || primary || undefined}
              onChange={(v) => updateLine(record.key, 'uom', v)}
              options={opts}
            />
          );
        },
      },
      // 11. Parts Name
      {
        title: 'Parts Name',
        dataIndex: 'partsName',
        width: 140,
        render: (value, record) => (
          <Select
            placeholder="Select part"
            style={{ width: '100%' }}
            size="small"
            value={value || undefined}
            onChange={(v) => updateLine(record.key, 'partsName', v)}
            showSearch
            allowClear
            mode="tags"
            options={partsList.map((p) => ({ value: p.partName, label: p.partName }))}
          />
        ),
      },
      // 12. Process (multi-select + edit allowance button)
      {
        title: 'Process',
        dataIndex: 'processes',
        width: 250,
        render: (value, record) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Select
              mode="multiple"
              placeholder={!record.consumptionPerGarment ? 'Enter consumption first' : 'Processes'}
              style={{ flex: 1 }}
              size="small"
              value={value || []}
              onChange={(v) => handleProcessChange(record.key, v)}
              options={processOptions}
              showSearch={{ optionFilterProp: 'label' }}
              disabled={!record.consumptionPerGarment}
            />
            {(record.processAllowances?.length > 0) && (
              <Tooltip title="Edit allowances">
                <EditOutlined
                  style={{ fontSize: 13, color: '#1677ff', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => editAllowanceDialog(record.key)}
                />
              </Tooltip>
            )}
          </div>
        ),
      },
      // 13. Calc Basis (fabric: read-only total, trims: radio buttons + match-by edit)
      {
        title: 'Calc Basis',
        width: 180,
        align: 'center',
        render: (_, record) => {
          const fabric = isFabricCategory(record);
          const color = getVariantAttr(record, 'color');

          if (fabric) {
            // Show only after variant is selected and color is valid
            if (!record.variantId || record.colorInvalid) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
            const { qty } = getColorQty(record);
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 10px', borderRadius: 12,
                  background: 'var(--oq-color-row-strong)',
                  border: '1px solid var(--oq-total-cell)',
                }}>
                  <Text style={{ fontSize: 11, color: 'var(--primary-color, #1677ff)' }}>{color || 'All'}</Text>
                  <Text strong style={{ fontSize: 13, color: 'var(--primary-color, #1677ff)' }}>{qty.toLocaleString()}</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 10 }}>Total across all order lines</Text>
              </div>
            );
          }

          // Trims — show after variant is selected and valid
          if (!record.variantId || record.colorInvalid) return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;

          const matchLabel = record.baseQtyMatchAttr === 'color' ? 'Color'
            : record.baseQtyMatchAttr === 'size' ? 'Size'
            : record.baseQtyMatchAttr === 'color+size' ? 'Color+Size' : null;
          const { qty } = getColorQty(record);

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
              <Radio.Group
                size="small"
                value={record.qtyCalcBasis || 'TOTAL'}
                onChange={(e) => updateLineMulti(record.key, {
                  qtyCalcBasis: e.target.value,
                  selectedBuyerPoNo: null,
                  baseQtyMatchAttr: null,
                })}
                optionType="button"
                buttonStyle="solid"
              >
                <Radio.Button value="TOTAL" style={{ fontSize: 11, padding: '0 8px' }}>Total Qty</Radio.Button>
                <Radio.Button value="BUYER_PO" style={{ fontSize: 11, padding: '0 8px' }}>Buyer PO</Radio.Button>
              </Radio.Group>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Button
                  size="small"
                  type="link"
                  style={{ padding: 0, fontSize: 11, height: 'auto' }}
                  icon={<EditOutlined style={{ fontSize: 11 }} />}
                  onClick={() => { setMatchByLineKey(record.key); setMatchByModalOpen(true); }}
                >
                  {matchLabel ? `By ${matchLabel}` : 'Match by…'}
                </Button>
                {matchLabel && qty > 0 && (
                  <Tag style={{ fontSize: 10, margin: 0 }}>Base: {qty.toLocaleString()}</Tag>
                )}
              </div>
            </div>
          );
        },
      },
      // 14. Total Qty
      {
        title: 'Total Qty',
        width: 100,
        align: 'center',
        render: (_, record) => {
          const total = computeTotalQty(record);
          return (
            <Tag color={total ? 'blue' : 'default'} style={{ fontSize: 12 }}>
              {total != null ? total.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '-'}
            </Tag>
          );
        },
      },
      // 15. Purchase Qty (Total Qty + allowances)
      {
        title: 'Purchase Qty',
        width: 110,
        align: 'center',
        render: (_, record) => {
          const totalQty = computeTotalQty(record);
          if (!totalQty) return <div style={{ textAlign: 'center' }}><Text type="secondary">—</Text></div>;
          const allowances = record.processAllowances || [];
          if (allowances.length === 0) return <div style={{ textAlign: 'center' }}><Text type="secondary">—</Text></div>;
          const totalLoss = allowances.reduce((s, a) => s + (Number(a.processLossPercent) || 0), 0);
          const totalRej = allowances.reduce((s, a) => s + (Number(a.rejectionPercent) || 0), 0);
          const totalShipment = allowances.reduce((s, a) => s + (Number(a.shipmentAllowancePercent) || 0), 0);
          const purchaseQty = calcPurchaseQty(totalQty, totalLoss, totalRej + totalShipment);
          return (
            <Tag color="green" style={{ fontSize: 12 }}>
              {purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </Tag>
          );
        },
      },
      // 16. CAD Marker (fabric only)
      {
        title: 'CAD Marker',
        width: 100,
        align: 'center',
        render: (_, record) => {
          if (!isFabricCategory(record)) return <div style={{ textAlign: 'center' }}><Text type="secondary">—</Text></div>;
          const isDisabled = record.colorInvalid || !record.itemId || (!record.variantId && (record.availableVariants || []).length > 1);

          // Show preview if CAD is uploaded
          if (record.cadPreviewUrl || record._cadFileId) {
            return (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {record.cadPreviewUrl ? (
                  <Popover
                    content={<img src={record.cadPreviewUrl} alt="CAD Marker" style={{ maxWidth: 500, maxHeight: 500, borderRadius: 6 }} />}
                    title="CAD Marker Preview"
                    trigger="hover"
                    placement="left"
                  >
                    <img
                      src={record.cadPreviewUrl}
                      alt="CAD"
                      style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-color, #d9d9d9)', cursor: 'pointer' }}
                    />
                  </Popover>
                ) : (
                  <Tooltip title={record._cadFileName || 'CAD uploaded'}>
                    <UploadOutlined style={{ fontSize: 16, color: '#10b981' }} />
                  </Tooltip>
                )}
                {record._cadUploading ? (
                  <Spin size="small" />
                ) : (
                  <Tooltip title="Remove CAD">
                    <DeleteOutlined
                      style={{ fontSize: 12, color: '#ff4d4f', cursor: 'pointer' }}
                      onClick={async () => {
                        if (record._cadFileId) {
                          try { await deleteFile(record._cadFileId); } catch { /* ignore */ }
                        }
                        updateLineMulti(record.key, { cadPreviewUrl: null, _cadFileId: null, _cadFileName: null });
                      }}
                    />
                  </Tooltip>
                )}
              </div>
            );
          }

          return (
            <Upload
              maxCount={1}
              showUploadList={false}
              disabled={isDisabled || record._cadUploading}
              beforeUpload={async (file) => {
                // Show preview for image files, icon for others
                const isImage = file.type?.startsWith('image/');
                const previewUrl = isImage ? URL.createObjectURL(file) : null;
                updateLineMulti(record.key, { cadPreviewUrl: previewUrl, _cadFileName: file.name, _cadUploading: true });
                try {
                  const result = await uploadFile(file, {
                    module: 'BOM',
                    entity: 'BOM_LINE',
                    entityId: record.id || 0,
                    fileCategory: 'CAD_MARKER',
                  });
                  const uploaded = result?.data || result;
                  updateLineMulti(record.key, { _cadFileId: uploaded.fileId, _cadUploading: false });
                  message.success('CAD marker uploaded');
                } catch {
                  message.error('Failed to upload CAD marker');
                  updateLineMulti(record.key, { cadPreviewUrl: null, _cadFileName: null, _cadUploading: false });
                }
                return false;
              }}
            >
              <Button
                size="small"
                type="text"
                icon={record._cadUploading ? <LoadingOutlined spin /> : <UploadOutlined />}
                disabled={isDisabled || record._cadUploading}
              />
            </Upload>
          );
        },
      },
      // 17. Actions
      {
        title: '',
        width: 70,
        fixed: 'right',
        align: 'center',
        render: (_, record) => record.isPoGenerated ? (
            <Tooltip title="PO placed — cannot delete"><Button type="text" size="small" icon={<DeleteOutlined />} disabled /></Tooltip>
        ) : (
            <Popconfirm
              title="Remove this line?"
              onConfirm={() => removeLine(record.key)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="text" danger size="small" icon={<DeleteOutlined />} />
            </Popconfirm>
        ),
      },
    ];

  // ==================== ROW CLASS ====================

  const rowClassName = (record) => {
    return record.isPoGenerated ? 'bom-line-po-locked' : '';
  };

  // ==================== RENDER ====================

  if (loading && !lines.length) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin indicator={<LoadingOutlined style={{ fontSize: 36 }} spin />} tip="Loading BOM..." />
      </div>
    );
  }

  const canSave = hasPermission('bom', isEdit ? 'update' : 'add');

  return (
    <div className="animate-fade-in-up">
      {/* ── Header (sticky) ─────────────────────────────────────── */}
      <div
        className="page-header"
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <Space align="center">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/bom/list')}
          />
          <Title level={4} style={{ margin: 0 }}>
            {isEdit ? 'Edit BOM' : 'Create BOM'}
          </Title>
          {orderNo && (
            <Tag color="blue" style={{ fontSize: 13 }}>
              {orderNo}
            </Tag>
          )}
        </Space>
        <div className="header-actions">
          {canSave && (
            <>
              <Button
                icon={<SaveOutlined />}
                loading={savingDraft}
                onClick={handleSaveDraft}
              >
                Save Draft
              </Button>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={submitting}
                onClick={handleSubmit}
              >
                Create BOM
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Section A: General Info ─────────────────────────────── */}
      <Card style={{ marginBottom: 24 }} loading={loading && !bomFromState}>
        <Title level={5} style={{ marginBottom: 16 }}>
          General Information
        </Title>
        <Row gutter={[24, 16]}>
          <Col xs={24} md={8} lg={4}>
            <div style={{ marginBottom: 4 }}>
              {!isEdit && <Text strong style={{ color: 'var(--error-color, #ff4d4f)' }}>* </Text>}
              <Text strong>Order No</Text>
            </div>
            <Input
              placeholder="SG/25-26/1001"
              value={orderNoInput || (isEdit ? '' : 'SG/')}
              onChange={(e) => !isEdit && setOrderNoInput(formatOrderNo(e.target.value, orderNoInput))}
              onBlur={!isEdit ? handleOrderNoBlur : undefined}
              suffix={orderLoading ? <LoadingOutlined spin /> : null}
              disabled={isEdit}
            />
          </Col>
          <Col xs={24} md={8} lg={4}>
            <div style={{ marginBottom: 4 }}>
              <Text strong>Style No</Text>
            </div>
            <Input value={styleNo} disabled placeholder="Populated from order" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
          </Col>
          <Col xs={24} md={8} lg={4}>
            <div style={{ marginBottom: 4 }}>
              <Text strong>Garment Name</Text>
            </div>
            <Input value={garmentName} disabled placeholder="Populated from style" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
          </Col>
          <Col xs={24} md={8} lg={4}>
            <div style={{ marginBottom: 4 }}>
              <Text strong>Material</Text>
            </div>
            <Input value={material} disabled placeholder="Populated from order" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
          </Col>
          <Col xs={24} md={8} lg={4}>
            <div style={{ marginBottom: 4 }}>
              <Text strong>Buyer</Text>
            </div>
            <Input value={buyerName} disabled placeholder="Populated from style" style={{ backgroundColor: 'var(--bg-tertiary)' }} />
          </Col>
          <Col xs={24} md={8} lg={4}>
            <div style={{ marginBottom: 4 }}>
              <Text strong>Order Qty</Text>
            </div>
            <InputNumber
              style={{ width: '100%', height: 40 }}
              min={0}
              precision={0}
              placeholder="Populated from order"
              value={orderQty}
              disabled
              controls={false}
            />
          </Col>
          <Col xs={24}>
            <Row gutter={[24, 12]} style={{ marginTop: 8 }}>
              <Col xs={24}>
                <div style={{ marginBottom: 8 }}>
                  <Text strong>Order Summary</Text>
                  {orderLineSummary.length > 0 && (
                    <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                      {orderLineSummary.length} Buyer PO{orderLineSummary.length > 1 ? 's' : ''} · {colors.length} Color{colors.length > 1 ? 's' : ''}
                    </Text>
                  )}
                </div>
                {orderSummaryLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                    <Spin size="small" />
                    <Text type="secondary" style={{ fontSize: 12 }}>Loading order summary...</Text>
                  </div>
                ) : orderLineSummary.length > 0 ? (
                  <Row gutter={[12, 12]}>
                    {orderLineSummary.map((line, idx) => (
                      <Col key={idx} xs={24} sm={12} md={8}>
                        <Card
                          size="small"
                          style={{ borderRadius: 8, background: 'var(--bg-tertiary, #fafafa)', borderLeft: '3px solid #1677ff' }}
                          styles={{ body: { padding: '10px 14px' } }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text strong style={{ fontSize: 13 }}>{line.buyerPoNo}</Text>
                            <Text strong style={{ fontSize: 15, color: '#1677ff' }}>{line.lineQty.toLocaleString()}</Text>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {line.colors.map((c, ci) => (
                              <Tag key={ci} style={{ margin: 0, fontSize: 11 }}>
                                {c.name}: <strong>{c.qty.toLocaleString()}</strong>
                              </Tag>
                            ))}
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                ) : (
                  <Text type="secondary">Populated from order lines</Text>
                )}
              </Col>
            </Row>
          </Col>
        </Row>
      </Card>

      {/* ── Section B: BOM Line Items ──────────────────────────── */}
      <Card
        style={{ marginBottom: 24 }}
        title={
          <Space>
            <Title level={5} style={{ margin: 0 }}>
              BOM Line Items
            </Title>
            <Tag>{lines.length} lines</Tag>
          </Space>
        }
        extra={
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addLine}
            disabled={!canSave || !orderId}
          >
            Add Line
          </Button>
        }
      >
        <div style={!orderId ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
        <ConfigProvider
          theme={{
            components: {
              Table: {
                rowHoverBg: isDarkMode ? '#263245' : '#f0f5ff',
                fixedHeaderSortActiveBg: isDarkMode ? '#1e293b' : '#ffffff',
              },
            },
          }}
        >
          <Table
            className="bom-lines-table"
            dataSource={lines}
            columns={columns}
            rowKey="key"
            pagination={false}
            scroll={{ x: 2200 }}
            size="small"
            bordered
            rowClassName={rowClassName}
          />
        </ConfigProvider>
        </div>
        <style>{`
          .bom-lines-table .ant-table-thead > tr > th {
            text-align: center !important;
          }
          :root {
            --oq-color-row: rgba(22,119,255,0.04);
            --oq-color-row-strong: rgba(22,119,255,0.08);
            --oq-size-row: rgba(114,46,209,0.04);
            --oq-size-cell: rgba(114,46,209,0.1);
            --oq-size-header: rgba(114,46,209,0.06);
            --oq-total-cell: rgba(22,119,255,0.06);
          }
          [data-theme="dark"] {
            --oq-color-row: rgba(96,165,250,0.1);
            --oq-color-row-strong: rgba(96,165,250,0.18);
            --oq-size-row: rgba(167,139,250,0.1);
            --oq-size-cell: rgba(167,139,250,0.2);
            --oq-size-header: rgba(167,139,250,0.12);
            --oq-total-cell: rgba(96,165,250,0.12);
          }
          .variant-col-resize-handle {
            position: absolute;
            right: -5px;
            top: 0;
            bottom: 0;
            width: 10px;
            cursor: col-resize;
            z-index: 1;
          }
          .variant-col-resize-handle:hover,
          .variant-col-resize-handle:active {
            border-right: 2px solid #1677ff;
          }
          .bom-line-po-locked > td {
            opacity: 0.6;
            pointer-events: none;
          }
          .bom-line-po-locked > td:first-child,
          .bom-line-po-locked > td:last-child {
            opacity: 1;
            pointer-events: auto;
          }
        `}</style>
      </Card>

      {/* ── Section C: Summary ─────────────────────────────────── */}
      <Card style={{ marginBottom: 24 }}>
        <Title level={5} style={{ marginBottom: 16 }}>Summary</Title>
        <Row gutter={[16, 16]}>
          {[
            { title: 'Total Lines', value: summary.total, color: '#1677ff', span: { xs: 12, sm: 8, md: 4 } },
            { title: 'Fabric', value: summary.fabricLines, color: '#6366f1', span: { xs: 12, sm: 8, md: 4 } },
            { title: 'Trims', value: summary.trimLines, color: '#10b981', span: { xs: 12, sm: 8, md: 4 } },
            {
              title: 'Completed',
              value: summary.completedLines,
              color: summary.completedLines === summary.total && summary.total > 0 ? '#10b981' : '#faad14',
              extra: `/ ${summary.total}`,
              icon: summary.completedLines === summary.total && summary.total > 0 ? 'check' : 'warn',
              span: { xs: 12, sm: 8, md: 5 },
            },
            { title: 'Total Purchase Qty', value: summary.totalPurchaseQty, color: '#1677ff', precision: 2, span: { xs: 24, sm: 16, md: 7 } },
          ].map((card) => (
            <Col key={card.title} {...card.span}>
              <Card size="small" style={{ borderRadius: 8, textAlign: 'center', borderLeft: `3px solid ${card.color}` }} styles={{ body: { padding: '12px 16px' } }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #8c8c8c)', marginBottom: 4 }}>{card.title}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>
                  {card.icon === 'check' && <CheckCircleOutlined style={{ fontSize: 18, marginRight: 6 }} />}
                  {card.icon === 'warn' && <WarningOutlined style={{ fontSize: 18, marginRight: 6 }} />}
                  {card.precision != null ? Number(card.value).toLocaleString(undefined, { minimumFractionDigits: card.precision, maximumFractionDigits: card.precision }) : card.value}
                  {card.extra && <span style={{ fontSize: 13, color: 'var(--text-muted, #8c8c8c)', fontWeight: 400, marginLeft: 2 }}>{card.extra}</span>}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
        <div style={{ marginTop: 16 }}>
          <Text strong>Remarks</Text>
          <Text type="secondary" style={{ marginLeft: 6, fontSize: 11 }}>(optional)</Text>
          <TextArea
            rows={3}
            placeholder="Additional notes or remarks..."
            value={remarks}
            onChange={(e) => {
              setRemarks(e.target.value);
              setIsDirty(true);
            }}
            style={{ marginTop: 8 }}
          />
        </div>
      </Card>


      {/* ── Process Allowance Modal ────────────────────────────── */}
      <ProcessAllowanceModal
        open={allowanceModalOpen}
        processes={allowanceProcesses}
        finishedWidth={allowanceFinishedWidth}
        baseQty={allowanceBaseQty}
        isFabric={allowanceIsFabric}
        onApply={handleAllowanceApply}
        onCancel={() => setAllowanceModalOpen(false)}
      />

      {/* Buyer PO Picker — shown when Buyer PO basis + color in multiple lines */}
      <Modal
        title="Select Buyer PO"
        open={buyerPoPickerOpen}
        onCancel={() => { setBuyerPoPickerOpen(false); setPendingProcessData(null); }}
        footer={null}
        width={400}
        destroyOnClose
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          This color exists in multiple Buyer POs. Select which PO to use for quantity calculation.
        </Text>
        <Space direction="vertical" style={{ width: '100%' }} size={8}>
          {buyerPoPickerOptions.map((opt) => (
            <Card
              key={opt.buyerPoNo}
              size="small"
              hoverable
              style={{ cursor: 'pointer', borderLeft: '3px solid #1677ff' }}
              styles={{ body: { padding: '10px 14px' } }}
              onClick={() => handleBuyerPoPick(opt.buyerPoNo)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>{opt.buyerPoNo}</Text>
                <Text strong style={{ color: '#1677ff', fontSize: 16 }}>{opt.qty.toLocaleString()} pcs</Text>
              </div>
            </Card>
          ))}
        </Space>
      </Modal>

      {/* Trims Match By — shows order qty breakdown so user can decide which attribute to match */}
      <Modal
        title="Select Base Quantity Matching"
        open={matchByModalOpen}
        onCancel={() => setMatchByModalOpen(false)}
        footer={null}
        width={560}
        destroyOnClose
      >
        {(() => {
          const line = lines.find((l) => l.key === matchByLineKey);
          if (!line) return null;
          const varColor = getVariantAttr(line, 'color');
          const varSize = getVariantAttr(line, 'size');

          // Build attribute options
          const attrOpts = [];
          if (varSize) attrOpts.push({ value: 'size', label: `Size: ${varSize}` });
          if (varColor) attrOpts.push({ value: 'color', label: `Color: ${varColor}` });
          if (varSize && varColor) attrOpts.push({ value: 'color+size', label: `Size + Color: ${varSize} / ${varColor}` });

          // Filter order lines: show rows where color OR size matches (so user sees
          // the full picture for every match-by option)
          const filteredLines = orderLineSummary.map((ol) => {
            const relevantColors = ol.colors.filter((cr) => {
              const colorMatch = varColor && cr.name && cr.name.trim().toLowerCase() === varColor.toLowerCase();
              const sizeMatch = varSize && cr.quantities && Object.keys(cr.quantities).some(
                (s) => s.trim().toLowerCase() === varSize.toLowerCase() && cr.quantities[s] > 0,
              );
              return colorMatch || sizeMatch;
            });
            if (relevantColors.length === 0) return null;
            return { ...ol, colors: relevantColors };
          }).filter(Boolean);

          // Collect sizes — only show the matching size column if variant has size
          const sizesSet = new Set();
          filteredLines.forEach((ol) => ol.colors.forEach((c) => {
            if (c.quantities) Object.keys(c.quantities).forEach((s) => sizesSet.add(s));
          }));
          const allSizes = [...sizesSet];
          const sizes = varSize
            ? allSizes.filter((s) => s.trim().toLowerCase() === varSize.toLowerCase())
            : allSizes;

          // Build qty preview — must match getColorQty logic exactly
          const previewQty = (attr) => {
            let total = 0;
            const basis = line.qtyCalcBasis || 'TOTAL';
            // Use original orderLineSummary (not filteredLines) to match getColorQty
            orderLineSummary.forEach((ol) => {
              if (basis === QTY_CALC_BASIS.BUYER_PO && line.selectedBuyerPoNo && ol.buyerPoNo !== line.selectedBuyerPoNo) return;
              ol.colors.forEach((cr) => {
                if (attr === 'color') {
                  if (varColor && cr.name && cr.name.trim().toLowerCase() === varColor.toLowerCase()) total += cr.qty;
                } else if (attr === 'size') {
                  if (varSize && cr.quantities) {
                    const sk = Object.keys(cr.quantities).find((s) => s.trim().toLowerCase() === varSize.toLowerCase());
                    if (sk) total += cr.quantities[sk];
                  }
                } else if (attr === 'color+size') {
                  if (varColor && varSize && cr.name && cr.name.trim().toLowerCase() === varColor.toLowerCase() && cr.quantities) {
                    const sk = Object.keys(cr.quantities).find((s) => s.trim().toLowerCase() === varSize.toLowerCase());
                    if (sk) total += cr.quantities[sk];
                  }
                }
              });
            });
            return total;
          };

          // Buyer PO dropdown: POs where ANY variant attribute (color OR size) matches
          const matchingPOs = orderLineSummary.filter((ol) => {
            const hasColorMatch = varColor && ol.colors.some((cr) => cr.name && cr.name.trim().toLowerCase() === varColor.toLowerCase());
            const hasSizeMatch = varSize && ol.colors.some((cr) =>
              cr.quantities && Object.keys(cr.quantities).some((s) => s.trim().toLowerCase() === varSize.toLowerCase()),
            );
            return hasColorMatch || hasSizeMatch;
          });

          const isBuyerPoBasis = (line.qtyCalcBasis || 'TOTAL') === QTY_CALC_BASIS.BUYER_PO;
          const poSelected = isBuyerPoBasis && line.selectedBuyerPoNo;
          // For Buyer PO basis, scope display lines to selected PO
          const displayLines = isBuyerPoBasis && poSelected
            ? filteredLines.filter((ol) => ol.buyerPoNo === line.selectedBuyerPoNo)
            : filteredLines;
          const showQtySection = !isBuyerPoBasis || poSelected;

          return (
            <div>
              {/* Variant info */}
              <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--bg-tertiary, #fafafa)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Text strong style={{ fontSize: 12 }}>Selected Variant:</Text>
                <Text style={{ fontSize: 12 }}>{line.itemCode} - {line.itemName}</Text>
                {varColor && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(22,119,255,0.1)', color: '#1677ff', border: '1px solid rgba(22,119,255,0.25)' }}>Color: {varColor}</Tag>}
                {varSize && <Tag style={{ fontSize: 11, margin: 0, background: 'rgba(114,46,209,0.1)', color: '#722ed1', border: '1px solid rgba(114,46,209,0.25)' }}>Size: {varSize}</Tag>}
              </div>

              {/* Buyer PO selection — shown first when Buyer PO basis */}
              {isBuyerPoBasis && (
                <div style={{ marginBottom: 16 }}>
                  <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Select Buyer PO</Text>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                    Only POs containing the selected variant attributes are shown
                  </Text>
                  {matchingPOs.length === 0 ? (
                    <Text type="secondary" style={{ fontSize: 12 }}>No matching Buyer POs found for this variant.</Text>
                  ) : (
                    <Select
                      style={{ width: '100%' }}
                      placeholder="Select Buyer PO to proceed"
                      value={line.selectedBuyerPoNo || undefined}
                      onChange={(v) => updateLine(matchByLineKey, 'selectedBuyerPoNo', v)}
                      options={matchingPOs.map((ol) => ({ value: ol.buyerPoNo, label: `${ol.buyerPoNo} (${ol.lineQty.toLocaleString()} pcs)` }))}
                    />
                  )}
                </div>
              )}

              {/* Order Qty + Match By — shown only after PO is selected (for Buyer PO basis) or always (for Total) */}
              {showQtySection && (
                <>
                  {/* Order Qty breakdown */}
                  <div style={{ marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                      Order Quantities
                      <Text type="secondary" style={{ fontSize: 11, marginLeft: 6, fontWeight: 400 }}>
                        (rows matching {varColor ? 'color' : ''}{varColor && varSize ? ' or ' : ''}{varSize ? 'size' : ''} of the selected variant{poSelected ? ` — ${line.selectedBuyerPoNo}` : ''})
                      </Text>
                    </Text>
                    {displayLines.length === 0 ? (
                      <Text type="secondary" style={{ fontSize: 12 }}>No matching order data found.</Text>
                    ) : (
                    <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border-color, #f0f0f0)', borderRadius: 6 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-tertiary, #fafafa)' }}>
                            <th style={{ padding: '4px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-color, #f0f0f0)' }}>
                              {displayLines.length > 1 ? 'PO / Color' : 'Color'}
                            </th>
                            {sizes.map((s) => (
                              <th key={s} style={{
                                padding: '4px 6px', textAlign: 'center', borderBottom: '1px solid var(--border-color, #f0f0f0)',
                                background: 'var(--oq-size-header)',
                              }}>{s}</th>
                            ))}
                            <th style={{ padding: '4px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color, #f0f0f0)', fontWeight: 700 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayLines.map((ol) =>
                            ol.colors.map((cr, ci) => {
                              const isColorMatch = varColor && cr.name && cr.name.trim().toLowerCase() === varColor.toLowerCase();
                              const hasSizeMatch = varSize && cr.quantities && Object.keys(cr.quantities).some(
                                (s) => s.trim().toLowerCase() === varSize.toLowerCase() && cr.quantities[s] > 0,
                              );
                              const isBothMatch = isColorMatch && hasSizeMatch;
                              return (
                                <tr key={`${ol.buyerPoNo}-${ci}`} style={{
                                  background: isBothMatch ? 'var(--oq-color-row-strong)' : isColorMatch ? 'var(--oq-color-row)' : 'var(--oq-size-row)',
                                }}>
                                  <td style={{ padding: '3px 8px', borderBottom: '1px solid var(--border-color, #f5f5f5)', whiteSpace: 'nowrap' }}>
                                    {displayLines.length > 1 && <Text type="secondary" style={{ fontSize: 10 }}>{ol.buyerPoNo} / </Text>}
                                    <Text strong={isColorMatch} style={{ fontSize: 11 }}>{cr.name}</Text>
                                    {isColorMatch && <Tag style={{ fontSize: 9, margin: '0 0 0 4px', lineHeight: '14px', padding: '0 4px', background: 'var(--oq-color-row-strong)', color: 'var(--primary-color, #1677ff)', border: '1px solid var(--oq-total-cell)' }}>color</Tag>}
                                  </td>
                                  {sizes.map((s) => {
                                    const val = cr.quantities?.[s] || 0;
                                    const isCellMatch = varSize && s.trim().toLowerCase() === varSize.toLowerCase() && val > 0;
                                    return (
                                      <td key={s} style={{
                                        padding: '3px 6px', textAlign: 'center', borderBottom: '1px solid var(--border-color, #f5f5f5)',
                                        background: isCellMatch ? 'var(--oq-size-cell)' : undefined,
                                        fontWeight: isCellMatch ? 700 : 400,
                                      }}>{val || '-'}</td>
                                    );
                                  })}
                                  <td style={{
                                    padding: '3px 8px', textAlign: 'center', borderBottom: '1px solid var(--border-color, #f5f5f5)', fontWeight: 600,
                                    background: isColorMatch ? 'var(--oq-total-cell)' : undefined,
                                  }}>{cr.qty.toLocaleString()}</td>
                                </tr>
                              );
                            }),
                          )}
                        </tbody>
                      </table>
                    </div>
                    )}
                  </div>

                  {/* Match by options */}
                  <div style={{ marginBottom: 6 }}>
                    <Text strong style={{ fontSize: 12 }}>Match Base Quantity By</Text>
                    <div><Text type="secondary" style={{ fontSize: 11 }}>Click on a card below to select how the base quantity should be calculated</Text></div>
                  </div>
                  <Space direction="vertical" style={{ width: '100%' }} size={6}>
                    {attrOpts.map((opt) => {
                      const qty = previewQty(opt.value);
                      const isSelected = line.baseQtyMatchAttr === opt.value;
                      const noMatch = qty <= 0;
                      return (
                        <Card
                          key={opt.value}
                          size="small"
                          hoverable={!noMatch}
                          style={{
                            cursor: noMatch ? 'not-allowed' : 'pointer',
                            borderLeft: isSelected ? '3px solid #1677ff' : '3px solid transparent',
                            background: isSelected ? 'rgba(22,119,255,0.08)' : noMatch ? 'rgba(0,0,0,0.02)' : undefined,
                            opacity: noMatch ? 0.5 : 1,
                          }}
                          styles={{ body: { padding: '8px 12px' } }}
                          onClick={() => {
                            if (noMatch) return;
                            updateLineMulti(matchByLineKey, { baseQtyMatchAttr: opt.value });
                            setMatchByModalOpen(false);
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {isSelected && <span style={{ color: '#1677ff', fontSize: 14, fontWeight: 700 }}>✓</span>}
                              <Text strong={isSelected} style={{ fontSize: 12, color: isSelected ? '#1677ff' : noMatch ? 'var(--text-muted)' : undefined }}>{opt.label}</Text>
                            </div>
                            <Tag color={noMatch ? 'default' : 'blue'} style={{ fontSize: 12, margin: 0 }}>
                              {noMatch ? 'No match' : `${qty.toLocaleString()} pcs`}
                            </Tag>
                          </div>
                        </Card>
                      );
                    })}
                  </Space>
                </>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* ── Auto-generated row styling ─────────────────────────── */}
      <style>{`
      `}</style>
    </div>
  );
};

export default BOMForm;
