import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  App,
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
  Spin,
  Skeleton,
  AutoComplete,
  Tooltip,
  Modal,
  Row,
  Col,
  ConfigProvider,
  Segmented,
  Image,
} from 'antd';
import { numericInputProps, formattedIdKeyDown } from '../../utils/inputHelpers';
import {
  DeleteOutlined,
  LoadingOutlined,
  UploadOutlined,
  EditOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import { hasPermission } from '../../utils/permissions';
import { createBom, updateBom, getBomById } from '../../services/bom/bomService';
import { getActiveProcesses } from '../../services/master/processService';
import { getOrderByOrderNo, getRecentOrders } from '../../services/orders/orderService';
import { searchItems, getItemMetaData, getItemsByIds } from '../../services/master/itemService';
import { getActiveParts } from '../../services/master/partsService';
import { uploadFile, deleteFile, downloadFileAsBlob, getFilesByEntity } from '../../services/core/fileService';
import {
  BOM_STATUS,
  QTY_CALC_BASIS,
  CONSUMPTION_MODE,
  CONSUMPTION_MODE_OPTIONS,
  calcLinePurchaseQty,
  calcTrimsTotal,
  buildOrderQtyGrid,
  calcMatrixTotal,
} from '../../utils/bomConstants';
import { conversionApplies, convertToPrimary, formatConversionLabel } from '../../utils/uomConversions';
import ProcessAllowanceModal from './ProcessAllowanceModal';
import ConsumptionMatrixDialog from './ConsumptionMatrixDialog';
import ConsumptionCalcModal from '../costing/ConsumptionCalcModal';

import { ActionButton, DeleteConfirm, SectionAddButton } from '../../components/buttons';
import { FormSection } from '../../components/form';
import RecentSuggestionsButton from '../../components/RecentSuggestionsButton';
import PageHeader from '../../components/PageHeader';

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
  uomConversionFactor: null,
  purchaseUom: '',
  partsName: '',
  consumptionPerGarment: null,
  colorInvalid: false, // true when variant color not found in order lines
  overrideBaseQty: null, // manual base qty when variant color not in order (fabric only)
  qtyCalcBasis: 'TOTAL', // per-line calc basis
  consumptionMode: 'SIMPLE', // 'SIMPLE', 'SIZE_WISE', 'VARIANT_PER_SIZE'
  consumptionMatrix: null, // { color: { size: consumption } }
  variantMapping: null, // { size: variantId } for VARIANT_PER_SIZE
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

/** Check if a BOM line's category is Trims */
const isTrimCategory = (line) => (line?.categoryName || '').toLowerCase().includes('trim');

/** Check if a BOM line's category is applicable for BOM (only Fabric & Trims) */
const isBomApplicableCategory = (line) => isFabricCategory(line) || isTrimCategory(line);

/** Auto-format order number: user types after "SG/" prefix, auto-inserts - and / */
const formatOrderNo = (raw, prev = '') => {
  const prefix = 'SG/';
  if (!raw || raw.length < prefix.length) return prefix;
  const isDeleting = raw.length < prev.length;
  if (isDeleting && raw.length <= prefix.length) return prefix;
  let digits = raw.slice(prefix.length).replace(/[^0-9]/g, '');
  // When deleting and the removed char was a separator (- or /),
  // also remove the digit before it so backspace feels natural
  if (isDeleting && prev.length > prefix.length) {
    const removedChar = prev[raw.length];
    if (removedChar === '-' || removedChar === '/') {
      digits = digits.slice(0, -1);
    }
  }
  let result = prefix;
  for (let i = 0; i < digits.length; i++) {
    if (i === 2) result += '-';
    if (i === 4) result += '/';
    result += digits[i];
  }
  if (!isDeleting) {
    if (digits.length === 2 && !result.endsWith('-')) result += '-';
    if (digits.length === 4 && !result.endsWith('/')) result += '/';
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

// ==================== COMPONENT ====================

const BOMForm = () => {
  const { message, modal } = App.useApp();
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
  const [loading, setLoading] = useState(isEdit);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [entityVersion, setEntityVersion] = useState(null);
  const [bomStatus, setBomStatus] = useState(null);

  // ── Section A: General Info ──────────────────────────────────────
  const [orderNoInput, setOrderNoInput] = useState('');
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSummaryLoading, setOrderSummaryLoading] = useState(false);
  const [orderId, setOrderId] = useState(null);
  const [orderNo, setOrderNo] = useState('');
  const [selectedStyleId, setSelectedStyleId] = useState(null);
  const [styleImageUrl, setStyleImageUrl] = useState(null);
  const [styleImageLoading, setStyleImageLoading] = useState(false);
  const imageLoadIdRef = useRef(0);
  const [styleNo, setStyleNo] = useState('');
  const [garmentName, setGarmentName] = useState('');
  const [material, setMaterial] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [colors, setColors] = useState([]);
  const [orderLineSummary, setOrderLineSummary] = useState([]); // [{ buyerPoNo, colors: [{ name, qty }], lineQty }]
  const [orderQty, setOrderQty] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);

  // Fetch recently created orders (suggestions) — only relevant when creating a new BOM
  useEffect(() => {
    if (isEdit) return;
    getRecentOrders().then(setRecentOrders).catch(() => setRecentOrders([]));
  }, [isEdit]);

  const recentOrderItems = useMemo(
    () => recentOrders.map((o) => ({
      value: o.orderNo,
      label: [o.orderNo, o.styleNo, o.buyerName].filter(Boolean).join(' · '),
    })),
    [recentOrders],
  );

  // Derive union of all sizes from order line summary
  const allSizes = useMemo(() => {
    const sizeSet = new Set();
    const sizeOrder = [];
    orderLineSummary.forEach((ol) => {
      (ol.colors || []).forEach((cr) => {
        Object.keys(cr.quantities || {}).forEach((s) => {
          if (s && !sizeSet.has(s.trim().toLowerCase())) {
            sizeSet.add(s.trim().toLowerCase());
            sizeOrder.push(s.trim());
          }
        });
      });
    });
    return sizeOrder;
  }, [orderLineSummary]);
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
  const [matrixDialogLineKey, setMatrixDialogLineKey] = useState(null);

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

  // ── AI Consumption Calculator Modal ────────────────────────────
  const [consumptionModalOpen, setConsumptionModalOpen] = useState(false);
  const [consumptionLineKey, setConsumptionLineKey] = useState(null);
  const [consumptionFabricRow, setConsumptionFabricRow] = useState(null);

  // ==================== LOAD DROPDOWN DATA ====================

  const dropdownFetchedRef = useRef(false);
  useEffect(() => {
    if (dropdownFetchedRef.current) return;
    dropdownFetchedRef.current = true;
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

  const bomFetchedRef = useRef(false);
  useEffect(() => {
    if (!isEdit) return;
    if (bomFetchedRef.current) return;
    bomFetchedRef.current = true;
    const loadBom = async () => {
      setLoading(true);
      try {
        // Use location state if lines available, otherwise fetch from API (direct URL access)
        const bom = bomFromState?.lines?.length > 0 ? bomFromState : await getBomById(id);

        // Set header fields from BOM
        setBomStatus(bom.status || null);
        setEntityVersion(bom.version);
        setOrderId(bom.orderId);
        setOrderNo(bom.orderNo || '');
        setOrderNoInput(bom.orderNo || '');
        setSelectedStyleId(bom.styleId);
        if (bom.styleId) loadStyleImage(bom.styleId);
        setStyleNo(bom.styleName || '');
        setGarmentName(bom.garmentName || '');
        setMaterial(bom.material || '');
        setBuyerName(bom.buyerName || '');
        setOrderQty(bom.orderQty);
        setRemarks(bom.remarks || '');

        if (bom.lines?.length > 0) {
          // Step 1: Map lines from BOM response
          let mappedLines = bom.lines.map((l) => {
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
              variantCode: l.variantCode || '',
              variantName: l.variantName || '',
              availableVariants: [],
              primaryUom: l.uom || '',
              primaryUomId: null,
              secondaryUom: '',
              secondaryUomId: null,
              uom: l.uom || '',
              // Saved snapshot — kept so PO-generated/untouched lines still render their
              // original conversion; refreshed from the item master just below when editable.
              uomConversionFactor: l.uomConversionFactor ?? null,
              purchaseUom: l.purchaseUom || '',
              partsName: l.partsName || [],
              consumptionPerGarment: l.consumptionPerGarment,
              processes: Array.isArray(l.processes) ? l.processes.map((p) => (typeof p === 'object' ? p.id : p)) : [],
              processAllowances: l.processAllowances || [],
              qtyCalcBasis: l.qtyCalcBasis || 'TOTAL',
              consumptionMode: l.consumptionMode || 'SIMPLE',
              consumptionMatrix: l.consumptionMatrix || null,
              variantMapping: l.variantMapping || null,
              totalQty: l.totalQty,
              _savedBaseQty: l.baseQty || null,
              cadPreviewUrl: null,
              _cadFileId: null,
              isPoGenerated: l.isPoGenerated || false,
              remarks: l.remarks || '',
            };
          });
          // Step 2: Bulk fetch item details (variants, UOM, itemTypeId) before rendering
          const itemIds = [...new Set(bom.lines.map((l) => l.itemId).filter(Boolean))];
          if (itemIds.length > 0) {
            try {
              const res = await getItemsByIds(itemIds);
              const items = res?.data || res || [];
              const itemMap = {};
              (Array.isArray(items) ? items : []).forEach((item) => { itemMap[item.id] = item; });
              mappedLines = mappedLines.map((line) => {
                const item = itemMap[line.itemId];
                if (!item) return line;
                const activeVariants = (item.variants || []).filter((v) => v.isActive !== false);
                return {
                  ...line,
                  availableVariants: activeVariants,
                  primaryUom: item.uomSymbol || line.primaryUom,
                  primaryUomId: item.uomId ?? null,
                  secondaryUom: item.secondaryUomSymbol || '',
                  secondaryUomId: item.secondaryUomId ?? null,
                  // Editable lines follow the item master's current factor; the saved
                  // snapshot only survives on locked (PO-generated) lines.
                  uomConversionFactor: item.uomConversionFactor ?? line.uomConversionFactor ?? null,
                  itemTypeId: line.itemTypeId || item.itemTypeId || null,
                };
              });
            } catch {
              /* item details unavailable — variant editing won't work */
            }
          }

          setLines(mappedLines);

          // Load CAD files for fabric lines only (async, non-blocking — doesn't block skeleton)
          const linesWithId = mappedLines.filter((l) => l.id && isFabricCategory(l));
          for (const l of linesWithId) {
            getFilesByEntity('BOM_LINE', l.id)
              .then((files) => {
                const cadFile = (files?.data || files || []).find((f) => f.fileCategory === 'CAD_MARKER');
                if (!cadFile) return;
                return downloadFileAsBlob(cadFile.fileId).then((blob) => {
                  const url = URL.createObjectURL(blob);
                  setLines((prev) => prev.map((line) =>
                    line.id === l.id ? { ...line, cadPreviewUrl: url, _cadFileId: cadFile.fileId, _cadFileName: cadFile.originalFilename } : line,
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
        // Defer so React paints the form with populated values before hiding the skeleton
        requestAnimationFrame(() => setLoading(false));
      }
    };
    loadBom();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  // Lazy-load order summary for edit mode (non-blocking, runs after form renders)
  const orderSummaryFetchedRef = useRef(false);
  useEffect(() => {
    if (!isEdit || !orderNo || orderSummaryFetchedRef.current) return;
    orderSummaryFetchedRef.current = true;
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

  const handleOrderNoBlur = async (eOrVal) => {
    const val = (typeof eOrVal === 'string' ? eOrVal : eOrVal?.target?.value)?.trim();
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

      // Use styleId and garmentName directly from order response
      const resolvedStyleId = order.styleId || null;
      const resolvedGarmentName = order.garmentName || '';

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
      loadStyleImage(resolvedStyleId);
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
      loadStyleImage(null);
    } finally {
      setOrderLoading(false);
    }
  };

  // ==================== STYLE IMAGE LOADER ====================

  const loadStyleImage = async (sId) => {
    const loadId = ++imageLoadIdRef.current;
    setStyleImageUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    if (!sId) { setStyleImageLoading(false); return; }
    setStyleImageLoading(true);
    try {
      const files = await getFilesByEntity('STYLE', sId);
      if (loadId !== imageLoadIdRef.current) return;
      const img = (files || []).find((f) => ['IMAGE', 'PHOTO'].includes(f.fileCategory));
      if (!img) return;
      const blob = await downloadFileAsBlob(img.fileId);
      if (loadId !== imageLoadIdRef.current) return;
      setStyleImageUrl(URL.createObjectURL(blob));
    } catch {
      // Non-critical
    } finally {
      if (loadId === imageLoadIdRef.current) setStyleImageLoading(false);
    }
  };

  // Cleanup style image blob URL on unmount
  useEffect(() => {
    return () => {
      setStyleImageUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    };
  }, []);

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
      modal.confirm({
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
    primaryUom: '', secondaryUom: '', uom: '', uomConversionFactor: null, purchaseUom: '',
    consumptionPerGarment: null, colorInvalid: false,
    partsName: '', processes: [], processAllowances: [],
    consumptionMode: 'SIMPLE', consumptionMatrix: null, variantMapping: null,
  };

  // Holds the latest populateLineFromItem so the earlier-defined handleItemTypeChange
  // can call it without a temporal-dead-zone reference.
  const populateLineFromItemRef = useRef(null);

  const handleCategoryChange = useCallback(
    (lineKey, categoryId) => {
      const doChange = () => {
        const cat = metaData.find((c) => c.id === categoryId);
        const catName = cat?.name || '';
        const tempLine = { categoryName: catName };
        if (catName && !isBomApplicableCategory(tempLine)) {
          message.warning('Only Fabric and Trims categories are applicable for BOM.');
        }
        updateLineMulti(lineKey, {
          categoryId, categoryName: catName,
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
      const doChange = async () => {
        const cat = metaData.find((c) => c.id === categoryId);
        const sub = (cat?.subCategories || []).find((sc) => sc.id === subCategoryId);
        const it = (sub?.itemTypes || []).find((t) => t.id === itemTypeId);
        updateLineMulti(lineKey, {
          itemTypeId, itemTypeName: it?.name || '',
          ...resetItemFields,
        });
        // The Category + Sub-Category + Item Type combination uniquely identifies one item.
        // Resolve it and load its variants into the Variant dropdown.
        try {
          const res = await searchItems({ categoryId, subCategoryId, itemTypeId, page: 0, size: 1, isActive: true });
          const payload = res?.data || res || {};
          const item = Array.isArray(payload) ? payload[0] : payload?.content?.[0];
          if (item) {
            populateLineFromItemRef.current?.(lineKey, item);
          } else {
            message.warning('No item exists for this Category / Sub-Category / Item Type. Create it in Item Master first.');
          }
        } catch {
          message.error('Failed to load the item for the selected classifiers.');
        }
      };
      confirmIfHasData(lineKey, doChange);
    },
    [metaData, updateLineMulti, confirmIfHasData, message],
  );

  /**
   * Partial color match: variant color "18-1655 TCX / Mars Red" should match
   * order color "18-1655", "Mars Red", "Red", etc.
   * Splits both on common separators (/ , -) and checks if any token from the
   * order color appears in the variant color or vice-versa.
   */
  const colorMatchesPartial = useCallback((variantColor, orderColor) => {
    if (!variantColor || !orderColor) return false;
    const vc = variantColor.trim().toLowerCase();
    const oc = orderColor.trim().toLowerCase();
    // Exact match
    if (vc === oc) return true;
    // Direct substring containment
    if (vc.includes(oc) || oc.includes(vc)) return true;
    // Token-based: split variant on " / ", "/", " - " separators → check each token
    const variantTokens = vc.split(/\s*[\/]\s*/).map((t) => t.trim()).filter(Boolean);
    const orderTokens = oc.split(/\s*[\/]\s*/).map((t) => t.trim()).filter(Boolean);
    return variantTokens.some((vt) =>
      orderTokens.some((ot) => vt.includes(ot) || ot.includes(vt)),
    );
  }, []);

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
      const color = colorKey ? String(variants[colorKey]).trim() : null;
      const size = sizeKey ? String(variants[sizeKey]).trim().toLowerCase() : null;

      if (fabric) {
        // Fabric: validate color only (partial match for Pantone-style names)
        if (!color) return { valid: true };
        const found = orderLineSummary.some((ol) =>
          ol.colors.some((c) => c.name && colorMatchesPartial(color, c.name)),
        );
        return found
          ? { valid: true }
          : { valid: false, errorMsg: `Color "${variants[colorKey]}" not found in order lines.` };
      }

      // Trims: check if color or size exists in order data
      if (!color && !size) return { valid: true }; // no matchable attributes

      const colorExists = color && orderLineSummary.some((ol) =>
        ol.colors.some((c) => c.name && colorMatchesPartial(color, c.name)),
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
    [orderLineSummary, colorMatchesPartial],
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
  // Populate a BOM line from the item resolved for its Category + Sub-Category + Item Type,
  // loading the item's active variants into the Variant dropdown. Item is uniquely identified
  // by the classifier combination, so there is no separate item-name search.
  const populateLineFromItem = useCallback(
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
          setVariantEditLineKey(lineKey); // auto-open variant dropdown
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
          // uom is the CONSUMPTION unit — what consumption/garment is entered in
          uom: item.secondaryUomSymbol || item.uomSymbol || '',
          // Snapshotted at save time so the PO quantity converts to the purchase UOM.
          uomConversionFactor: item.uomConversionFactor ?? null,
          availableVariants: activeVariants,
          variantId: firstVariant?.id || null,
          variantCode: firstVariant?.variantCode || '',
          variantName: firstVariant?.variantName || '',
          variants: firstVariant ? selectedAttrs : {},
          colorInvalid: firstVariant ? !valid : false,
          consumptionPerGarment: null,
          partsName: '',
          processes: [],
          processAllowances: [],
        });
        if (!valid) message.warning({ content: errorMsg, key: 'variant-validation' });
      };
      confirmIfHasData(lineKey, doChange);
    },
    [lines, updateLineMulti, validateVariantInOrder, isVariantDuplicate, confirmIfHasData],
  );
  populateLineFromItemRef.current = populateLineFromItem;

  // ── Variant selection (when item has multiple variants) ─────────
  const handleVariantSelect = useCallback(
    (lineKey, variantId) => {
      if (variantId === null) {
        updateLineMulti(lineKey, { variantId: null, variantCode: '', variantName: '', variants: {}, colorInvalid: false, overrideBaseQty: null, consumptionMatrix: null, variantMapping: null });
        return;
      }
      // Check duplicate
      if (isVariantDuplicate(variantId, lineKey)) {
        message.error({ content: 'This variant is already added to another BOM line. Please select a different variant.', key: 'variant-duplicate' });
        // Clear selection and keep dropdown open
        updateLineMulti(lineKey, { variantId: null, variantCode: '', variantName: '', variants: {}, colorInvalid: false, overrideBaseQty: null, consumptionMatrix: null, variantMapping: null });
        setVariantEditLineKey(lineKey);
        return;
      }
      setLines((prev) => {
        const line = prev.find((l) => l.key === lineKey);
        const fabric = isFabricCategory(line);
        const variant = (line?.availableVariants || []).find((v) => v.id === variantId);
        const sorted = sortAttrs(variant?.attributes || {});
        const { valid, errorMsg } = validateVariantInOrder(sorted, fabric);
        if (!valid) message.warning({ content: errorMsg, key: 'variant-validation' });
        return prev.map((l) =>
          l.key === lineKey ? { ...l, variantId, variantCode: variant?.variantCode || '', variantName: variant?.variantName || '', variants: sorted, colorInvalid: !valid, overrideBaseQty: !valid ? l.overrideBaseQty : null, consumptionMatrix: null, variantMapping: null } : l,
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

  /** Check if a fabric line's variant color is NOT found in any order line (partial match). */
  const isFabricColorMissing = useCallback((line) => {
    if (!isFabricCategory(line) || !line.variantId) return false;
    const color = getVariantAttr(line, 'color');
    if (!color) return false;
    if (orderLineSummary.length === 0) return false;
    return !orderLineSummary.some((ol) =>
      ol.colors.some((c) => c.name && colorMatchesPartial(color, c.name))
    );
  }, [orderLineSummary, getVariantAttr, colorMatchesPartial]);

  /**
   * Get garment quantity for a BOM line based on category (Fabric vs Trims).
   *
   * FABRIC: Always Total basis — sum matching color qty across ALL order lines.
   *         No color attribute → use total order qty.
   *
   * TRIMS:  Uses per-line qtyCalcBasis (Total / Buyer PO).
   *         Matches by the user-selected attribute(s): color, size, or color+size.
   *         SIMPLE mode: returns total order qty.
   *
   * Returns { qty, needsPoPick, matchingLines }.
   */
  const getColorQty = useCallback(
    (line) => {
      const fabric = isFabricCategory(line);

      if (fabric) {
        // ── FABRIC: always Total across all lines, match by color (partial) ──
        const color = getVariantAttr(line, 'color');
        if (!color) return { qty: orderQty || 0, needsPoPick: false, matchingLines: [] };

        let totalColorQty = 0;
        orderLineSummary.forEach((ol) => {
          const match = ol.colors.find((c) => c.name && colorMatchesPartial(color, c.name));
          if (match) totalColorQty += match.qty || 0;
        });

        // If color not found in order, use manual override or saved base qty
        if (totalColorQty === 0) {
          const override = line.overrideBaseQty || line._savedBaseQty;
          if (override > 0) return { qty: Number(override), needsPoPick: false, matchingLines: [] };
        }
        return { qty: totalColorQty, needsPoPick: false, matchingLines: [] };
      }

      // ── TRIMS (SIMPLE mode): use total order qty ──
      // Matrix modes are handled by computeMatrixTotalQty, not this function.
      return { qty: orderQty || 0, needsPoPick: false, matchingLines: [] };
    },
    [orderLineSummary, orderQty, getVariantAttr, colorMatchesPartial],
  );

  // Compute total qty for matrix modes (SIZE_WISE / VARIANT_PER_SIZE)
  const computeMatrixTotalQty = useCallback(
    (line) => {
      if (!line.consumptionMatrix) return 0;
      const orderQtyGrid = buildOrderQtyGrid(orderLineSummary);
      return calcMatrixTotal(line.consumptionMatrix, orderQtyGrid);
    },
    [orderLineSummary],
  );

  // ── Process selection & allowance popup ────────────────────────
  const openAllowanceDialog = useCallback(
    (lineKey, line, allSelectedProcesses) => {
      const cMode = line?.consumptionMode || 'SIMPLE';
      const isMatrixMode = cMode === CONSUMPTION_MODE.SIZE_WISE || cMode === CONSUMPTION_MODE.VARIANT_PER_SIZE;

      let base;
      if (isMatrixMode) {
        base = computeMatrixTotalQty(line);
      } else {
        const consumption = line?.consumptionPerGarment || 0;
        const { qty: colorQty } = getColorQty(line);
        base = consumption * colorQty;
      }
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
    [getColorQty, computeMatrixTotalQty],
  );

  /** Re-open allowance dialog with previously saved values for editing */
  const editAllowanceDialog = useCallback(
    (lineKey) => {
      const line = lines.find((l) => l.key === lineKey);
      if (!line) return;

      const cMode = line.consumptionMode || 'SIMPLE';
      const isMatrixMode = cMode === CONSUMPTION_MODE.SIZE_WISE || cMode === CONSUMPTION_MODE.VARIANT_PER_SIZE;

      let base;
      if (isMatrixMode) {
        base = computeMatrixTotalQty(line);
      } else {
        const consumption = line.consumptionPerGarment || 0;
        const { qty: colorQty } = getColorQty(line);
        base = consumption * colorQty;
      }
      const wVariant = line.variants?.W || line.variants?.Width || line.variants?.width || 0;
      const finWidth = Number(String(wVariant).replace(/[^0-9.]/g, '')) || 0;

      setAllowanceLineKey(lineKey);
      setAllowanceIsFabric(isFabricCategory(line));

      // Build process list from ALL currently selected processes,
      // merging saved allowance values where available
      const savedAllowanceMap = {};
      (line.processAllowances || []).forEach((a) => { savedAllowanceMap[a.processId] = a; });

      const allSelectedProcesses = (line.processes || [])
        .map((pid) => processesList.find((p) => p.id === pid))
        .filter(Boolean);

      setAllowanceProcesses(
        allSelectedProcesses.map((p) => {
          const saved = savedAllowanceMap[p.id];
          if (saved) {
            return {
              id: p.id,
              processName: p.processName,
              defaultShrinkageInches: saved.shrinkageInches ?? p.defaultShrinkageInches ?? 0,
              defaultProcessLossPercent: saved.processLossPercent ?? p.defaultProcessLossPercent ?? 0,
              defaultRejectionPercent: saved.rejectionPercent ?? p.defaultRejectionPercent ?? 0,
              defaultShipmentAllowancePercent: saved.shipmentAllowancePercent ?? p.defaultShipmentAllowancePercent ?? 0,
              sizeAllowances: saved.sizeAllowances || {},
            };
          }
          return {
            id: p.id,
            processName: p.processName,
            defaultShrinkageInches: p.defaultShrinkageInches ?? 0,
            defaultProcessLossPercent: p.defaultProcessLossPercent ?? 0,
            defaultRejectionPercent: p.defaultRejectionPercent ?? 0,
            defaultShipmentAllowancePercent: p.defaultShipmentAllowancePercent ?? 0,
            sizeAllowances: {},
          };
        }),
      );
      setAllowanceFinishedWidth(finWidth);
      setAllowanceBaseQty(base);
      setAllowanceModalOpen(true);
    },
    [lines, getColorQty, computeMatrixTotalQty, processesList],
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
      // Matrix modes for trims
      if (line.consumptionMode === CONSUMPTION_MODE.SIZE_WISE || line.consumptionMode === CONSUMPTION_MODE.VARIANT_PER_SIZE) {
        return computeMatrixTotalQty(line);
      }
      // SIMPLE mode (trims and fabric)
      const consumption = Number(line.consumptionPerGarment) || 0;
      if (!consumption) return 0;
      const { qty: colorQty } = getColorQty(line);
      return calcTrimsTotal(consumption, colorQty);
    },
    [getColorQty, computeMatrixTotalQty],
  );

  // ==================== PROCESS OPTIONS ====================

  /** All process options (sorted) */
  const allProcessOptions = useMemo(() => {
    return processesList
      .sort((a, b) => (a.processName || '').localeCompare(b.processName || ''))
      .map((p) => ({
        value: p.id,
        label: p.processName,
        process: p,
      }));
  }, [processesList]);

  /** Filtered process options per line category */
  const getProcessOptionsForLine = useCallback((line) => {
    const fabric = isFabricCategory(line);
    const matchCategory = fabric ? 'fabric' : 'trims';
    return allProcessOptions.filter((opt) => {
      const cat = (opt.process.category || '').toLowerCase();
      // Show if: category matches, or is "general", or no category set
      return !cat || cat === 'general' || cat === matchCategory;
    });
  }, [allProcessOptions]);

  // Backward-compat: flat list used in other places (allowance dialog, payload builder)
  const processOptions = allProcessOptions;

  // ==================== SUMMARY ====================

  const summary = useMemo(() => {
    const linesWithCategory = lines.filter((l) => l.categoryId);
    const total = linesWithCategory.length;
    const fabricLines = linesWithCategory.filter((l) => isFabricCategory(l)).length;
    const trimLines = total - fabricLines;
    const completedLines = lines.filter((l) => {
      if (!l.categoryId || !l.itemId || !l.processes?.length) return false;
      const cMode = l.consumptionMode || 'SIMPLE';
      const isMatrix = cMode === CONSUMPTION_MODE.SIZE_WISE || cMode === CONSUMPTION_MODE.VARIANT_PER_SIZE;
      if (isMatrix) {
        if (!l.consumptionMatrix || Object.keys(l.consumptionMatrix).length === 0) return false;
      } else {
        if (!l.consumptionPerGarment) return false;
      }
      return true;
    }).length;
    const totalPurchaseQty = lines.reduce((sum, l) => {
      const qty = calcLinePurchaseQty(l, computeTotalQty(l), buildOrderQtyGrid(orderLineSummary), allSizes);
      return sum + (qty || 0);
    }, 0);
    return { total, fabricLines, trimLines, completedLines, totalPurchaseQty };
  }, [lines, computeTotalQty, orderLineSummary, allSizes]);

  // ==================== AI CONSUMPTION CALCULATOR ====================

  const openConsumptionModal = useCallback((lineKey, record) => {
    setConsumptionLineKey(lineKey);
    setConsumptionFabricRow({
      fabricType: record.itemName || '',
      description: record.itemCode || '',
      classification: '', // AI will determine from measurement chart
    });
    setConsumptionModalOpen(true);
  }, []);

  const handleConsumptionApply = useCallback(({ splitBySizes, consumption, uom, consumptionPerSize, sizes }) => {
    if (!consumptionLineKey) return;
    if (!splitBySizes) {
      updateLine(consumptionLineKey, 'consumptionPerGarment', consumption);
    } else {
      const values = Object.values(consumptionPerSize || {});
      if (values.length) {
        const avg = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10000) / 10000;
        updateLine(consumptionLineKey, 'consumptionPerGarment', avg);
        message.info(`Applied average consumption (${avg}) across ${values.length} sizes.`);
      }
    }
    setIsDirty(true);
  }, [consumptionLineKey, updateLine]);

  // ==================== SAVE / SUBMIT ====================

  const buildPayload = (status) => {
    const cleanLines = lines.filter((l) => !l.isPoGenerated).map(({ key, availableVariants, primaryUom, primaryUomId, secondaryUom, secondaryUomId, itemName: _in, categoryName: _cn, subCategoryName: _sn, itemTypeName: _itn, colorInvalid: _ci, overrideBaseQty: _obq, _savedBaseQty, cadPreviewUrl: _cpu, _cadUploading, _cadFileName, _cadFileId, _cadStagedFile, _cadToDelete, variants: _v, categoryId: _cid, subCategoryId: _scid, isPoGenerated: _ipg, ...rest }, idx) => ({
      ...rest,
      // For VARIANT_PER_SIZE, clear variantId (variants come from variantMapping)
      variantId: rest.consumptionMode === CONSUMPTION_MODE.VARIANT_PER_SIZE ? null : rest.variantId,
      baseQty: (() => {
        const line = lines[idx];
        if (line.consumptionMode === CONSUMPTION_MODE.SIZE_WISE || line.consumptionMode === CONSUMPTION_MODE.VARIANT_PER_SIZE) {
          return computeMatrixTotalQty(line);
        }
        const { qty } = getColorQty(line);
        return qty || 0;
      })(),
      totalQty: computeTotalQty(lines[idx]),
      // purchaseQty stays in the consumption (secondary) UOM; purchaseQtyPrimary is the
      // converted figure the PO is raised in. The factor is snapshotted onto the line so a
      // later edit to the item master never rewrites this BOM or a PO generated from it.
      ...(() => {
        const line = lines[idx];
        const qty = calcLinePurchaseQty(
          line,
          computeTotalQty(line),
          buildOrderQtyGrid(orderLineSummary),
          allSizes
        ) ?? 0;
        const factor = line.uomConversionFactor;
        const applies = conversionApplies(line.primaryUomId, line.secondaryUomId, factor);
        return {
          purchaseQty: qty,
          purchaseUom: applies ? line.primaryUom : line.uom,
          uomConversionFactor: applies ? Number(factor) : null,
          purchaseQtyPrimary: applies ? convertToPrimary(qty, factor) : qty,
        };
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
    if (!orderNoInput?.trim() || orderNoInput.trim() === 'SG/') {
      errors.push('Order number is required.');
      return { valid: false, errors };
    }
    if (!ORDER_NO_PATTERN.test(orderNoInput.trim())) {
      errors.push('Order number format is invalid (expected: SG/25-26/1001)');
      return { valid: false, errors };
    }
    if (!orderId) {
      errors.push('Order number has not been verified — click outside the field or press Enter to look it up');
      return { valid: false, errors };
    }
    if (lines.length === 0) {
      errors.push('At least one BOM line is required.');
      return { valid: false, errors };
    }

    // Build order qty grid once for matrix validation
    const orderQtyGrid = buildOrderQtyGrid(orderLineSummary);

    lines.forEach((l, idx) => {
      const n = idx + 1;
      const fabric = isFabricCategory(l);
      const cMode = l.consumptionMode || 'SIMPLE';
      const isMatrixMode = cMode === CONSUMPTION_MODE.SIZE_WISE || cMode === CONSUMPTION_MODE.VARIANT_PER_SIZE;

      // ── Basic fields (draft + submit) ──
      if (!l.categoryId) errors.push(`Line ${n}: Category is required.`);
      // Validate category is applicable for BOM (Fabric or Trims only)
      if (l.categoryId && !isBomApplicableCategory(l)) {
        errors.push(`Line ${n}: Only Fabric and Trims categories are applicable for BOM.`);
      }
      if (!l.subCategoryId) errors.push(`Line ${n}: Sub Category is required.`);
      if (!l.itemTypeId) errors.push(`Line ${n}: Item Type is required.`);
      if (!l.itemId) errors.push(`Line ${n}: Item is required.`);
      if (!l.uom) errors.push(`Line ${n}: UOM is required.`);
      if (!l.partsName || (Array.isArray(l.partsName) && l.partsName.length === 0)) errors.push(`Line ${n}: Parts Name is required.`);

      // ── Variant selection ──
      // Required for: SIMPLE and SIZE_WISE modes (both fabric & trims)
      // Not required for: VARIANT_PER_SIZE (variants mapped per size in matrix)
      if (cMode === CONSUMPTION_MODE.SIMPLE || cMode === CONSUMPTION_MODE.SIZE_WISE) {
        if (!l.variantId && (l.availableVariants || []).length > 1) {
          errors.push(`Line ${n}: Variant selection is required for ${cMode === CONSUMPTION_MODE.SIMPLE ? 'Simple' : 'Size-wise'} consumption mode.`);
        }
      }

      // ── Consumption ──
      if (isMatrixMode) {
        // Matrix must exist and have at least one non-zero consumption value
        if (!l.consumptionMatrix || Object.keys(l.consumptionMatrix).length === 0) {
          errors.push(`Line ${n}: Consumption matrix is required. Click the edit icon to set it.`);
        } else {
          // Check that at least one cell with order qty has consumption entered
          let hasAnyConsumption = false;
          Object.entries(l.consumptionMatrix).forEach(([color, sizes]) => {
            Object.entries(sizes || {}).forEach(([size, val]) => {
              if ((Number(val) || 0) > 0 && (orderQtyGrid[color]?.[size] || 0) > 0) {
                hasAnyConsumption = true;
              }
            });
          });
          if (!hasAnyConsumption) {
            errors.push(`Line ${n}: At least one consumption value is required in the matrix.`);
          }
        }

        // VARIANT_PER_SIZE: every size that has order qty must have a variant mapped
        if (cMode === CONSUMPTION_MODE.VARIANT_PER_SIZE) {
          if (!l.variantMapping || Object.keys(l.variantMapping).length === 0) {
            errors.push(`Line ${n}: Variant mapping is required. Map variants per size in the consumption matrix.`);
          } else {
            // Only check sizes that actually have order qty
            const sizesWithQty = allSizes.filter((s) => {
              return Object.keys(orderQtyGrid).some((color) => (orderQtyGrid[color]?.[s] || 0) > 0);
            });
            const unmapped = sizesWithQty.filter((s) => !l.variantMapping[s]);
            if (unmapped.length > 0) {
              errors.push(`Line ${n}: Variant mapping missing for sizes: ${unmapped.join(', ')}.`);
            }
          }
        }
      } else {
        // SIMPLE mode
        if (!l.consumptionPerGarment || Number(l.consumptionPerGarment) <= 0) {
          errors.push(`Line ${n}: Consumption is required.`);
        }
      }

      // ── Process ──
      if (!l.processes?.length) errors.push(`Line ${n}: At least one process is required.`);

      // ── Process Allowances (submit only) ──
      if (mode === 'submit') {
        if (!l.processAllowances?.length) {
          errors.push(`Line ${n}: Process allowances are required for submission.`);
        }
      }

      // ── CAD Marker — optional for both draft and submit ──

      // ── Total Qty check (submit only) ──
      if (mode === 'submit') {
        const totalQty = computeTotalQty(l);
        if (!totalQty || totalQty <= 0) {
          errors.push(`Line ${n}: Total quantity must be greater than zero.`);
        }
      }
    });

    return { valid: errors.length === 0, errors };
  };

  // Post-save CAD processor. Runs the three queued operations in this order:
  //   1. Deletes — any `_cadToDelete` fileIds (queued when user replaced or
  //      removed an existing line's CAD).
  //   2. Existing-line uploads — lines that already had an id at save time and
  //      now have a staged replacement file. Uploaded directly against line.id.
  //   3. New-line uploads — lines that were new at save time (no local id)
  //      matched positionally against `savedBom.lines`. The backend returns
  //      lines in payload order, so we filter both sides to "new-in-this-save"
  //      entries and pair by index. Positional match is required because
  //      duplicate item+variant pairs (same fabric, different colors) would be
  //      ambiguous under an itemId/variantId match.
  //
  // All operations run via Promise.allSettled so one failure doesn't block the
  // rest; failures are reported with a single summary warning.
  const uploadStagedCadFiles = async (savedBom, priorLineIds) => {
    const ops = [];

    // 1. Queued deletes — may exist on any line (existing or new), whenever
    //    the user replaced or removed a previously-persisted CAD marker.
    lines.forEach((l) => {
      if (l._cadToDelete) {
        ops.push(
          deleteFile(l._cadToDelete).catch((e) => console.warn('Failed to delete old CAD file:', e)),
        );
      }
    });

    // 2. Staged uploads for EXISTING lines (line.id is already known).
    lines.forEach((l) => {
      if (l.id && l._cadStagedFile) {
        ops.push(
          uploadFile(l._cadStagedFile, {
            module: 'BOM',
            entity: 'BOM_LINE',
            entityId: l.id,
            fileCategory: 'CAD_MARKER',
          }).catch((e) => {
            console.error('CAD upload failed for existing line:', e);
            throw new Error(`CAD upload failed for line ${l.itemCode || l.itemId}`);
          }),
        );
      }
    });

    // 3. Staged uploads for NEW lines (positional match against savedBom.lines).
    const stagedNewLines = lines.filter((l) => !l.id && !l.isPoGenerated && l._cadStagedFile);
    if (stagedNewLines.length > 0) {
      const newSavedLines = (savedBom?.lines || []).filter((sl) => sl.id && !priorLineIds.has(sl.id));
      if (newSavedLines.length !== stagedNewLines.length) {
        message.warning('CAD uploads for new lines skipped: saved BOM lines did not align with local state. Edit the BOM to retry.');
      } else {
        for (let i = 0; i < stagedNewLines.length; i += 1) {
          const localLine = stagedNewLines[i];
          const savedLine = newSavedLines[i];
          ops.push(
            uploadFile(localLine._cadStagedFile, {
              module: 'BOM',
              entity: 'BOM_LINE',
              entityId: savedLine.id,
              fileCategory: 'CAD_MARKER',
            }).catch((e) => {
              console.error('CAD upload failed for new line:', e);
              throw new Error(`CAD upload failed for line ${savedLine.itemCode || savedLine.itemId}`);
            }),
          );
        }
      }
    }

    if (ops.length === 0) return;
    const results = await Promise.allSettled(ops);
    const failures = results.filter((r) => r.status === 'rejected').length;
    if (failures > 0) {
      message.warning(`BOM saved, but ${failures} CAD file operation${failures > 1 ? 's' : ''} failed. Edit the BOM to retry.`);
    }
  };

  const handleSaveDraft = async () => {
    if (isEdit && !isDirty) {
      message.warning('No changes detected.');
      return;
    }
    const { valid, errors } = validateBom('draft');
    if (!valid) {
      errors.forEach((e) => message.warning(e));
      return;
    }

    setSavingDraft(true);
    try {
      const payload = buildPayload(BOM_STATUS.DRAFT);
      const priorLineIds = new Set(lines.filter((l) => l.id).map((l) => l.id));
      let saved;
      if (isEdit) {
        saved = await updateBom(id, payload);
        message.success('BOM saved as draft');
      } else {
        saved = await createBom(payload);
        message.success('BOM created as draft');
      }
      await uploadStagedCadFiles(saved, priorLineIds);
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
    if (isEdit && !isDirty && bomStatus !== BOM_STATUS.DRAFT) {
      message.warning('No changes detected.');
      return;
    }
    const { valid, errors } = validateBom('submit');
    if (!valid) {
      errors.forEach((e) => message.warning(e));
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload(BOM_STATUS.CREATED);
      const priorLineIds = new Set(lines.filter((l) => l.id).map((l) => l.id));
      let saved;
      if (isEdit) {
        saved = await updateBom(id, payload);
        message.success('BOM updated successfully');
      } else {
        saved = await createBom(payload);
        message.success('BOM created successfully');
      }
      await uploadStagedCadFiles(saved, priorLineIds);
      if (saved?.version != null) setEntityVersion(saved.version);
      setIsDirty(false);
      clearDirty();
      navigate('/bom/list');
    } catch {
      message.error(isEdit ? 'Failed to update BOM' : 'Failed to create BOM');
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
          ? <Tooltip title="PO placed — this line cannot be modified"><span style={{ color: 'var(--warning-color)', cursor: 'pointer' }}>🔒</span></Tooltip>
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
          const notApplicable = record.categoryId && !isBomApplicableCategory(record);
          return (
            <Tooltip title={notApplicable ? 'Only Fabric and Trims categories are applicable for BOM' : undefined}>
              <Select
                placeholder={notApplicable ? 'N/A' : 'Sub Category'}
                style={{ width: '100%' }}
                size="small"
                value={value || undefined}
                onChange={(v) => handleSubCategoryChange(record.key, v, record.categoryId)}
                options={opts.map((sc) => ({ value: sc.id, label: sc.name }))}
                showSearch={{ optionFilterProp: 'label' }}
                disabled={!record.categoryId || notApplicable}
                status={notApplicable ? 'error' : undefined}
              />
            </Tooltip>
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
      // 5. Item Code (read-only). Item is resolved from Category + Sub-Category + Item Type.
      //    Shows the selected variant's code for single-variant modes (SIMPLE/SIZE_WISE); for
      //    VARIANT_PER_SIZE the line spans many variants, so it falls back to the parent item code.
      {
        title: 'Item Code',
        dataIndex: 'itemCode',
        width: 150,
        align: 'center',
        render: (value, record) => {
          const isPerSize = (record.consumptionMode || 'SIMPLE') === CONSUMPTION_MODE.VARIANT_PER_SIZE;
          const display = isPerSize
            ? (record.itemCode || '-')
            : (record.variantCode || '-');
          // Surface the conversion at the point of item choice, before the qty columns
          const conversion = conversionApplies(record.primaryUomId, record.secondaryUomId, record.uomConversionFactor)
            ? formatConversionLabel(record.primaryUom, record.secondaryUom, record.uomConversionFactor)
            : '';
          return (
            <div style={{ lineHeight: 1.3 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{display || '-'}</Text>
              {conversion && (
                <div><Text type="secondary" style={{ fontSize: 10 }}>{conversion}</Text></div>
              )}
            </div>
          );
        },
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
          const fabric = isFabricCategory(record);
          const variants = record.availableVariants || [];

          // ── FABRIC & TRIMS: show consumption mode toggle + optional variant dropdown ──
          if (record.itemId) {
            const cMode = record.consumptionMode || 'SIMPLE';
            const showVariantDropdown = cMode !== CONSUMPTION_MODE.VARIANT_PER_SIZE;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Tooltip
                  title={
                    cMode === CONSUMPTION_MODE.SIMPLE
                      ? 'Single consumption value for all sizes. Select a variant to specify the SKU.'
                      : cMode === CONSUMPTION_MODE.SIZE_WISE
                      ? `Consumption varies by garment size (e.g., more ${fabric ? 'fabric' : 'thread'} for larger sizes). Same variant, different quantities per size.`
                      : `Different ${fabric ? 'fabric' : 'trim'} variant for each garment size. Map variants per size in the matrix.`
                  }
                  placement="bottom"
                >
                  <Segmented
                    size="small"
                    value={cMode}
                    options={CONSUMPTION_MODE_OPTIONS.map((opt) =>
                      opt.value === CONSUMPTION_MODE.VARIANT_PER_SIZE && variants.length <= 1
                        ? { ...opt, disabled: true }
                        : opt
                    )}
                    className="bom-consumption-mode-toggle"
                    block={false}
                    onChange={(v) => {
                      const updates = { consumptionMode: v };
                      if (v === CONSUMPTION_MODE.VARIANT_PER_SIZE) {
                        // Line now spans many size-variants; no single variant identity.
                        updates.variantId = null;
                        updates.variantCode = '';
                        updates.variantName = '';
                        updates.variants = {};
                        updates.consumptionPerGarment = null;
                        updates.consumptionMatrix = updates.consumptionMatrix || null;
                        updates.variantMapping = updates.variantMapping || {};
                        updates.colorInvalid = false;
                        updates.overrideBaseQty = null;
                      } else if (v === CONSUMPTION_MODE.SIZE_WISE) {
                        updates.consumptionPerGarment = null;
                        updates.consumptionMatrix = record.consumptionMatrix || null;
                      } else {
                        updates.consumptionMatrix = null;
                        updates.variantMapping = null;
                      }
                      // Restore single variant when switching back from VARIANT_PER_SIZE
                      if (v !== CONSUMPTION_MODE.VARIANT_PER_SIZE && !record.variantId && variants.length === 1) {
                        updates.variantId = variants[0].id;
                        updates.variantCode = variants[0].variantCode || '';
                        updates.variantName = variants[0].variantName || '';
                        updates.variants = sortAttrs(variants[0].attributes || {});
                      }
                      updateLineMulti(record.key, updates);
                    }}
                  />
                </Tooltip>
                {showVariantDropdown && variants.length > 1 && !record.variantId && (
                  <Select
                    placeholder="Select variant"
                    style={{ width: '100%' }}
                    size="small"
                    value={record.variantId || undefined}
                    onChange={(v) => handleVariantSelect(record.key, v)}
                    showSearch={{ optionFilterProp: 'label' }}
                    open={variantEditLineKey === record.key || undefined}
                    ref={(node) => {
                      if (variantEditLineKey === record.key && node) {
                        setTimeout(() => { node.focus(); }, 50);
                      }
                    }}
                    onDropdownVisibleChange={(o) => { if (!o) setVariantEditLineKey(null); }}
                    options={variants.map((v) => {
                      // Prefer the variant's own identity; fall back to its attributes for
                      // legacy variants saved before names existed.
                      if (v.variantName) {
                        return { value: v.id, label: v.variantCode ? `${v.variantName} (${v.variantCode})` : v.variantName };
                      }
                      const entries = Object.entries(v.attributes || {});
                      entries.sort(([a], [b]) => a.toLowerCase() === 'color' ? -1 : b.toLowerCase() === 'color' ? 1 : 0);
                      return { value: v.id, label: entries.map(([k, val]) => `${k}: ${val}`).join(' | ') };
                    })}
                  />
                )}
                {showVariantDropdown && record.variantId && (() => {
                  const tags = variantsToTags(record.variants);
                  return tags.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        {variants.length > 1 && (
                          <Tooltip title="Change variant">
                            <EditOutlined
                              style={{ fontSize: 11, color: 'var(--primary-color)', cursor: 'pointer' }}
                              onClick={() => { setVariantEditLineKey(record.key); handleVariantSelect(record.key, null); }}
                            />
                          </Tooltip>
                        )}
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {tags.map((t) => <Tag key={t} className="bom-variant-tag" style={{ margin: 0, fontSize: 10 }}>{t}</Tag>)}
                        </div>
                      </div>
                      {isFabricColorMissing(record) && (
                        <Text type="warning" style={{ fontSize: 10, color: 'var(--warning-color)', lineHeight: 1.3 }}>
                          <WarningOutlined style={{ marginRight: 3 }} />
                          Color not found in order
                        </Text>
                      )}
                    </div>
                  ) : null;
                })()}
              </div>
            );
          }

          // ── No item selected yet: show dash ──
          const tags = variantsToTags(record.variants);
          if (tags.length === 0) return <div style={{ textAlign: 'center' }}><Text type="secondary">—</Text></div>;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {variants.length > 1 && (
                  <Tooltip title="Change variant">
                    <EditOutlined
                      style={{ fontSize: 13, color: 'var(--primary-color)', cursor: 'pointer', flexShrink: 0 }}
                      onClick={() => {
                        setVariantEditLineKey(record.key);
                        handleVariantSelect(record.key, null);
                      }}
                    />
                  </Tooltip>
                )}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minWidth: 0, overflow: 'hidden' }}>
                  {tags.map((t) => (
                    <Tooltip key={t} title={t}>
                      <Tag className="bom-variant-tag" style={{ margin: 0, fontSize: 11, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t}</Tag>
                    </Tooltip>
                  ))}
                </div>
              </div>
              {record.colorInvalid && (
                <Text type="warning" style={{ fontSize: 10, color: 'var(--warning-color)', lineHeight: 1.3 }}>
                  <WarningOutlined style={{ marginRight: 3 }} />
                  Color not found in order
                </Text>
              )}
            </div>
          );
        },
      },
      // 9. Consumption/Garment
      {
        title: 'Consumption',
        dataIndex: 'consumptionPerGarment',
        width: 190,
        align: 'center',
        render: (value, record) => {
          const fabric = isFabricCategory(record);
          const cMode = record.consumptionMode || 'SIMPLE';
          const isMatrix = cMode === CONSUMPTION_MODE.SIZE_WISE || cMode === CONSUMPTION_MODE.VARIANT_PER_SIZE;
          const consumptionUom = record.itemId ? (record.secondaryUom || record.primaryUom || '').toUpperCase() : '';

          if (isMatrix) {
            // Matrix mode: show total req (read-only) + UOM + edit icon
            const total = computeTotalQty(record);
            return (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Text style={{ fontSize: 12 }}>
                  {total ? total.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                  {consumptionUom ? <Text type="secondary" style={{ fontSize: 10, marginLeft: 3 }}>{consumptionUom}</Text> : null}
                </Text>
                <Tooltip title="Edit consumption matrix">
                  <EditOutlined
                    style={{ fontSize: 13, color: 'var(--primary-color)', cursor: 'pointer' }}
                    onClick={() => setMatrixDialogLineKey(record.key)}
                  />
                </Tooltip>
              </div>
            );
          }

          // SIMPLE mode: InputNumber + AI button (fabric) + base qty below
          const showOverrideInput = fabric && record.variantId && isFabricColorMissing(record);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: showOverrideInput ? 4 : 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <InputNumber
                  min={0}
                  step={0.001}
                  precision={4}
                  size="small"
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder={!record.itemId ? 'Select item first' : !record.variantId && (record.availableVariants || []).length > 1 ? 'Select variant first' : '0.0000'}
                  value={value}
                  onChange={(v) => updateLine(record.key, 'consumptionPerGarment', v)}
                  controls={false}
                  disabled={!record.itemId || (!record.variantId && (record.availableVariants || []).length > 1)}
                  addonAfter={record.itemId ? (record.secondaryUom || record.primaryUom || '').toUpperCase() || undefined : undefined}
                  {...numericInputProps}
                />
                {fabric && (
                  <Tooltip title="Calculate from Measurement Chart (AI)">
                    <Button
                      icon={<ThunderboltOutlined />}
                      onClick={() => openConsumptionModal(record.key, record)}
                      size="small"
                      type="text"
                      style={{ color: 'var(--warning-color)', flexShrink: 0 }}
                    />
                  </Tooltip>
                )}
              </div>
              {fabric && record.variantId && (() => {
                const color = getVariantAttr(record, 'color');
                const { qty } = getColorQty(record);

                // Color not in order — show dropdown with grouped order color quantities
                if (isFabricColorMissing(record)) {
                  // Build grouped color options from all order lines
                  const colorQtyMap = {};
                  orderLineSummary.forEach((ol) => {
                    ol.colors.forEach((c) => {
                      if (c.name && c.qty > 0) {
                        const key = c.name.trim();
                        colorQtyMap[key] = (colorQtyMap[key] || 0) + c.qty;
                      }
                    });
                  });
                  const colorOptions = Object.entries(colorQtyMap).map(([name, total]) => ({
                    value: total,
                    label: `${name} — ${total.toLocaleString()}`,
                  }));
                  const currentOverride = record.overrideBaseQty ?? (record._savedBaseQty ? Number(record._savedBaseQty) : null);
                  // Find matching option for current value (handle duplicate qty values)
                  const hasMatch = currentOverride != null && colorOptions.some((o) => o.value === currentOverride);

                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Select
                        size="small"
                        style={{ flex: 1, minWidth: 0 }}
                        placeholder="Pick base qty"
                        value={hasMatch ? currentOverride : undefined}
                        onChange={(v) => updateLine(record.key, 'overrideBaseQty', v || null)}
                        options={colorOptions}
                        status="warning"
                        popupMatchSelectWidth={false}
                      />
                      <Tooltip title="Color not in order — pick base quantity from order">
                        <WarningOutlined style={{ fontSize: 13, color: 'var(--warning-color)', flexShrink: 0 }} />
                      </Tooltip>
                    </div>
                  );
                }

                if (!qty) return null;
                return (
                  <Text style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3, display: 'block', textAlign: 'center' }}>
                    Base Qty ({color || 'All'}) — {qty.toLocaleString()}
                  </Text>
                );
              })()}
            </div>
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
              placeholder={(() => {
                const cMode = record.consumptionMode || 'SIMPLE';
                const isMatrixMode = cMode === CONSUMPTION_MODE.SIZE_WISE || cMode === CONSUMPTION_MODE.VARIANT_PER_SIZE;
                if (isMatrixMode) return record.consumptionMatrix ? 'Processes' : 'Set matrix first';
                return !record.consumptionPerGarment ? 'Enter consumption first' : 'Processes';
              })()}
              style={{ flex: 1 }}
              size="small"
              value={value || []}
              onChange={(v) => handleProcessChange(record.key, v)}
              options={getProcessOptionsForLine(record)}
              showSearch={{ optionFilterProp: 'label' }}
              disabled={(() => {
                const cMode = record.consumptionMode || 'SIMPLE';
                const isMatrixMode = cMode === CONSUMPTION_MODE.SIZE_WISE || cMode === CONSUMPTION_MODE.VARIANT_PER_SIZE;
                if (isMatrixMode) return !record.consumptionMatrix;
                return !record.consumptionPerGarment;
              })()}
            />
            {(record.processAllowances?.length > 0) && (
              <Tooltip title="Edit allowances">
                <EditOutlined
                  style={{ fontSize: 13, color: 'var(--primary-color)', cursor: 'pointer', flexShrink: 0 }}
                  onClick={() => editAllowanceDialog(record.key)}
                />
              </Tooltip>
            )}
          </div>
        ),
      },
      // 13. Calc Basis — REMOVED (moved into consumption matrix dialog for trims, inline for fabric)
      // 14. Total Qty
      {
        title: 'Total Qty',
        width: 100,
        align: 'center',
        render: (_, record) => {
          const total = computeTotalQty(record);
          // Total Qty is a multiple of consumption, so it carries the CONSUMPTION unit
          const uom = (record.secondaryUom || record.primaryUom || record.uom || '').toUpperCase();
          return total != null
            ? <Text style={{ fontSize: 12 }}>{total.toLocaleString(undefined, { maximumFractionDigits: 2 })} <Text type="secondary" style={{ fontSize: 10 }}>{uom}</Text></Text>
            : <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
        },
      },
      // 15. Purchase Qty (Total Qty + allowances, converted into the item's purchase UOM)
      {
        title: 'Purchase Qty',
        width: 130,
        align: 'center',
        render: (_, record) => {
          const totalQty = computeTotalQty(record);
          if (!totalQty) return <div style={{ textAlign: 'center' }}><Text type="secondary">—</Text></div>;
          if (!(record.processAllowances || []).length) {
            return <div style={{ textAlign: 'center' }}><Text type="secondary">—</Text></div>;
          }

          const purchaseQty = calcLinePurchaseQty(
            record,
            totalQty,
            buildOrderQtyGrid(orderLineSummary),
            allSizes
          );
          if (purchaseQty == null) return <div style={{ textAlign: 'center' }}><Text type="secondary">—</Text></div>;

          const consumptionUom = (record.secondaryUom || record.primaryUom || record.uom || '').toUpperCase();
          const factor = record.uomConversionFactor;
          const applies = conversionApplies(record.primaryUomId, record.secondaryUomId, factor);

          // No conversion (trim with no secondary UOM, or both units the same) — render
          // exactly as before so the majority of lines stay visually quiet.
          if (!applies) {
            return (
              <Text style={{ fontSize: 12 }}>
                {purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                <Text type="secondary" style={{ fontSize: 10 }}>{consumptionUom}</Text>
              </Text>
            );
          }

          const converted = convertToPrimary(purchaseQty, factor);
          const purchaseUom = (record.primaryUom || '').toUpperCase();
          return (
            <Tooltip title={formatConversionLabel(record.primaryUom, record.secondaryUom, factor)}>
              <div style={{ lineHeight: 1.3 }}>
                <Text style={{ fontSize: 12 }}>
                  {converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                  <Text type="secondary" style={{ fontSize: 10 }}>{purchaseUom}</Text>
                </Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 10 }}>
                    {purchaseQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} {consumptionUom} ÷ {Number(factor).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </Text>
                </div>
              </div>
            </Tooltip>
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
          const isDisabled = !record.itemId || (!record.variantId && (record.availableVariants || []).length > 1);

          // Show file name tooltip if CAD is uploaded or staged
          if (record.cadPreviewUrl || record._cadFileId || record._cadStagedFile) {
            const isStaged = !record._cadFileId && record._cadStagedFile;
            return (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Tooltip title={record._cadFileName || (isStaged ? 'CAD staged' : 'CAD uploaded')}>
                  <CheckCircleOutlined style={{ fontSize: 20, color: isStaged ? 'var(--primary-color, #6366f1)' : '#10b981', minWidth: 20 }} />
                </Tooltip>
                <Tooltip title={isStaged ? 'Remove staged CAD' : 'Remove CAD'}>
                  <DeleteOutlined
                    style={{ fontSize: 12, color: 'var(--error-color, #ff4d4f)', cursor: 'pointer' }}
                    onClick={() => {
                      // Queue the persisted file (if any) for deletion on save.
                      // If a new file was staged but not yet saved, just drop
                      // it — no server-side implications. Preserves any
                      // pre-existing `_cadToDelete` that may have been queued
                      // during a replace-then-remove sequence.
                      updateLineMulti(record.key, {
                        cadPreviewUrl: null,
                        _cadFileId: null,
                        _cadFileName: null,
                        _cadStagedFile: null,
                        _cadToDelete: record._cadFileId || record._cadToDelete || null,
                      });
                    }}
                  />
                </Tooltip>
              </div>
            );
          }

          return (
            <Upload
              maxCount={1}
              showUploadList={false}
              disabled={isDisabled}
              beforeUpload={(file) => {
                const isImage = file.type?.startsWith('image/');
                const previewUrl = isImage ? URL.createObjectURL(file) : null;

                // Always stage — both new and existing lines. If this line
                // already had a persisted CAD, queue it for deletion so a
                // failed upload on save doesn't orphan the slot. New-line
                // `toDelete` carry-over (from a previous pick-then-pick on the
                // same unsaved line) is preserved.
                updateLineMulti(record.key, {
                  cadPreviewUrl: previewUrl,
                  _cadFileName: file.name,
                  _cadStagedFile: file,
                  _cadFileId: null,
                  _cadToDelete: record._cadFileId || record._cadToDelete || null,
                });
                message.info('CAD marker staged. It will be uploaded when you save the BOM.');
                return false;
              }}
            >
              <Button
                size="small"
                type="text"
                icon={<UploadOutlined />}
                disabled={isDisabled}
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
            <Tooltip title="PO placed — cannot delete"><ActionButton action="delete" size="small" disabled /></Tooltip>
        ) : (
            <DeleteConfirm
              title="Remove line"
              recordLabel={record.itemName || 'this line'}
              onConfirm={() => removeLine(record.key)}
            >
              <ActionButton action="delete" size="small" />
            </DeleteConfirm>
        ),
      },
    ];

  // ==================== ROW CLASS ====================

  const rowClassName = (record) => {
    return record.isPoGenerated ? 'bom-line-po-locked' : '';
  };

  // ==================== RENDER ====================

  if (loading && isEdit) {
    return (
      <div className="animate-fade-in-up">
        <PageHeader title="" backPath="/bom/list" style={{ position: 'sticky', top: 64, zIndex: 10 }}>
          <Space>
            <Skeleton.Button active style={{ width: 100 }} />
            <Skeleton.Button active style={{ width: 120 }} />
          </Space>
        </PageHeader>
        <Card style={{ marginBottom: 24 }}>
          <Skeleton.Input active style={{ width: 160, marginBottom: 16 }} />
          <Row gutter={[24, 16]}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Col xs={24} md={8} lg={4} key={i}>
                <Skeleton.Input active size="small" style={{ width: 60, marginBottom: 8 }} block={false} />
                <Skeleton.Input active block />
              </Col>
            ))}
          </Row>
        </Card>
        <Card>
          <Skeleton active paragraph={{ rows: 8 }} />
        </Card>
      </div>
    );
  }

  const canSave = hasPermission('bom', isEdit ? 'update' : 'add');

  return (
    <div className="animate-fade-in-up">
      {/* ── Header (sticky) ─────────────────────────────────────── */}
      <PageHeader
        title={isEdit ? 'Edit BOM' : 'Create BOM'}
        backPath="/bom/list"
        status={orderNo ? <Tag color="blue" style={{ fontSize: 13 }}>{orderNo}</Tag> : undefined}
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        {canSave && (
          <>
            {!(isEdit && bomStatus === BOM_STATUS.CREATED) && (
              <ActionButton
                action="save"
                variant="draft"
                text="Save Draft"
                loading={savingDraft}
                onClick={handleSaveDraft}
              />
            )}
            <ActionButton
              action="save"
              text={isEdit ? 'Update BOM' : 'Create BOM'}
              loading={submitting}
              onClick={handleSubmit}
            />
          </>
        )}
      </PageHeader>

      {/* ── Section A: General Info ─────────────────────────────── */}
      <Card style={{ marginBottom: 24 }} loading={loading && !bomFromState}>
        <FormSection title="General Information">
        </FormSection>
        <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
        <Row gutter={[24, 16]}>
          <Col xs={24} md={8} lg={4}>
            <div style={{ marginBottom: 4 }}>
              {!isEdit && <Text strong style={{ color: 'var(--error-color, #ff4d4f)' }}>* </Text>}
              <Text strong>Order No</Text>
            </div>
            <Input
              placeholder="SG/25-26/1001"
              inputMode="numeric"
              value={orderNoInput || (isEdit ? '' : 'SG/')}
              onChange={(e) => !isEdit && setOrderNoInput(formatOrderNo(e.target.value, orderNoInput))}
              onKeyDown={!isEdit ? (e) => formattedIdKeyDown(e, 'SG/') : undefined}
              onBlur={!isEdit ? handleOrderNoBlur : undefined}
              onPressEnter={!isEdit ? (e) => { e.target.blur(); } : undefined}
              suffix={
                orderLoading
                  ? <LoadingOutlined spin />
                  : !isEdit && (
                    <RecentSuggestionsButton
                      items={recentOrderItems}
                      onSelect={(val) => { setOrderNoInput(val); handleOrderNoBlur(val); }}
                    />
                  )
              }
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
                          style={{ borderRadius: 8, background: 'var(--bg-tertiary, #fafafa)', borderLeft: '3px solid var(--primary-color)' }}
                          styles={{ body: { padding: '10px 14px' } }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <Text strong style={{ fontSize: 13 }}>{line.buyerPoNo}</Text>
                            <Text strong style={{ fontSize: 15, color: 'var(--primary-color)' }}>{line.lineQty.toLocaleString()}</Text>
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
        </div>
        {/* Style Image — sidebar */}
        {selectedStyleId && (
          <div style={{
            flexShrink: 0,
            width: 130,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 4,
          }}>
            <Text type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>Style Image</Text>
            {styleImageLoading ? (
              <Skeleton.Image active style={{ width: 110, height: 110 }} />
            ) : styleImageUrl ? (
              <Image
                src={styleImageUrl}
                alt="Style"
                width={110}
                height={110}
                style={{
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid var(--border-color, #e5e7eb)',
                }}
              />
            ) : (
              <div style={{
                width: 110,
                height: 110,
                borderRadius: 8,
                border: '1px dashed var(--border-color, #d9d9d9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                background: 'var(--bg-tertiary)',
              }}>
                <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3 }}>No style<br />image</Text>
              </div>
            )}
          </div>
        )}
        </div>
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
          <SectionAddButton
            text="Add Line"
            onClick={addLine}
            disabled={!canSave || !orderId}
            block={false}
          />
        }
      >
        <div style={!orderId ? { opacity: 0.4, pointerEvents: 'none' } : undefined}>
        <ConfigProvider
          theme={{
            components: {
              Table: {
                rowHoverBg: isDarkMode ? '#2d3a4d' : '#f0f0ff',
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
            border-right: 2px solid var(--primary-color);
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
        <FormSection title="Summary">
        </FormSection>
        <Row gutter={[16, 16]}>
          {[
            { title: 'Total Lines', value: summary.total, color: 'var(--primary-color)', span: { xs: 12, sm: 8, md: 4 } },
            { title: 'Fabric', value: summary.fabricLines, color: '#6366f1', span: { xs: 12, sm: 8, md: 4 } },
            { title: 'Trims', value: summary.trimLines, color: '#10b981', span: { xs: 12, sm: 8, md: 4 } },
            {
              title: 'Completed',
              value: summary.completedLines,
              color: summary.completedLines === summary.total && summary.total > 0 ? '#10b981' : 'var(--warning-color)',
              extra: `/ ${summary.total}`,
              icon: summary.completedLines === summary.total && summary.total > 0 ? 'check' : 'warn',
              span: { xs: 12, sm: 8, md: 5 },
            },
            { title: 'Total Purchase Qty', value: summary.totalPurchaseQty, color: 'var(--primary-color)', precision: 2, span: { xs: 24, sm: 16, md: 7 } },
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
        consumptionMode={(() => {
          const line = lines.find((l) => l.key === allowanceLineKey);
          return line?.consumptionMode;
        })()}
        sizes={allSizes}
        variantMapping={(() => {
          const line = lines.find((l) => l.key === allowanceLineKey);
          return line?.variantMapping;
        })()}
        availableVariants={(() => {
          const line = lines.find((l) => l.key === allowanceLineKey);
          return line?.availableVariants || [];
        })()}
        consumptionMatrix={(() => {
          const line = lines.find((l) => l.key === allowanceLineKey);
          return line?.consumptionMatrix;
        })()}
        orderLineSummary={orderLineSummary}
      />

      {/* Consumption Matrix Dialog */}
      <ConsumptionMatrixDialog
        key={matrixDialogLineKey || 'closed'}
        open={matrixDialogLineKey != null}
        mode={(() => {
          const line = lines.find((l) => l.key === matrixDialogLineKey);
          return line?.consumptionMode || CONSUMPTION_MODE.SIZE_WISE;
        })()}
        itemName={(() => {
          const line = lines.find((l) => l.key === matrixDialogLineKey);
          return line?.itemName || '';
        })()}
        itemCode={(() => {
          const line = lines.find((l) => l.key === matrixDialogLineKey);
          return line?.itemCode || '';
        })()}
        uom={(() => {
          const line = lines.find((l) => l.key === matrixDialogLineKey);
          return line?.uom || '';
        })()}
        orderLineSummary={orderLineSummary}
        consumptionMatrix={(() => {
          const line = lines.find((l) => l.key === matrixDialogLineKey);
          return line?.consumptionMatrix;
        })()}
        variantMapping={(() => {
          const line = lines.find((l) => l.key === matrixDialogLineKey);
          return line?.variantMapping;
        })()}
        availableVariants={(() => {
          const line = lines.find((l) => l.key === matrixDialogLineKey);
          return line?.availableVariants || [];
        })()}
        qtyCalcBasis={(() => {
          const line = lines.find((l) => l.key === matrixDialogLineKey);
          return line?.qtyCalcBasis || 'TOTAL';
        })()}
        onApply={(updates) => {
          if (matrixDialogLineKey) {
            updateLineMulti(matrixDialogLineKey, updates);
          }
          setMatrixDialogLineKey(null);
        }}
        onCancel={() => setMatrixDialogLineKey(null)}
      />

      {/* Buyer PO Picker — shown when Buyer PO basis + color in multiple lines */}
      <Modal
        title="Select Buyer PO"
        open={buyerPoPickerOpen}
        onCancel={() => setBuyerPoPickerOpen(false)}
        afterClose={() => setPendingProcessData(null)}
        footer={null}
        width={400}
        centered
        destroyOnClose
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
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
              style={{ cursor: 'pointer', borderLeft: '3px solid var(--primary-color)' }}
              styles={{ body: { padding: '10px 14px' } }}
              onClick={() => handleBuyerPoPick(opt.buyerPoNo)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text strong>{opt.buyerPoNo}</Text>
                <Text strong style={{ color: 'var(--primary-color)', fontSize: 16 }}>{opt.qty.toLocaleString()} pcs</Text>
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
        centered
        destroyOnClose
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
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
              const colorMatch = varColor && cr.name && colorMatchesPartial(varColor, cr.name);
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
                  if (varColor && cr.name && colorMatchesPartial(varColor, cr.name)) total += cr.qty;
                } else if (attr === 'size') {
                  if (varSize && cr.quantities) {
                    const sk = Object.keys(cr.quantities).find((s) => s.trim().toLowerCase() === varSize.toLowerCase());
                    if (sk) total += cr.quantities[sk];
                  }
                } else if (attr === 'color+size') {
                  if (varColor && varSize && cr.name && colorMatchesPartial(varColor, cr.name) && cr.quantities) {
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
            const hasColorMatch = varColor && ol.colors.some((cr) => cr.name && colorMatchesPartial(varColor, cr.name));
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
                {varColor && <Tag style={{ fontSize: 11, margin: 0, background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)', color: 'var(--primary-color)', border: '1px solid color-mix(in srgb, var(--primary-color) 25%, transparent)' }}>Color: {varColor}</Tag>}
                {varSize && <Tag style={{ fontSize: 11, margin: 0, background: 'color-mix(in srgb, var(--btn-duplicate-color) 10%, transparent)', color: 'var(--btn-duplicate-color)', border: '1px solid color-mix(in srgb, var(--btn-duplicate-color) 25%, transparent)' }}>Size: {varSize}</Tag>}
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
                              const isColorMatch = varColor && cr.name && colorMatchesPartial(varColor, cr.name);
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
                                    {isColorMatch && <Tag style={{ fontSize: 9, margin: '0 0 0 4px', lineHeight: '14px', padding: '0 4px', background: 'var(--oq-color-row-strong)', color: 'var(--primary-color)', border: '1px solid var(--oq-total-cell)' }}>color</Tag>}
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
                            borderLeft: isSelected ? '3px solid var(--primary-color)' : '3px solid transparent',
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
                              {isSelected && <span style={{ color: 'var(--primary-color)', fontSize: 14, fontWeight: 700 }}>&#10003;</span>}
                              <Text strong={isSelected} style={{ fontSize: 12, color: isSelected ? 'var(--primary-color)' : noMatch ? 'var(--text-muted)' : undefined }}>{opt.label}</Text>
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

      {/* ── AI Consumption Calculator Modal ──────────────────────── */}
      <ConsumptionCalcModal
        open={consumptionModalOpen}
        onClose={() => setConsumptionModalOpen(false)}
        onApply={handleConsumptionApply}
        fabricRow={consumptionFabricRow}
      />

      {/* ── Auto-generated row styling ─────────────────────────── */}
      <style>{`
      `}</style>
    </div>
  );
};

export default BOMForm;
