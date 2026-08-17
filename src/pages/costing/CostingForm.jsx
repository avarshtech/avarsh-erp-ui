import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  App,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  Card,
  Row,
  Col,
  Space,
  Table,
  Typography,
  Upload,
  Collapse,
  Tooltip,
  Tag,
  Divider,
  Checkbox,
  Statistic,
  Skeleton,
  Modal,
  Image,
  Segmented,
  Alert,
  Progress,
  Spin,
} from 'antd';
import { numericInputProps } from '../../utils/inputHelpers';
import {
  PlusOutlined,
  CalculatorOutlined,
  InboxOutlined,
  InfoCircleOutlined,
  FileTextOutlined,
  BarChartOutlined,
  CloudUploadOutlined,
  WhatsAppOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { ActionButton, SectionAddButton } from '../../components/buttons';
import PageHeader from '../../components/PageHeader';
import { useNavigate, useParams } from 'react-router-dom';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';
import dayjs from 'dayjs';
import {
  getCostSheetById,
  createCostSheet,
  updateCostSheet,
  getPastPOSuggestions,
  getTodaysRate,
  uploadAttachmentsBatch,
  getAttachments,
  downloadAttachment,
  deleteAttachment,
} from '../../services/costing/costingService';
import {
  COSTING_STATUS,
  FABRIC_CLASSIFICATIONS,
  CURRENCIES,
  COSTING_TYPES,
  PRICING_UNITS,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE_MB,
  ATTACHMENT_CATEGORIES,
  SEASON_CODES,
  SEASON_YEARS,
  calcFabricNetCost,
  calcTrimPrice,
  calcTotalMakingPrice,
  calcTotalOverheadCharges,
  calcFinalPrice,
  calcFinalPriceUsd,
  calcAutoProfit,
  formatCurrency,
} from '../../utils/costingConstants';
import {
  conversionApplies,
  convertGramsTo,
  formatConversionLabel,
  normaliseUomSymbol,
} from '../../utils/uomConversions';
import { getCurrencySymbol } from '../../utils/orderConstants';
import { getBuyers } from '../../services/master/buyerService';
import { getStylesByBuyerId, saveStyle } from '../../services/master/styleService';
import { uploadFile, deleteFile } from '../../services/core/fileService';
import { getFilesByEntity, downloadFileAsBlob } from '../../services/core/fileService';
import { searchVariants } from '../../services/master/variantService';
import { getAllCategories } from '../../services/master/masterDataService';
import { getActiveProcesses, createProcess } from '../../services/master/processService';
import { getActiveOverheads, createOverhead } from '../../services/master/overheadService';
import { getSuppliers } from '../../services/master/supplierService';
import { hasPermission } from '../../utils/permissions';
import { useTheme } from '../../context/ThemeContext';
import { generateCostingPdf } from '../../utils/costingPdfGenerator';
import KnitsConsumptionModal from './KnitsConsumptionModal';
import FileUpload from '../../components/FileUpload';
import TechpackImportModal from './TechpackImportModal';
import ConsumptionCalcModal from './ConsumptionCalcModal';
import WovenConsumptionModal from './WovenConsumptionModal';
import BomImportModal from './BomImportModal';
import CostingPdfPreviewModal from './CostingPdfPreviewModal';
import CostingTemplateModal from './CostingTemplateModal';
import BuyerPriceTrendModal from './BuyerPriceTrendModal';

const { Text } = Typography;
const { Dragger } = Upload;

// Costing fabric/trim rows are picked from item variants. The server returns at most 50
// per call, which comfortably covers a category's active variants for a dropdown.
const VARIANT_PICKER_LIMIT = 50;

const fetchVariantsForCategory = async (categoryName, q = '') => {
  if (!categoryName) return [];
  try {
    const res = await searchVariants({ category: categoryName, q, limit: VARIANT_PICKER_LIMIT });
    return res?.data || res || [];
  } catch (error) {
    console.error(`Failed to load variants for category "${categoryName}":`, error);
    return [];
  }
};

// Merge freshly searched variants into an existing list, keyed by id so a variant
// already present is refreshed rather than duplicated.
const mergeVariantsById = (prev, incoming) => {
  const byId = new Map((prev || []).map((v) => [v.id, v]));
  (incoming || []).forEach((v) => byId.set(v.id, v));
  return [...byId.values()];
};

// Techpack extraction matches at item level; resolve that to a concrete variant.
const firstVariantOfItem = (variants, itemId) =>
  itemId ? (variants || []).find((v) => v.itemId === itemId) || null : null;

// Label with the variant name; the code is the searchable secondary identifier.
const toVariantOptions = (variants) =>
  (variants || []).map((v) => ({
    value: v.id,
    label: v.variantName || v.variantCode,
    variantCode: v.variantCode,
  }));

/**
 * The UOM fields a costing row inherits from its variant.
 *
 * Quantities are captured in the SECONDARY (consumption) UOM while rates are quoted per
 * PRIMARY (purchase) UOM, so a row must carry both plus the factor bridging them. The
 * "does a conversion actually apply?" question is answered once, here — the factor is
 * stored only when it genuinely applies, leaving every downstream formula free to treat
 * null as "pass the quantity through".
 *
 * Note `uomId` takes the SECONDARY id: it is the unit `consumption` is expressed in, and
 * persisting the primary id there is what made saved sheets read "0.0590 KILOGRAMS" for a
 * row the form displayed as GMS.
 */
const variantUomFields = (variant) => {
  const factorApplies = conversionApplies(
    variant?.uomId,
    variant?.secondaryUomId,
    variant?.uomConversionFactor,
  );
  return {
    uom: variant?.secondaryUomSymbol || variant?.uomSymbol || '',
    uomId: variant?.secondaryUomId ?? variant?.uomId ?? null,
    primaryUom: variant?.uomSymbol || '',
    primaryUomId: variant?.uomId ?? null,
    secondaryUomId: variant?.secondaryUomId ?? null,
    uomConversionFactor: factorApplies ? Number(variant.uomConversionFactor) : null,
  };
};

const CostingForm = () => {
  const { message } = App.useApp();
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { isDarkMode } = useTheme();
  const isEdit = Boolean(id);


  // Watch Section A fields for display
  const watchedSeasonCode = Form.useWatch('seasonCode', form);
  const watchedSeasonYear = Form.useWatch('seasonYear', form);

  // Watch Section A sizes to use as options in other sections
  const formSizes = Form.useWatch('sizes', form) || [];
  const sizeOptions = useMemo(
    () => formSizes.map((s) => ({ label: s, value: s })),
    [formSizes],
  );

  // Unsaved changes guard
  const [isDirty, setIsDirty] = useState(false);
  const { clearDirty } = useUnsavedChanges(isDirty);

  // State
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [entityVersion, setEntityVersion] = useState(null);
  const [loadedStatus, setLoadedStatus] = useState(null);
  const [costingId, setCostingId] = useState('');
  const [savedDate, setSavedDate] = useState(null);
  const [currency, setCurrency] = useState('INR');
  const [quoteCurrency, setQuoteCurrency] = useState('USD');
  const [actualRate, setActualRate] = useState(83.80);
  const [todaysRate, setTodaysRate] = useState(83.80);
  const [fileList, setFileList] = useState({ TECHPACK: [], MEASUREMENT_CHART: [], OTHER: [] });
  const [usdToInrRate, setUsdToInrRate] = useState(83.80);
  const [styleId, setStyleId] = useState(null);
  const [costingType, setCostingType] = useState('FOB');
  const [pricingUnit, setPricingUnit] = useState('PIECE');
  const [fabricNotes, setFabricNotes] = useState('');
  const [trimsNotes, setTrimsNotes] = useState('');
  const [manufacturingNotes, setManufacturingNotes] = useState('');
  const [overheadNotes, setOverheadNotes] = useState('');

  // Style image (view-only)
  const [styleImageUrl, setStyleImageUrl] = useState(null);
  const [styleImageLoading, setStyleImageLoading] = useState(false);
  const imageLoadIdRef = useRef(0);

  // Garment image (editable, stored against this cost sheet) — CR C-3
  const [garmentImageFile, setGarmentImageFile] = useState(null);        // staged File (new sheets)
  const [garmentImageUrl, setGarmentImageUrl] = useState(null);          // blob preview
  const [garmentImageExisting, setGarmentImageExisting] = useState(null);// server-side file
  const [garmentImageUploading, setGarmentImageUploading] = useState(false);
  const [garmentImageLoading, setGarmentImageLoading] = useState(false);

  // Season code → label map
  const seasonLabelMap = useMemo(
    () => Object.fromEntries(SEASON_CODES.map((s) => [s.value, s.label])),
    [],
  );

  // API-fetched dropdown options
  const [buyerOptions, setBuyerOptions] = useState([]);
  const [styleOptions, setStyleOptions] = useState([]);
  // Raw item lists per category — used for consumption-UOM display and techpack matching.
  const [fabricItemsRaw, setFabricItemsRaw] = useState([]);
  const [localTrimItemsRaw, setLocalTrimItemsRaw] = useState([]);
  const [importedTrimItemsRaw, setImportedTrimItemsRaw] = useState([]);
  // Select-ready {value,label} projections of the raw lists above.
  const [fabricItemOptions, setFabricItemOptions] = useState([]);
  const [localTrimOptions, setLocalTrimOptions] = useState([]);
  const [importedTrimOptions, setImportedTrimOptions] = useState([]);
  // Category names behind each picker, kept so the dropdowns can search the server later.
  const [variantCategories, setVariantCategories] = useState({ fabric: '', localTrim: '', importedTrim: '' });
  // Per-picker debounce handles for the variant search above.
  const variantSearchTimers = useRef({});
  useEffect(() => () => Object.values(variantSearchTimers.current).forEach(clearTimeout), []);
  const [manufacturingProcesses, setManufacturingProcesses] = useState([]);
  const [overheadItems, setOverheadItems] = useState([]);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState([]);

  // Quick Add modal state
  const [quickAddProcessOpen, setQuickAddProcessOpen] = useState(false);
  const [quickAddProcessLoading, setQuickAddProcessLoading] = useState(false);
  const [quickAddProcessForm] = Form.useForm();
  const [pendingMfgRowKey, setPendingMfgRowKey] = useState(null);
  const [quickAddOverheadOpen, setQuickAddOverheadOpen] = useState(false);
  const [quickAddOverheadLoading, setQuickAddOverheadLoading] = useState(false);
  const [quickAddOverheadForm] = Form.useForm();
  const [pendingOvhRowKey, setPendingOvhRowKey] = useState(null);
  const [quickAddStyleOpen, setQuickAddStyleOpen] = useState(false);
  const [quickAddStyleLoading, setQuickAddStyleLoading] = useState(false);
  const [quickAddStyleForm] = Form.useForm();
  const [quickAddStyleImage, setQuickAddStyleImage] = useState(null);        // staged File
  const [quickAddStyleImageUrl, setQuickAddStyleImageUrl] = useState(null);  // blob preview
  const canAddStyle = hasPermission('style-master', 'add');
  const canAddProcess = hasPermission('process-master', 'add');
  // Quick-add now creates an Overhead master record, so it is gated on that module.
  const canAddOverhead = hasPermission('overhead-master', 'add');
  const [stylesLoading, setStylesLoading] = useState(false);
  const [optionsLoading, setOptionsLoading] = useState(false);

  // Section data
  const [fabricRows, setFabricRows] = useState([]);
  const [localTrims, setLocalTrims] = useState([]);
  const [importedTrims, setImportedTrims] = useState([]);
  const [manufacturingRows, setManufacturingRows] = useState([]);
  const [overheadRows, setOverheadRows] = useState([]);

  // Summary editable fields
  const [agentCommissionPct, setAgentCommissionPct] = useState(0);
  const [profitPct, setProfitPct] = useState(0);
  const [targetPrice, setTargetPrice] = useState('');

  // Multi-size overrides
  const [perSizeOverrides, setPerSizeOverrides] = useState({});
  const [syncPercentages, setSyncPercentages] = useState(true);

  // Knits modal
  const [knitsModalOpen, setKnitsModalOpen] = useState(false);
  const [knitsRowKey, setKnitsRowKey] = useState(null);
  const [knitsParts, setKnitsParts] = useState([]);
  // Consumption UOM of the row the knits calculator is open for — the modal shows its
  // total in this unit so what the user approves is what lands in the row.
  const [knitsTargetUom, setKnitsTargetUom] = useState('');

  // Techpack import modal
  const [techpackModalOpen, setTechpackModalOpen] = useState(false);

  // AI consumption calculator modal
  const [consumptionModalOpen, setConsumptionModalOpen] = useState(false);
  const [consumptionRowKey, setConsumptionRowKey]       = useState(null);
  const [consumptionFabricRow, setConsumptionFabricRow] = useState(null);
  const [wovenModalOpen, setWovenModalOpen]             = useState(false);
  const [wovenRowKey, setWovenRowKey]                   = useState(null);
  const [bomImportOpen, setBomImportOpen]               = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen]             = useState(false);
  const [pdfPreviewData, setPdfPreviewData]             = useState(null);
  const [templateModalOpen, setTemplateModalOpen]       = useState(false);
  const [templateModalMode, setTemplateModalMode]       = useState('load');
  const [priceTrendOpen, setPriceTrendOpen]             = useState(false);
  const [scenarioName, setScenarioName]                 = useState('');
  const [scenarioGroupId, setScenarioGroupId]           = useState(null);

  // Past PO suggestions
  const [poSuggestions, setPOSuggestions] = useState([]);
  const [suggestionVisible, setSuggestionVisible] = useState(false);

  // Fetch dropdown options from API on mount
  useEffect(() => {
    const fetchOptions = async () => {
      setOptionsLoading(true);
      try {
        // Fetch buyers
        const buyers = await getBuyers();
        setBuyerOptions((buyers || []).map((b) => ({ value: b.id, label: b.name })));
        // Buyer dropdown is ready — clear its spinner immediately
        setOptionsLoading(false);

        // Fetch categories to find Fabric, Local Trims, Imported Trims
        const catRes = await getAllCategories();
        const categories = catRes.data || catRes || [];
        setCategoryOptions(categories.filter((c) => c.isActive !== false).map((c) => ({ value: c.name, label: c.name })));

        const fabricCat = categories.find((c) => c.name === 'Fabric');
        const localTrimCat = categories.find((c) => c.name?.toLowerCase().includes('local trim'));
        const importedTrimCat = categories.find((c) => c.name?.toLowerCase().includes('imported trim'));
        // Fallback: use a general "Trims" category for both if specific ones aren't found
        const generalTrimCat = (!localTrimCat || !importedTrimCat)
          ? categories.find((c) => {
              const n = c.name?.toLowerCase() || '';
              return n.includes('trim') && !n.includes('local') && !n.includes('imported');
            })
          : null;

        // Resolve effective categories
        const effectiveLocalTrimCat = localTrimCat || generalTrimCat;
        const effectiveImportedTrimCat = importedTrimCat || generalTrimCat;
        // Costing rows reference item *variants*, not items — the variant carries the
        // fabric/trim identity the user picks and everything downstream keys on.
        const [fabVariants, ltVariants, itVariants] = await Promise.all([
          fetchVariantsForCategory(fabricCat?.name),
          fetchVariantsForCategory(effectiveLocalTrimCat?.name),
          fetchVariantsForCategory(effectiveImportedTrimCat?.name),
        ]);

        setFabricItemsRaw(fabVariants);
        setFabricItemOptions(toVariantOptions(fabVariants));
        setLocalTrimItemsRaw(ltVariants);
        setLocalTrimOptions(toVariantOptions(ltVariants));
        setImportedTrimItemsRaw(itVariants);
        setImportedTrimOptions(toVariantOptions(itVariants));
        setVariantCategories({
          fabric: fabricCat?.name || '',
          localTrim: effectiveLocalTrimCat?.name || '',
          importedTrim: effectiveImportedTrimCat?.name || '',
        });

        // Fetch processes (Manufacturing), processes (Overheads), and suppliers
        const [mfgResult, ovhResult, suppResult] = await Promise.allSettled([
          getActiveProcesses('Manufacturing'),
          // Overhead rows are a FK to the OVERHEADS master (mst_overheads), not to
          // processes — CostSheetService resolves the row description from it.
          getActiveOverheads(),
          getSuppliers(),
        ]);
        if (mfgResult.status === 'fulfilled') {
          const procs = Array.isArray(mfgResult.value) ? mfgResult.value : mfgResult.value?.data || [];
          setManufacturingProcesses(procs.map((p) => ({ value: p.id, label: p.processName, defaultCost: p.defaultCost || 0 })));
        }
        if (ovhResult.status === 'fulfilled') {
          const ovhs = Array.isArray(ovhResult.value) ? ovhResult.value : ovhResult.value?.data || [];
          setOverheadItems(ovhs.map((o) => ({ value: o.id, label: o.overheadName, defaultCost: o.defaultCost || 0 })));
        }
        if (suppResult.status === 'fulfilled') {
          const supps = Array.isArray(suppResult.value) ? suppResult.value : suppResult.value?.data || [];
          setSupplierOptions(supps.filter((s) => s.isActive !== false).map((s) => ({ value: s.id, label: s.name })));
        }
      } catch {
        // Fallback to empty arrays — dropdowns will be empty
      } finally {
        setOptionsLoading(false);
      }
    };
    fetchOptions();
  }, []);

  // Load existing cost sheet for edit
  useEffect(() => {
    if (isEdit) {
      loadCostSheet();
    } else {
      // Reset all state for a blank new cost sheet
      form.resetFields();
      setCostingId('Auto-generated');
      setSavedDate(null);
      setEntityVersion(null);
      setCurrency('INR');
      setQuoteCurrency('USD');
      setActualRate(83.80);
      setFileList({ TECHPACK: [], MEASUREMENT_CHART: [], OTHER: [] });
      setStyleId(null);
      setStyleOptions([]);
      setFabricRows([]);
      setLocalTrims([]);
      setImportedTrims([]);
      setManufacturingRows([]);
      setOverheadRows([]);
      setAgentCommissionPct(0);
      setProfitPct(0);
      setTargetPrice('');
      setPerSizeOverrides({});
      setSyncPercentages(true);
      setCostingType('FOB');
      setPricingUnit('PIECE');
      setFabricNotes('');
      setTrimsNotes('');
      setManufacturingNotes('');
      setOverheadNotes('');
      setScenarioName('');
      setScenarioGroupId(null);
      setIsDirty(false);
    }
  }, [id]);

  // Fetch exchange rates when currencies change
  // Combines quote→local rate and USD→INR rate into a single effect to avoid duplicate API calls
  useEffect(() => {
    let cancelled = false;

    const fetchRates = async () => {
      const needsQuoteRate = quoteCurrency && quoteCurrency !== currency;
      const isQuoteUsdToInr = quoteCurrency === 'USD' && currency === 'INR';

      if (needsQuoteRate) {
        const rate = await getTodaysRate(quoteCurrency, currency);
        if (cancelled) return;
        setTodaysRate(rate);
        if (!isEdit && rate > 1) {
          setActualRate(Math.round(rate * 100) / 100);
        }
        // Reuse the same rate if it's already USD→INR
        if (isQuoteUsdToInr) {
          setUsdToInrRate(rate);
        } else {
          const usdRate = await getTodaysRate('USD', 'INR');
          if (!cancelled) setUsdToInrRate(usdRate);
        }
      } else {
        setTodaysRate(1);
        const usdRate = await getTodaysRate('USD', 'INR');
        if (!cancelled) setUsdToInrRate(usdRate);
      }
    };

    fetchRates();
    return () => { cancelled = true; };
  }, [currency, quoteCurrency]);

  const loadCostSheet = async () => {
    setLoading(true);
    try {
      const cs = await getCostSheetById(id);
      setEntityVersion(cs.version);
      setLoadedStatus(cs.status || null);
      setCostingId(cs.costingId);
      setStyleId(cs.styleId || null);
      setCurrency(cs.currency);
      setQuoteCurrency(cs.quoteCurrency);
      setActualRate(cs.actualRate);
      // Ensure every loaded row has a unique `key` — the API strips keys on save,
      // and the Table + update/delete functions depend on `key` for row identity.
      const withKeys = (rows, prefix) =>
        (rows || []).map((r, i) => ({ ...r, key: r.key || `${prefix}_${Date.now()}_${i}` }));
      // Normalise UOM: the API returns uomId/uomName/uomSymbol for the consumption unit plus
      // the snapshotted purchase unit and factor. Reading them off the row (rather than
      // re-resolving from the variant) keeps a saved sheet priced exactly as it was saved,
      // and keeps working when the row's variant falls outside the 50-row picker window.
      const withUom = (rows, prefix) =>
        withKeys(rows, prefix).map((r) => ({
          ...r,
          uom: r.uom || r.uomSymbol || r.uomName || '',
          primaryUom: r.primaryUom || r.primaryUomSymbol || '',
          uomConversionFactor: r.uomConversionFactor ?? null,
        }));
      setFabricRows(withUom(cs.fabricRows, 'f'));
      setLocalTrims(withUom(cs.localTrims, 'lt'));
      setImportedTrims(withUom(cs.importedTrims, 'it'));
      setManufacturingRows(withKeys(cs.manufacturingRows, 'm'));
      setOverheadRows(withKeys(cs.overheadRows, 'o'));
      setAgentCommissionPct(cs.agentCommissionPct || 0);
      setProfitPct(cs.profitPct || 0);
      setTargetPrice(cs.targetPrice || '');
      setCostingType(cs.costingType || 'FOB');
      setPricingUnit(cs.pricingUnit || 'PIECE');
      setFabricNotes(cs.fabricNotes || '');
      setTrimsNotes(cs.trimsNotes || '');
      setManufacturingNotes(cs.manufacturingNotes || '');
      setOverheadNotes(cs.overheadNotes || '');
      setScenarioName(cs.scenarioName || '');
      setScenarioGroupId(cs.scenarioGroupId || null);
      // Load categorized attachments from file storage API
      if (cs.id) {
        getAttachments(cs.id).then((attachments) => {
          const grouped = { TECHPACK: [], MEASUREMENT_CHART: [], OTHER: [] };
          (attachments || []).forEach((a) => {
            const cat = ['TECHPACK', 'MEASUREMENT_CHART'].includes(a.fileCategory) ? a.fileCategory : 'OTHER';
            grouped[cat].push({
              uid: a.fileId,
              name: a.originalFilename,
              status: 'done',
              size: a.fileSizeBytes,
              type: a.fileType,
              fileId: a.fileId,
              category: cat,
            });
          });
          setFileList(grouped);
        }).catch(() => {
          setFileList({ TECHPACK: [], MEASUREMENT_CHART: [], OTHER: [] });
        });
      }

      // Load per-size overrides from API response
      if (cs.sizeSummaries && cs.sizeSummaries.length > 0) {
        const overrides = {};
        let allSameAgent = true;
        let allSameProfit = true;
        const firstAgent = cs.sizeSummaries[0].agentCommissionPct;
        const firstProfit = cs.sizeSummaries[0].profitPct;
        cs.sizeSummaries.forEach((ss) => {
          overrides[ss.sizes] = {
            agentCommissionPct: ss.agentCommissionPct,
            profitPct: ss.profitPct,
            targetPrice: ss.targetPrice,
          };
          if (ss.agentCommissionPct !== firstAgent) allSameAgent = false;
          if (ss.profitPct !== firstProfit) allSameProfit = false;
        });
        setPerSizeOverrides(overrides);
        setSyncPercentages(allSameAgent && allSameProfit);
      }

      // Parse season: "SS26" → seasonCode="SS", seasonYear="2026"
      let seasonCode = '';
      let seasonYear = '';
      if (cs.season && cs.season.length >= 4) {
        seasonCode = cs.season.substring(0, 2);
        seasonYear = '20' + cs.season.substring(2);
      }

      // Fetch styles for the loaded buyer so the Select can show the correct label
      if (cs.buyerId) {
        try {
          const styles = await getStylesByBuyerId(cs.buyerId);
          setStyleOptions(
            (styles || []).map((s) => ({ value: s.id, label: s.styleNo, style: s }))
          );
        } catch {
          // Style options may not load — dropdown will be empty
        }
      }

      setSavedDate(cs.date ? dayjs(cs.date) : null);
      form.setFieldsValue({
        buyerId: cs.buyerId,
        styleNo: cs.styleId || null,
        garmentName: cs.garmentName,
        seasonCode,
        seasonYear,
        currency: cs.currency,
        quoteCurrency: cs.quoteCurrency,
        actualRate: cs.actualRate,
        sizes: cs.sizes,
      });

      // Load style image for edit mode
      if (cs.styleId) loadStyleImage(cs.styleId);
      // Load garment image stored against this cost sheet
      if (cs.id) loadGarmentImage(cs.id);
    } catch {
      message.error('Failed to load cost sheet');
      navigate('/costing/list');
    } finally {
      // Defer so React paints the form with populated values before hiding the skeleton
      requestAnimationFrame(() => setLoading(false));
    }
  };

  // ==================== AUTO CALCULATIONS ====================

  const totalFabricCost = useMemo(() => {
    return fabricRows.reduce((sum, r) => sum + (Number(r.netCost) || 0), 0);
  }, [fabricRows]);

  const totalLocalTrimsCost = useMemo(() => {
    return localTrims.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
  }, [localTrims]);

  const totalImportedTrimsCostUsd = useMemo(() => {
    return importedTrims.reduce((sum, r) => sum + (Number(r.priceUsd) || 0), 0);
  }, [importedTrims]);

  // The exchange rate converts between USD and the costing currency. When the sheet is
  // already costed in USD there is nothing to convert — applying the rate regardless
  // inflated imported-trim costs by ~95x and shrank the final price by the same factor.
  const usdToCostingRate = useMemo(
    () => (currency === 'USD' ? 1 : Number(actualRate) || 1),
    [currency, actualRate]
  );
  const costingToQuoteRate = useMemo(
    () => (currency === quoteCurrency ? 1 : Number(actualRate) || 1),
    [currency, quoteCurrency, actualRate]
  );

  const totalAccessoriesCost = useMemo(() => {
    return totalLocalTrimsCost + totalImportedTrimsCostUsd * usdToCostingRate;
  }, [totalLocalTrimsCost, totalImportedTrimsCostUsd, usdToCostingRate]);

  const totalManufacturingCost = useMemo(() => {
    return manufacturingRows.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
  }, [manufacturingRows]);

  const totalMarkupCost = useMemo(() => {
    return overheadRows.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
  }, [overheadRows]);

  const totalMakingPrice = useMemo(() => {
    const fabricForCalc = costingType === 'CMT' ? 0 : totalFabricCost;
    return calcTotalMakingPrice(fabricForCalc, totalAccessoriesCost, totalManufacturingCost, totalMarkupCost);
  }, [totalFabricCost, totalAccessoriesCost, totalManufacturingCost, totalMarkupCost, costingType]);

  const totalOverheadCharges = useMemo(() => {
    return calcTotalOverheadCharges(agentCommissionPct, profitPct, totalMakingPrice);
  }, [agentCommissionPct, profitPct, totalMakingPrice]);

  const totalPrice = useMemo(() => {
    return totalMakingPrice + totalOverheadCharges;
  }, [totalMakingPrice, totalOverheadCharges]);

  const finalPrice = useMemo(() => {
    return calcFinalPrice(totalPrice, costingToQuoteRate);
  }, [totalPrice, costingToQuoteRate]);

  const finalPriceUsd = useMemo(() => {
    if (quoteCurrency === 'USD') return finalPrice;
    return calcFinalPriceUsd(finalPrice, quoteCurrency, actualRate, usdToInrRate);
  }, [finalPrice, quoteCurrency, actualRate, usdToInrRate]);

  // Extract unique size keys from ALL tables
  const uniqueSizeKeys = useMemo(() => {
    const allRows = [...fabricRows, ...localTrims, ...importedTrims, ...manufacturingRows, ...overheadRows];
    const sizeSet = new Set();
    allRows.forEach((r) => {
      if (r.sizes && r.sizes.trim()) {
        r.sizes.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => sizeSet.add(s));
      }
    });
    return [...sizeSet].sort();
  }, [fabricRows, localTrims, importedTrims, manufacturingRows, overheadRows]);

  // Per-size cost summaries
  const perSizeSummaries = useMemo(() => {
    if (uniqueSizeKeys.length <= 1) return [];

    const matchesSize = (row, sizeKey) => {
      if (!row.sizes || !row.sizes.trim()) return true; // blank = all sizes
      return row.sizes.split(',').map((s) => s.trim()).includes(sizeKey);
    };

    return uniqueSizeKeys.map((sizeKey) => {
      const fabCost = fabricRows.filter((r) => matchesSize(r, sizeKey)).reduce((sum, r) => sum + (Number(r.netCost) || 0), 0);
      const localCost = localTrims.filter((r) => matchesSize(r, sizeKey)).reduce((sum, r) => sum + (Number(r.price) || 0), 0);
      const importCostUsd = importedTrims.filter((r) => matchesSize(r, sizeKey)).reduce((sum, r) => sum + (Number(r.priceUsd) || 0), 0);
      const accCost = localCost + importCostUsd * usdToCostingRate;
      const mfgCost = manufacturingRows.filter((r) => matchesSize(r, sizeKey)).reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
      const ovhCost = overheadRows.filter((r) => matchesSize(r, sizeKey)).reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
      const makingPrice = calcTotalMakingPrice(fabCost, accCost, mfgCost, ovhCost);

      const sizeAgent = syncPercentages ? agentCommissionPct : (perSizeOverrides[sizeKey]?.agentCommissionPct ?? agentCommissionPct);
      const sizeProfit = syncPercentages ? profitPct : (perSizeOverrides[sizeKey]?.profitPct ?? profitPct);
      const sizeTarget = perSizeOverrides[sizeKey]?.targetPrice ?? '';

      const overheadCharges = calcTotalOverheadCharges(sizeAgent, sizeProfit, makingPrice);
      const sizeTotalPrice = makingPrice + overheadCharges;
      const sizeFinalPrice = calcFinalPrice(sizeTotalPrice, costingToQuoteRate);
      const sizeFinalPriceUsd = quoteCurrency === 'USD' ? sizeFinalPrice : calcFinalPriceUsd(sizeFinalPrice, quoteCurrency, actualRate, usdToInrRate);

      return {
        sizeKey, fabCost, localCost, importCostUsd, accCost, mfgCost, ovhCost,
        makingPrice, agentCommissionPct: sizeAgent, profitPct: sizeProfit,
        targetPrice: sizeTarget, overheadCharges, totalPrice: sizeTotalPrice,
        finalPrice: sizeFinalPrice, finalPriceUsd: sizeFinalPriceUsd,
      };
    });
  }, [uniqueSizeKeys, fabricRows, localTrims, importedTrims, manufacturingRows, overheadRows,
      actualRate, usdToCostingRate, costingToQuoteRate,
      agentCommissionPct, profitPct, syncPercentages, perSizeOverrides, quoteCurrency, usdToInrRate]);

  // Auto-calculate profit when target price changes
  useEffect(() => {
    if (targetPrice && Number(targetPrice) > 0 && totalMakingPrice > 0) {
      const autoProfit = calcAutoProfit(Number(targetPrice), totalMakingPrice, agentCommissionPct);
      setProfitPct(Math.round(autoProfit * 100) / 100);
    }
  }, [targetPrice, totalMakingPrice, agentCommissionPct]);

  // ==================== BUYER & STYLE HANDLERS ====================

  const handleBuyerChange = async (buyerId) => {
    // Clear style fields when buyer changes
    form.setFieldsValue({ styleNo: undefined, garmentName: '', seasonCode: undefined, seasonYear: undefined });
    setStyleId(null);
    setStyleOptions([]);
    // Clear style image
    setStyleImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });

    if (!buyerId) return;

    setStylesLoading(true);
    try {
      const styles = await getStylesByBuyerId(buyerId);
      setStyleOptions(
        (styles || []).map((s) => ({ value: s.id, label: s.styleNo, style: s }))
      );
    } catch {
      setStyleOptions([]);
    } finally {
      setStylesLoading(false);
    }
  };

  const handleStyleChange = (selectedStyleId, option) => {
    setStyleId(selectedStyleId);
    if (option?.style) {
      const style = option.style;
      form.setFieldsValue({
        garmentName: style.garmentName || '',
        seasonCode: style.seasonCode || undefined,
        seasonYear: style.seasonYear || undefined,
      });
    }
    loadStyleImage(selectedStyleId);
  };

  // ==================== STYLE IMAGE LOADER ====================

  const loadStyleImage = async (selectedStyleId) => {
    const loadId = ++imageLoadIdRef.current;
    setStyleImageUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (!selectedStyleId) {
      setStyleImageLoading(false);
      return;
    }
    setStyleImageLoading(true);
    try {
      const files = await getFilesByEntity('STYLE', selectedStyleId);
      if (loadId !== imageLoadIdRef.current) return;
      const img = (files || []).find((f) => ['IMAGE', 'PHOTO'].includes(f.fileCategory));
      if (!img) return;
      const blob = await downloadFileAsBlob(img.fileId);
      if (loadId !== imageLoadIdRef.current) return;
      setStyleImageUrl(URL.createObjectURL(blob));
    } catch {
      // Image not found or failed to load — non-critical
    } finally {
      if (loadId === imageLoadIdRef.current) setStyleImageLoading(false);
    }
  };

  // Cleanup style image blob URL on unmount
  useEffect(() => {
    return () => {
      setStyleImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  // ==================== GARMENT IMAGE (CR C-3) ====================

  const loadGarmentImage = async (costSheetId) => {
    if (!costSheetId) return;
    setGarmentImageLoading(true);
    try {
      const files = await getFilesByEntity('COST_SHEET', costSheetId);
      const img = (files || []).find((f) => ['IMAGE', 'PHOTO'].includes(f.fileCategory));
      if (img) {
        const blob = await downloadFileAsBlob(img.fileId);
        setGarmentImageExisting(img);
        setGarmentImageUrl(URL.createObjectURL(blob));
      }
    } catch {
      // Image not found / failed — non-critical
    } finally {
      setGarmentImageLoading(false);
    }
  };

  const handleGarmentImageSelect = async (file) => {
    if (garmentImageUrl && garmentImageFile) URL.revokeObjectURL(garmentImageUrl);
    const previewUrl = URL.createObjectURL(file);
    if (isEdit && id) {
      // Existing sheet — upload immediately
      setGarmentImageUrl(previewUrl);
      setGarmentImageFile(null);
      setGarmentImageUploading(true);
      try {
        if (garmentImageExisting?.fileId) {
          await deleteFile(garmentImageExisting.fileId).catch(() => {});
        }
        const result = await uploadFile(file, { module: 'COST_SHEET', entity: 'COST_SHEET', entityId: id, fileCategory: 'IMAGE' });
        setGarmentImageExisting(result?.data || result);
        message.success('Garment image uploaded');
      } catch {
        message.error('Image upload failed. Please try again.');
        URL.revokeObjectURL(previewUrl);
        setGarmentImageUrl(garmentImageExisting ? garmentImageUrl : null);
      } finally {
        setGarmentImageUploading(false);
      }
    } else {
      // New sheet — stage; uploaded after the cost sheet is created
      setGarmentImageFile(file);
      setGarmentImageUrl(previewUrl);
      setIsDirty(true);
    }
  };

  const handleGarmentImageRemove = async () => {
    if (garmentImageUrl) URL.revokeObjectURL(garmentImageUrl);
    if (garmentImageExisting?.fileId && isEdit && id) {
      const prevImg = garmentImageExisting;
      setGarmentImageExisting(null);
      setGarmentImageUrl(null);
      setGarmentImageFile(null);
      setGarmentImageUploading(true);
      try {
        await deleteFile(prevImg.fileId);
        message.success('Garment image removed');
      } catch {
        message.error('Failed to remove image. Please try again.');
        setGarmentImageExisting(prevImg);
      } finally {
        setGarmentImageUploading(false);
      }
    } else {
      setGarmentImageFile(null);
      setGarmentImageUrl(null);
      setIsDirty(true);
    }
  };

  // Upload a staged garment image after a new cost sheet is created
  const processGarmentImage = async (costSheetId) => {
    if (!garmentImageFile || !costSheetId) return;
    try {
      await uploadFile(garmentImageFile, { module: 'COST_SHEET', entity: 'COST_SHEET', entityId: costSheetId, fileCategory: 'IMAGE' });
    } catch {
      message.warning('Cost sheet saved, but garment image upload failed. You can re-upload by editing it.');
    }
  };

  // Cleanup garment image blob URL on unmount
  useEffect(() => {
    return () => {
      setGarmentImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  // ==================== TECHPACK IMPORT HANDLER ====================

  const handleTechpackApply = async (result) => {
    // 1. Load buyer styles if buyer matched, then set buyer + style fields
    if (result.matchedBuyerId) {
      form.setFieldValue('buyerId', result.matchedBuyerId);
      try {
        const styles = await import('../../services/master/styleService').then((m) =>
          m.getStylesByBuyerId(result.matchedBuyerId)
        );
        setStyleOptions((styles || []).map((s) => ({ value: s.id, label: s.styleNo, style: s })));
      } catch { /* style options unavailable */ }
    }

    // 2. Set style + header form fields
    form.setFieldsValue({
      garmentName:  result.garmentName  || '',
      seasonCode:   result.seasonCode   || undefined,
      seasonYear:   result.seasonYear   || undefined,
      sizes:        result.sizes?.length ? result.sizes : undefined,
      ...(result.matchedStyleId && { styleNo: result.matchedStyleId }),
    });
    if (result.matchedStyleId) {
      setStyleId(result.matchedStyleId);
      loadStyleImage(result.matchedStyleId);
    }

    // 3. Map fabric rows
    if (result.fabricRows?.length) {
      setFabricRows(
        result.fabricRows.map((r, i) => {
          // Techpack extraction matches at item level; costing rows key on a variant,
          // so default to the item's first variant and let the user refine it.
          const variant = firstVariantOfItem(fabricItemsRaw, r.matchedItemId);
          return {
            key:              `f_import_${Date.now()}_${i}`,
            itemId:           r.matchedItemId   || null,
            variantId:        variant?.id       || null,
            variantCode:      variant?.variantCode || '',
            fabricType:       variant?.variantName || r.matchedItemName || r.extractedName || '',
            classification:   r.classification  || 'Woven',
            description:      variant?.description || r.notes || '',
            consumption:      '',
            uom:              variant?.secondaryUomSymbol || variant?.uomSymbol || r.uom || '',
            uomId:            variant?.uomId || null,
            fabricPrice:      '',
            fabricWidthStd:   '',
            fabricWidthVendor: '',
            vendorId:         null,
            vendorName:       '',
            allowancePct:     0,
            netCost:          0,
            sizes:            '',
          };
        })
      );
    }

    // 4. Map local trim rows
    if (result.localTrimRows?.length) {
      setLocalTrims(
        result.localTrimRows.map((r, i) => {
          const variant = firstVariantOfItem(localTrimItemsRaw, r.matchedItemId);
          return {
            key:         `lt_import_${Date.now()}_${i}`,
            itemId:      r.matchedItemId   || null,
            variantId:   variant?.id       || null,
            item:        variant?.variantName || r.matchedItemName || r.extractedName || '',
            code:        variant?.variantCode || '',
            size:        '',
            consumption: r.quantity || '',
            uom:         variant?.secondaryUomSymbol || variant?.uomSymbol || r.uom || 'pcs',
            cost:        '',
            price:       0,
            sizes:       '',
          };
        })
      );
    }

    // 5. Map imported trim rows
    if (result.importedTrimRows?.length) {
      setImportedTrims(
        result.importedTrimRows.map((r, i) => {
          const variant = firstVariantOfItem(importedTrimItemsRaw, r.matchedItemId);
          return {
            key:         `it_import_${Date.now()}_${i}`,
            itemId:      r.matchedItemId   || null,
            variantId:   variant?.id       || null,
            item:        variant?.variantName || r.matchedItemName || r.extractedName || '',
            code:        variant?.variantCode || '',
            size:        '',
            consumption: r.quantity || '',
            uom:         variant?.secondaryUomSymbol || variant?.uomSymbol || r.uom || 'pcs',
            costUsd:     '',
            priceUsd:    0,
            sizes:       '',
          };
        })
      );
    }

    // 6. Map manufacturing rows (only add if explicitly extracted)
    if (result.manufacturingRows?.length) {
      setManufacturingRows(
        result.manufacturingRows.map((r, i) => ({
          key:      `m_import_${Date.now()}_${i}`,
          processId: null,
          process:  r.matchedItemName || r.extractedName || '',
          cost:     '',
          comments: r.notes || '',
          sizes:    '',
        }))
      );
    }

    setIsDirty(true);
    message.success('Techpack data applied. Please fill in prices and consumption.');
  };

  // ==================== ROW HANDLERS ====================

  const updateFabricRow = (key, field, value) => {
    setFabricRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, [field]: value };
        updated.netCost = calcFabricNetCost(
          updated.consumption, updated.fabricPrice, updated.allowancePct, updated.wastagePct,
          updated.uomConversionFactor,
        );
        return updated;
      })
    );
    setIsDirty(true);
  };


  const addFabricRow = () => {
    setFabricRows((prev) => [
      ...prev,
      {
        key: `f_${Date.now()}`,
        itemId: null,
        variantId: null,
        variantCode: '',
        fabricType: '',
        classification: 'Woven',
        description: '',
        consumption: '',
        uom: '',
        uomId: null,
        primaryUom: '',
        primaryUomId: null,
        secondaryUomId: null,
        uomConversionFactor: null,
        fabricPrice: '',
        fabricWidthStd: '',
        fabricWidthVendor: '',
        vendorId: null,
        vendorName: '',
        allowancePct: 0,
        netCost: 0,
        sizes: '',
      },
    ]);
    setIsDirty(true);
  };

  const handleFabricItemSelect = (key, variantId) => {
    // The row is identified by the variant; itemId is carried along for PO/BOM linkage.
    const variant = fabricItemsRaw.find((v) => v.id === variantId);
    setFabricRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = {
          ...r,
          variantId,
          variantCode: variant?.variantCode || '',
          itemId: variant?.itemId ?? null,
          // The fabric name shown to the user is the variant's name (server reads it back from the variant).
          fabricType: variant?.variantName || variant?.variantCode || '',
          // Auto-populate description from the item master (CR C-6); keep any existing text otherwise
          description: variant?.description || r.description || '',
          // Consumption UOM, purchase UOM and the factor bridging them
          ...variantUomFields(variant),
        };
        // Auto-set classification from subcategory
        if (variant?.subCategoryName) {
          const subName = variant.subCategoryName.toLowerCase();
          if (subName.includes('knit')) updated.classification = 'Knits';
          else if (subName.includes('woven')) updated.classification = 'Woven';
        }
        // Switching fabric can change the conversion factor, which re-prices the row.
        updated.netCost = calcFabricNetCost(
          updated.consumption, updated.fabricPrice, updated.allowancePct, updated.wastagePct,
          updated.uomConversionFactor,
        );
        return updated;
      }),
    );
    // Preserve past-PO price suggestions keyed by the parent item.
    if (variant.itemId) loadSuggestions('fabric', variant.itemId);
    setIsDirty(true);
  };

  const deleteFabricRow = (key) => {
    setFabricRows((prev) => prev.filter((r) => r.key !== key));
    setIsDirty(true);
  };

  const duplicateFabricRow = (key) => {
    setFabricRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx === -1) return prev;
      const clone = { ...prev[idx], key: `f_${Date.now()}` };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  const updateLocalTrim = (key, fieldOrObj, value) => {
    setLocalTrims((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = typeof fieldOrObj === 'object'
          ? { ...r, ...fieldOrObj }
          : { ...r, [fieldOrObj]: value };
        updated.price = calcTrimPrice(updated.consumption, updated.cost, updated.uomConversionFactor);
        return updated;
      })
    );
    setIsDirty(true);
  };

  const addLocalTrim = () => {
    setLocalTrims((prev) => [
      ...prev,
      { key: `lt_${Date.now()}`, itemId: null, variantId: null, item: '', code: '', size: '', consumption: '', uom: '', uomId: null, primaryUom: '', primaryUomId: null, secondaryUomId: null, uomConversionFactor: null, cost: '', price: 0, sizes: '' },
    ]);
    setIsDirty(true);
  };

  const deleteLocalTrim = (key) => {
    setLocalTrims((prev) => prev.filter((r) => r.key !== key));
    setIsDirty(true);
  };

  const duplicateLocalTrim = (key) => {
    setLocalTrims((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx === -1) return prev;
      const clone = { ...prev[idx], key: `lt_${Date.now()}` };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  const updateImportedTrim = (key, fieldOrObj, value) => {
    setImportedTrims((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = typeof fieldOrObj === 'object'
          ? { ...r, ...fieldOrObj }
          : { ...r, [fieldOrObj]: value };
        updated.priceUsd = calcTrimPrice(updated.consumption, updated.costUsd, updated.uomConversionFactor);
        return updated;
      })
    );
    setIsDirty(true);
  };

  const addImportedTrim = () => {
    setImportedTrims((prev) => [
      ...prev,
      { key: `it_${Date.now()}`, itemId: null, variantId: null, item: '', code: '', size: '', consumption: '', uom: '', uomId: null, primaryUom: '', primaryUomId: null, secondaryUomId: null, uomConversionFactor: null, costUsd: '', priceUsd: 0, sizes: '' },
    ]);
    setIsDirty(true);
  };

  const deleteImportedTrim = (key) => {
    setImportedTrims((prev) => prev.filter((r) => r.key !== key));
    setIsDirty(true);
  };

  const duplicateImportedTrim = (key) => {
    setImportedTrims((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx === -1) return prev;
      const clone = { ...prev[idx], key: `it_${Date.now()}` };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  const updateManufacturingRow = (key, fieldOrObj, value) => {
    setManufacturingRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        return typeof fieldOrObj === 'object' ? { ...r, ...fieldOrObj } : { ...r, [fieldOrObj]: value };
      })
    );
    setIsDirty(true);
  };

  const addManufacturingRow = () => {
    setManufacturingRows((prev) => [
      ...prev,
      { key: `m_${Date.now()}`, processId: null, process: '', cost: '', comments: '', sizes: '' },
    ]);
    setIsDirty(true);
  };

  const deleteManufacturingRow = (key) => {
    setManufacturingRows((prev) => prev.filter((r) => r.key !== key));
    setIsDirty(true);
  };

  const duplicateManufacturingRow = (key) => {
    setManufacturingRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx === -1) return prev;
      const clone = { ...prev[idx], key: `m_${Date.now()}` };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
    setIsDirty(true);
  };

  const updateOverheadRow = (key, fieldOrObj, value) => {
    setOverheadRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        return typeof fieldOrObj === 'object' ? { ...r, ...fieldOrObj } : { ...r, [fieldOrObj]: value };
      })
    );
    setIsDirty(true);
  };

  const addOverheadRow = () => {
    setOverheadRows((prev) => [
      ...prev,
      { key: `o_${Date.now()}`, overheadId: null, description: '', cost: '', comments: '', sizes: '' },
    ]);
    setIsDirty(true);
  };

  const deleteOverheadRow = (key) => {
    setOverheadRows((prev) => prev.filter((r) => r.key !== key));
    setIsDirty(true);
  };

  const duplicateOverheadRow = (key) => {
    setOverheadRows((prev) => {
      const idx = prev.findIndex((r) => r.key === key);
      if (idx === -1) return prev;
      const clone = { ...prev[idx], key: `o_${Date.now()}` };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };


  // Knits modal handlers
  const openKnitsModal = (rowKey) => {
    setKnitsRowKey(rowKey);
    const row = fabricRows.find((r) => r.key === rowKey);
    setKnitsParts(row?.knitsParts || []);
    // The modal shows its total in the row's consumption UOM, so it needs that symbol.
    setKnitsTargetUom(row ? getConsumptionUom(row, fabricItemsRaw) : '');
    setKnitsModalOpen(true);
  };

  /**
   * The calculator returns GRAMS (what its formula produces). Restate that in the row's
   * consumption UOM before storing, so a 59.33 g garment lands as 59.33 in a GMS row and
   * as 0.0593 in a KG row — rather than always as kilograms regardless of the label.
   */
  const handleKnitsApply = (totalGrams, parts) => {
    setFabricRows((prev) =>
      prev.map((r) => {
        if (r.key !== knitsRowKey) return r;
        const targetUom = getConsumptionUom(r, fabricItemsRaw);
        const converted = convertGramsTo(totalGrams, targetUom) ?? 0;
        const finalConsumption = Math.round(converted * 10000) / 10000;
        const updated = { ...r, consumption: finalConsumption, knitsParts: parts };
        updated.netCost = calcFabricNetCost(
          updated.consumption, updated.fabricPrice, updated.allowancePct, updated.wastagePct,
          updated.uomConversionFactor,
        );
        return updated;
      })
    );
    setKnitsModalOpen(false);
    // Without this, applying the calculator then saving reported "No changes detected"
    // and silently discarded the result.
    setIsDirty(true);
  };

  // AI Consumption modal handlers
  const openConsumptionModal = (rowKey, row) => {
    setConsumptionRowKey(rowKey);
    setConsumptionFabricRow(row);
    setConsumptionModalOpen(true);
  };

  const handleConsumptionApply = (result) => {
    // The AI reports its own UOM (kg for knits, m for woven). The row's consumption UOM
    // comes from the item master and may disagree — applying the number regardless is how
    // a kilogram figure ends up in a GMS field, so say so instead of hiding it.
    const targetRow = fabricRows.find((r) => r.key === consumptionRowKey);
    const rowUom = targetRow ? getConsumptionUom(targetRow, fabricItemsRaw) : '';
    if (rowUom && result.uom && normaliseUomSymbol(rowUom) !== normaliseUomSymbol(result.uom)) {
      message.warning(
        `AI calculated in ${String(result.uom).toUpperCase()} but this fabric is consumed in ` +
        `${rowUom.toUpperCase()}. Check the value — it was applied as-is.`,
      );
    }
    if (result.splitBySizes) {
      // Replace the source row with one row per size, each with its specific consumption
      setFabricRows((prev) => {
        const source = prev.find((r) => r.key === consumptionRowKey);
        if (!source) return prev;
        const newRows = (result.sizes || []).map((size, i) => {
          const c = result.consumptionPerSize?.[size] || 0;
          return {
            ...source,
            key:         `${consumptionRowKey}_sz_${i}_${Date.now()}`,
            sizes:       size,
            consumption: c,
            uom:         source.uom || result.uom,
            netCost:     calcFabricNetCost(
              c, source.fabricPrice, source.allowancePct, source.wastagePct,
              source.uomConversionFactor,
            ),
          };
        });
        return [...prev.filter((r) => r.key !== consumptionRowKey), ...newRows];
      });
    } else {
      setFabricRows((prev) =>
        prev.map((r) => {
          if (r.key !== consumptionRowKey) return r;
          const updated = { ...r, consumption: result.consumption, uom: r.uom || result.uom };
          updated.netCost = calcFabricNetCost(
            updated.consumption, updated.fabricPrice, updated.allowancePct, updated.wastagePct,
            updated.uomConversionFactor,
          );
          return updated;
        })
      );
    }
    setConsumptionModalOpen(false);
    setIsDirty(true);
    message.success('Consumption updated from AI calculation.');
  };

  /**
   * Open the Knits Parts Calculator pre-filled with AI-extracted panel data.
   * contributionPerSize values are in kg → multiply by 1000 to get grams (what the modal expects).
   * Called from ConsumptionCalcModal's "Verify in Calculator" button.
   */
  const handleOpenKnitsCalcFromAI = (aiParts, gsm, size) => {
    const preparedParts = (aiParts || []).map((p, i) => ({
      key:          `kp_ai_${i}`,
      partName:     p.partName || `Part ${i + 1}`,
      length:       '',
      width:        '',
      nop:          p.numberOfPieces || 1,
      gsm:          gsm || '',
      // contributionPerSize is raw panel contribution in kg → convert to grams
      gramsPerPart: p.contributionPerSize?.[size] != null
        ? Math.round(p.contributionPerSize[size] * 100000) / 100
        : '',
    }));
    setConsumptionModalOpen(false);
    setKnitsRowKey(consumptionRowKey);
    setKnitsParts(preparedParts);
    const row = fabricRows.find((r) => r.key === consumptionRowKey);
    setKnitsTargetUom(row ? getConsumptionUom(row, fabricItemsRaw) : '');
    setKnitsModalOpen(true);
  };

  // Past PO suggestions
  const loadSuggestions = async (type, itemId) => {
    if (!itemId) return;
    const suggestions = await getPastPOSuggestions(type, itemId);
    setPOSuggestions(suggestions);
    setSuggestionVisible(suggestions.length > 0);
  };

  // ==================== SAVE / SUBMIT ====================

  const buildPayload = (formValues, status) => {
    // Combine season code + year → e.g. "SS26"
    const season =
      formValues.seasonCode && formValues.seasonYear
        ? formValues.seasonCode + formValues.seasonYear.slice(-2)
        : '';

    // Resolve buyer name and styleNo label from options
    const selectedBuyer = buyerOptions.find((b) => b.value === formValues.buyerId);
    const selectedStyle = styleOptions.find((s) => s.value === formValues.styleNo);
    const resolvedStyleNo = selectedStyle ? selectedStyle.label : formValues.styleNo;

    // Strip `key` from row arrays before sending to API
    const cleanRows = (rows) => rows.map(({ key, ...rest }) => rest);

    return {
      version: entityVersion,
      costingId,
      status,
      date: dayjs().format('YYYY-MM-DD'),
      buyerId: formValues.buyerId,
      buyerName: selectedBuyer?.label || '',
      styleId,
      styleNo: resolvedStyleNo,
      garmentName: formValues.garmentName,
      season,
      currency,
      quoteCurrency,
      actualRate,
      todaysRate,
      sizes: formValues.sizes || [],
      fabricRows: cleanRows(fabricRows),
      localTrims: cleanRows(localTrims),
      importedTrims: cleanRows(importedTrims),
      manufacturingRows: cleanRows(manufacturingRows),
      overheadRows: cleanRows(overheadRows),
      agentCommissionPct,
      profitPct,
      targetPrice,
      costingType,
      pricingUnit,
      fabricNotes,
      trimsNotes,
      manufacturingNotes,
      overheadNotes,
      scenarioName,
      scenarioGroupId,
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
      finalPriceUsd: quoteCurrency === 'USD' ? finalPrice : finalPriceUsd,
      sizeSummaries: uniqueSizeKeys.length > 1
        ? uniqueSizeKeys.map((sk) => ({
            sizes: sk,
            agentCommissionPct: syncPercentages ? agentCommissionPct : (perSizeOverrides[sk]?.agentCommissionPct ?? agentCommissionPct),
            profitPct: syncPercentages ? profitPct : (perSizeOverrides[sk]?.profitPct ?? profitPct),
            targetPrice: perSizeOverrides[sk]?.targetPrice ?? null,
          }))
        : [],
    };
  };

  const handleSaveDraft = async () => {
    if (isEdit && !isDirty) {
      message.warning('No changes detected.');
      return;
    }
    // Require core header before a draft can be saved (CR C-5)
    const header = form.getFieldsValue(['buyerId', 'styleNo', 'garmentName']);
    if (!header.buyerId || !header.styleNo || !header.garmentName) {
      message.error('Please select Buyer, Style and Garment before saving a draft.');
      return;
    }
    // For draft, validate but allow save even with warnings for optional fields
    let values;
    try {
      values = await form.validateFields();
    } catch (errInfo) {
      // Show validation warnings but allow draft save to proceed
      const errorFields = errInfo?.errorFields || [];
      if (errorFields.length > 0) {
        errorFields.forEach((f) => f.errors?.forEach((e) => message.warning(e)));
      }
      values = form.getFieldsValue();
    }

    setSavingDraft(true);
    try {
      const payload = buildPayload(values, COSTING_STATUS.DRAFT);
      let saved;
      if (isEdit) {
        saved = await updateCostSheet(id, payload);
        message.success('Cost sheet saved as draft');
      } else {
        saved = await createCostSheet(payload);
        message.success('Cost sheet created as draft');
      }
      // Upload new attachments
      const costSheetId = saved?.id || id;
      if (costSheetId) await uploadNewFiles(costSheetId);
      if (costSheetId) await processGarmentImage(costSheetId);
      message.success({
        content: 'WhatsApp notification sent',
        icon: <WhatsAppOutlined style={{ color: '#25D366' }} />,
      });
      if (saved?.version != null) setEntityVersion(saved.version);
      setIsDirty(false);
      clearDirty();
      navigate('/costing/list');
    } catch {
      // Error toast already shown by axios interceptor with backend's specific message.
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    if (isEdit && !isDirty && loadedStatus !== COSTING_STATUS.DRAFT) {
      message.warning('No changes detected.');
      return;
    }
    let values;
    try {
      values = await form.validateFields();
    } catch (errInfo) {
      const errorFields = errInfo?.errorFields || [];
      if (errorFields.length > 0) {
        errorFields.forEach((f) => f.errors?.forEach((e) => message.error(e)));
      } else {
        message.error('Please fill all required fields');
      }
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildPayload(values, COSTING_STATUS.FINAL);
      let saved;
      if (isEdit) {
        saved = await updateCostSheet(id, payload);
        message.success('Cost sheet submitted successfully');
      } else {
        saved = await createCostSheet(payload);
        message.success('Cost sheet created and submitted');
      }
      // Upload new attachments
      const costSheetId = saved?.id || id;
      if (costSheetId) await uploadNewFiles(costSheetId);
      if (costSheetId) await processGarmentImage(costSheetId);
      message.success({
        content: 'WhatsApp notification sent',
        icon: <WhatsAppOutlined style={{ color: '#25D366' }} />,
      });
      if (saved?.version != null) setEntityVersion(saved.version);
      setIsDirty(false);
      clearDirty();
      navigate('/costing/list');
    } catch {
      // Error toast already shown by axios interceptor with backend's specific message.
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== PRINT ====================

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const values = form.getFieldsValue();
      const selectedBuyer = buyerOptions.find((b) => b.value === values.buyerId);
      const selectedStyle = styleOptions.find((s) => s.value === values.styleNo);
      const season =
        values.seasonCode && values.seasonYear
          ? values.seasonCode + values.seasonYear.slice(-2)
          : '';
      const cleanRows = (rows) => rows.map(({ key, ...rest }) => rest);

      const printData = {
        costingId,
        status: isEdit ? 'Draft' : 'Draft',
        date: (savedDate || dayjs()).format('YYYY-MM-DD'),
        buyerName: selectedBuyer?.label || '',
        styleNo: selectedStyle?.label || values.styleNo || '',
        garmentName: values.garmentName,
        season,
        currency,
        quoteCurrency,
        actualRate,
        todaysRate,
        usdToInrRate,
        sizes: values.sizes || [],
        fabricRows: cleanRows(fabricRows),
        localTrims: cleanRows(localTrims),
        importedTrims: cleanRows(importedTrims),
        manufacturingRows: cleanRows(manufacturingRows),
        overheadRows: cleanRows(overheadRows),
        agentCommissionPct,
        profitPct,
        targetPrice,
        costingType,
        pricingUnit,
        fabricNotes,
        trimsNotes,
        manufacturingNotes,
        overheadNotes,
        scenarioName,
        scenarioGroupId,
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
        finalPriceUsd: quoteCurrency === 'USD' ? finalPrice : finalPriceUsd,
        sizeSummaries: uniqueSizeKeys.length > 1
          ? uniqueSizeKeys.map((sk) => {
              const sizeFabric = fabricRows.filter((r) => r.sizes === sk).reduce((s, r) => s + (Number(r.netCost) || 0), 0);
              const sizeLocalTrims = localTrims.filter((r) => r.sizes === sk).reduce((s, r) => s + (Number(r.price) || 0), 0);
              const sizeImportedTrims = importedTrims.filter((r) => r.sizes === sk).reduce((s, r) => s + (Number(r.priceUsd) || 0), 0);
              const sizeAccessories = sizeLocalTrims + sizeImportedTrims * usdToCostingRate;
              const sizeMfg = manufacturingRows.filter((r) => r.sizes === sk).reduce((s, r) => s + (Number(r.cost) || 0), 0);
              const sizeMarkup = overheadRows.filter((r) => r.sizes === sk).reduce((s, r) => s + (Number(r.cost) || 0), 0);
              const sizeMaking = sizeFabric + sizeAccessories + sizeMfg + sizeMarkup;
              const sizeAgent = syncPercentages ? agentCommissionPct : (perSizeOverrides[sk]?.agentCommissionPct ?? agentCommissionPct);
              const sizeProfit = syncPercentages ? profitPct : (perSizeOverrides[sk]?.profitPct ?? profitPct);
              const sizeOverhead = ((sizeAgent + sizeProfit) / 100) * sizeMaking;
              const sizeTotalPrice = sizeMaking + sizeOverhead;
              const sizeFinalPrice = costingToQuoteRate ? sizeTotalPrice / costingToQuoteRate : 0;
              const sizeFinalPriceUsd = quoteCurrency === 'USD' ? sizeFinalPrice : calcFinalPriceUsd(sizeFinalPrice, quoteCurrency, actualRate, usdToInrRate);
              return {
                sizes: sk, agentCommissionPct: sizeAgent, profitPct: sizeProfit,
                totalFabricCost: sizeFabric, totalAccessoriesCost: sizeAccessories,
                totalManufacturingCost: sizeMfg, totalMarkupCost: sizeMarkup,
                totalMakingPrice: sizeMaking, totalPrice: sizeTotalPrice,
                finalPriceUsd: sizeFinalPriceUsd,
              };
            })
          : [],
      };
      await generateCostingPdf(printData);
    } catch {
      message.error('Failed to generate print document');
    } finally {
      setPrinting(false);
    }
  };

  // ==================== FILE UPLOAD ====================

  const categoryIcons = {
    TECHPACK: <FileTextOutlined style={{ color: '#6366f1' }} />,
    MEASUREMENT_CHART: <BarChartOutlined style={{ color: 'var(--info-color)' }} />,
    OTHER: <CloudUploadOutlined style={{ color: '#10b981' }} />,
  };

  const handleFileRemove = async (file, category) => {
    if (file.fileId) {
      try {
        await deleteAttachment(file.fileId);
        message.success('File deleted');
      } catch {
        message.error('Failed to delete file');
        return false;
      }
    }
    setFileList((prev) => ({
      ...prev,
      [category]: prev[category].filter((f) => f.uid !== file.uid),
    }));
  };

  const handleFileDownload = async (file) => {
    if (!file.fileId) return;
    try {
      const blob = await downloadAttachment(file.fileId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('Failed to download file');
    }
  };

  // Open an attachment in a new tab for preview (CR C-16). Works for both
  // already-uploaded files (download blob) and locally staged File objects.
  const handleFilePreview = async (file) => {
    try {
      let url;
      if (file.fileId) {
        const blob = await downloadAttachment(file.fileId);
        url = window.URL.createObjectURL(blob);
      } else {
        url = URL.createObjectURL(file.originFileObj || file);
      }
      window.open(url, '_blank', 'noopener');
    } catch {
      message.error('Failed to preview file');
    }
  };

  const getUploadProps = (category) => ({
    onRemove: (file) => handleFileRemove(file, category),
    onDownload: handleFileDownload,
    onPreview: handleFilePreview,
    showUploadList: { showDownloadIcon: true, showPreviewIcon: true },
    beforeUpload: (file) => {
      const isAllowed = ALLOWED_FILE_TYPES.includes(file.type);
      if (!isAllowed) {
        message.error('File type not allowed. Use JPG, PNG, PDF, DOC, or XLS.');
        return Upload.LIST_IGNORE;
      }
      const isLt5M = file.size / 1024 / 1024 < MAX_FILE_SIZE_MB;
      if (!isLt5M) {
        message.error(`File must be smaller than ${MAX_FILE_SIZE_MB}MB`);
        return Upload.LIST_IGNORE;
      }
      // Reject the same file being added twice (CR C-16)
      if ((fileList[category] || []).some((f) => f.name === file.name && (f.size ?? 0) === file.size)) {
        message.warning('This file has already been added.');
        return Upload.LIST_IGNORE;
      }
      setFileList((prev) => ({
        ...prev,
        [category]: [...prev[category], file],
      }));
      return false;
    },
    fileList: fileList[category],
  });

  const uploadNewFiles = async (costSheetId) => {
    const items = Object.entries(fileList).flatMap(([cat, files]) =>
      files.filter((f) => !f.fileId).map((f) => ({ file: f, category: cat }))
    );
    if (!items.length) return;
    try {
      await uploadAttachmentsBatch(costSheetId, items);
    } catch {
      message.warning('Failed to upload some attachments');
    }
  };

  // ==================== SECTION STYLES ====================

  const sectionHeaderStyle = (color) => ({
    background: isDarkMode
      ? `linear-gradient(135deg, ${color}22 0%, ${color}11 100%)`
      : `linear-gradient(135deg, ${color}15 0%, ${color}08 100%)`,
    borderRadius: 8,
    border: `1px solid ${isDarkMode ? `${color}33` : `${color}22`}`,
  });

  const summaryRowStyle = {
    background: isDarkMode ? 'rgba(99, 102, 241, 0.08)' : 'rgba(99, 102, 241, 0.04)',
    fontWeight: 600,
  };

  // ==================== HELPERS ====================

  /**
   * Unit that `consumption` is expressed in: the item's secondary UOM when it has one.
   *
   * Prefers the row's own snapshot over the variant list, because the picker holds only 50
   * variants per category — a reloaded row whose variant falls outside that window would
   * otherwise lose its unit entirely. The snapshot is written on every variant select, so
   * it is never staler than the list.
   */
  const getConsumptionUom = (record, rawVariants) => {
    if (record.uom) return record.uom;
    if (!record.variantId) return '';
    const variant = rawVariants?.find((v) => v.id === record.variantId);
    return variant?.secondaryUomSymbol || variant?.uomSymbol || '';
  };

  /** Unit the row's rate is quoted per — the item's primary (purchase) UOM. */
  const getRateUom = (record, rawVariants) => {
    if (record.primaryUom) return record.primaryUom;
    if (!record.variantId) return '';
    const variant = rawVariants?.find((v) => v.id === record.variantId);
    return variant?.uomSymbol || '';
  };

  /**
   * Rate input for fabric price / trim cost, annotated with the PURCHASE unit it is quoted
   * per ("/kg", "/cone").
   *
   * The unit is per-row rather than per-column — one table can hold a fabric bought by the
   * kilo and another bought by the metre — so it belongs on the input, exactly as the
   * Consumption column already annotates its own secondary unit. Where the two units differ
   * a tooltip spells out the bridge ("1 kg = 1000 GMS"), so a ₹600/kg rate sitting beside a
   * 59.33 GMS quantity reads as deliberate instead of inconsistent.
   */
  const renderRateInput = ({ value, record, rawVariants, onChange, placeholder = 'Rate' }) => {
    const rateUom = getRateUom(record, rawVariants);
    const consumptionUom = getConsumptionUom(record, rawVariants);
    const factor = record.uomConversionFactor;
    const input = (
      <InputNumber
        value={value}
        min={0}
        step={0.01}
        controls={false}
        placeholder={placeholder}
        onChange={onChange}
        size="small"
        style={{ width: '100%' }}
        addonAfter={rateUom ? `/${rateUom}` : undefined}
        {...numericInputProps}
      />
    );
    if (!(Number(factor) > 0) || !rateUom || !consumptionUom) return input;
    return (
      <Tooltip title={formatConversionLabel(rateUom, consumptionUom, factor)}>
        {input}
      </Tooltip>
    );
  };

  // Match on both variant name and code so users can search either.
  const variantFilterOption = (input, option) => {
    const needle = String(input).toLowerCase();
    return (
      String(option?.label ?? '').toLowerCase().includes(needle) ||
      String(option?.variantCode ?? '').toLowerCase().includes(needle)
    );
  };

  // The variants API returns at most 50 rows per call, so the initial preload alone
  // leaves larger categories partly unreachable. Searching the server as the user types
  // keeps every variant selectable; matches are merged into the raw list too, so the
  // row's onChange can still resolve the picked variant by id.
  const handleVariantSearch = useCallback(
    (slot, setRaw, setOptions) => (text) => {
      const q = (text || '').trim();
      clearTimeout(variantSearchTimers.current[slot]);
      const categoryName = variantCategories[slot];
      if (!categoryName || q.length < 2) return;
      variantSearchTimers.current[slot] = setTimeout(async () => {
        const list = await fetchVariantsForCategory(categoryName, q);
        if (!list.length) return;
        setRaw((prev) => mergeVariantsById(prev, list));
        setOptions((prev) => {
          const byValue = new Map((prev || []).map((o) => [o.value, o]));
          toVariantOptions(list).forEach((o) => byValue.set(o.value, o));
          return [...byValue.values()];
        });
      }, 300);
    },
    [variantCategories],
  );

  // Stable per-picker search handlers (AntD 6 takes these via showSearch.onSearch).
  const onFabricVariantSearch = useMemo(
    () => handleVariantSearch('fabric', setFabricItemsRaw, setFabricItemOptions),
    [handleVariantSearch],
  );
  const onLocalTrimVariantSearch = useMemo(
    () => handleVariantSearch('localTrim', setLocalTrimItemsRaw, setLocalTrimOptions),
    [handleVariantSearch],
  );
  const onImportedTrimVariantSearch = useMemo(
    () => handleVariantSearch('importedTrim', setImportedTrimItemsRaw, setImportedTrimOptions),
    [handleVariantSearch],
  );

  // ==================== COLUMN DEFINITIONS ====================

  const fabricColumns = [
    { title: 'S.No', width: 50, align: 'center', render: (_, __, i) => <span style={{ textAlign: 'center', display: 'block' }}>{i + 1}</span> },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      width: 180,
      render: (val, record) => (
        <Select
          mode="multiple"
          value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
          placeholder="Sizes"
          options={sizeOptions}
          onChange={(arr) => updateFabricRow(record.key, 'sizes', arr.join(', '))}
          size="small"
          style={{ width: '100%' }}
          maxTagCount={1}
        />
      ),
    },
    {
      title: 'Fabric Name',
      dataIndex: 'variantId',
      width: 240,
      render: (val, record) => (
        <Select
          value={record.variantId || undefined}
          style={{ width: '100%' }}
          options={fabricItemOptions}
          showSearch={{ filterOption: variantFilterOption, onSearch: onFabricVariantSearch }}
          placeholder="Select"
          onChange={(v) => handleFabricItemSelect(record.key, v)}
          onFocus={() => loadSuggestions('fabric', record.itemId)}
          size="small"
        />
      ),
    },
    {
      title: 'Classification',
      dataIndex: 'classification',
      width: 120,
      render: (val, record) => (
        <Select
          value={val}
          style={{ width: '100%' }}
          options={FABRIC_CLASSIFICATIONS}
          onChange={(v) => updateFabricRow(record.key, 'classification', v)}
          size="small"
        />
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (val, record) => (
        <Input
          value={val}
          placeholder="Fabric desc"
          onChange={(e) => updateFabricRow(record.key, 'description', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: 'Consumption',
      dataIndex: 'consumption',
      // Holds the quantity, its unit addon and two calculator buttons. Sized for the unit
      // rendering as a full word ("KILOGRAMS") when only uomName is available.
      width: 210,
      render: (val, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <InputNumber
            value={val}
            min={0}
            step={0.01}
            controls={false}
            placeholder="Qty"
            onChange={(v) => updateFabricRow(record.key, 'consumption', v)}
            size="small"
            style={{ flex: 1 }}
            addonAfter={getConsumptionUom(record, fabricItemsRaw)?.toUpperCase() || undefined}
            {...numericInputProps}
          />
          {record.classification === 'Knits' && (
            <Tooltip title="Knits Consumption Calculator (manual parts)">
              <Button
                icon={<CalculatorOutlined />}
                onClick={() => openKnitsModal(record.key)}
                size="small"
                type="text"
                style={{ color: '#6366f1', flexShrink: 0 }}
              />
            </Tooltip>
          )}
          <Tooltip title="Calculate from Measurement Chart (AI)">
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => openConsumptionModal(record.key, record)}
              size="small"
              type="text"
              style={{ color: 'var(--warning-color)', flexShrink: 0 }}
            />
          </Tooltip>
        </div>
      ),
    },
    {
      title: `Price (${getCurrencySymbol(currency)})`,
      dataIndex: 'fabricPrice',
      // Wide enough for a 5-figure rate plus the "/kg" unit addon without truncating.
      width: 200,
      render: (val, record) => renderRateInput({
        value: val,
        record,
        rawVariants: fabricItemsRaw,
        onChange: (v) => updateFabricRow(record.key, 'fabricPrice', v),
      }),
    },
    {
      title: 'Width (Std)',
      dataIndex: 'fabricWidthStd',
      width: 100,
      render: (val, record) => (
        <Input
          value={val}
          placeholder='e.g. 58"'
          onChange={(e) => updateFabricRow(record.key, 'fabricWidthStd', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: 'Width (Vendor)',
      dataIndex: 'fabricWidthVendor',
      width: 110,
      render: (val, record) => (
        <Input
          value={val}
          placeholder='e.g. 58"'
          onChange={(e) => updateFabricRow(record.key, 'fabricWidthVendor', e.target.value)}
          size="small"
        />
      ),
    },
    {
      title: 'Allowance %',
      dataIndex: 'allowancePct',
      width: 100,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          max={100}
          controls={false}
          placeholder="%"
          onChange={(v) => updateFabricRow(record.key, 'allowancePct', v)}
          size="small"
          style={{ width: '100%' }}
          {...numericInputProps}
        />
      ),
    },
    {
      title: 'Wastage %',
      dataIndex: 'wastagePct',
      width: 100,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          max={100}
          controls={false}
          placeholder="%"
          onChange={(v) => updateFabricRow(record.key, 'wastagePct', v)}
          size="small"
          style={{ width: '100%' }}
          {...numericInputProps}
        />
      ),
    },
    {
      title: `Net Cost (${getCurrencySymbol(currency)})`,
      dataIndex: 'netCost',
      width: 120,
      render: (val) => (
        <Text strong style={{ color: 'var(--success-color)' }}>
          {formatCurrency(val, currency)}
        </Text>
      ),
    },
    {
      title: '',
      width: 110,
      render: (_, record) => (
        <Space size={0}>
          {record.classification === 'Woven' && (
            <Tooltip title="Woven Consumption Calculator">
              <Button type="text" size="small" icon={<CalculatorOutlined />} onClick={() => { setWovenRowKey(record.key); setWovenModalOpen(true); }} />
            </Tooltip>
          )}
          <ActionButton action="duplicate" onClick={() => duplicateFabricRow(record.key)} />
          <ActionButton action="delete" onClick={() => deleteFabricRow(record.key)} />
        </Space>
      ),
    },
  ];

  const localTrimColumns = [
    { title: 'S.No', width: 50, align: 'center', render: (_, __, i) => <span style={{ textAlign: 'center', display: 'block' }}>{i + 1}</span> },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      width: 180,
      render: (val, record) => (
        <Select
          mode="multiple"
          value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
          placeholder="Sizes"
          options={sizeOptions}
          onChange={(arr) => updateLocalTrim(record.key, 'sizes', arr.join(', '))}
          size="small"
          style={{ width: '100%' }}
          maxTagCount={1}
        />
      ),
    },
    {
      title: 'Item',
      dataIndex: 'variantId',
      render: (_, record) => (
        <Select
          value={record.variantId || undefined}
          style={{ width: '100%' }}
          options={localTrimOptions}
          showSearch={{ filterOption: variantFilterOption, onSearch: onLocalTrimVariantSearch }}
          placeholder="Select item"
          onChange={(v) => {
            const variant = localTrimItemsRaw.find((i) => i.id === v);
            updateLocalTrim(record.key, {
              variantId: v,
              itemId: variant?.itemId ?? null,
              item: variant?.variantName || variant?.variantCode || '',
              code: variant?.variantCode || '',
              ...variantUomFields(variant),
            });
          }}
          size="small"
        />
      ),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      width: 130,
      render: (val, record) => (
        <Input value={val} placeholder="Item code" onChange={(e) => updateLocalTrim(record.key, 'code', e.target.value)} size="small" />
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      width: 90,
      render: (val, record) => (
        <Input value={val} placeholder="Size" onChange={(e) => updateLocalTrim(record.key, 'size', e.target.value)} size="small" />
      ),
    },
    {
      title: 'Consumption',
      dataIndex: 'consumption',
      width: 140,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} controls={false} placeholder="Qty" onChange={(v) => updateLocalTrim(record.key, 'consumption', v)} size="small" style={{ width: '100%' }} addonAfter={getConsumptionUom(record, localTrimItemsRaw)?.toUpperCase() || undefined} {...numericInputProps} />
      ),
    },
    {
      title: `Cost (${getCurrencySymbol(currency)})`,
      dataIndex: 'cost',
      width: 190,
      render: (val, record) => renderRateInput({
        value: val,
        record,
        rawVariants: localTrimItemsRaw,
        onChange: (v) => updateLocalTrim(record.key, 'cost', v),
        placeholder: 'Cost',
      }),
    },
    {
      title: `Price (${getCurrencySymbol(currency)})`,
      dataIndex: 'price',
      width: 120,
      render: (val) => (
        <Text strong>{formatCurrency(val, currency)}</Text>
      ),
    },
    {
      title: '',
      width: 80,
      render: (_, record) => (
        <Space size={0}>
          <ActionButton action="duplicate" onClick={() => duplicateLocalTrim(record.key)} />
          <ActionButton action="delete" onClick={() => deleteLocalTrim(record.key)} />
        </Space>
      ),
    },
  ];

  const importedTrimColumns = [
    { title: 'S.No', width: 50, align: 'center', render: (_, __, i) => <span style={{ textAlign: 'center', display: 'block' }}>{i + 1}</span> },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      width: 180,
      render: (val, record) => (
        <Select
          mode="multiple"
          value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
          placeholder="Sizes"
          options={sizeOptions}
          onChange={(arr) => updateImportedTrim(record.key, 'sizes', arr.join(', '))}
          size="small"
          style={{ width: '100%' }}
          maxTagCount={1}
        />
      ),
    },
    {
      title: 'Item',
      dataIndex: 'variantId',
      render: (_, record) => (
        <Select
          value={record.variantId || undefined}
          style={{ width: '100%' }}
          options={importedTrimOptions}
          showSearch={{ filterOption: variantFilterOption, onSearch: onImportedTrimVariantSearch }}
          placeholder="Select item"
          onChange={(v) => {
            const variant = importedTrimItemsRaw.find((i) => i.id === v);
            updateImportedTrim(record.key, {
              variantId: v,
              itemId: variant?.itemId ?? null,
              item: variant?.variantName || variant?.variantCode || '',
              code: variant?.variantCode || '',
              ...variantUomFields(variant),
            });
          }}
          size="small"
        />
      ),
    },
    {
      title: 'Code',
      dataIndex: 'code',
      width: 130,
      render: (val, record) => (
        <Input value={val} placeholder="Item code" onChange={(e) => updateImportedTrim(record.key, 'code', e.target.value)} size="small" />
      ),
    },
    {
      title: 'Size',
      dataIndex: 'size',
      width: 90,
      render: (val, record) => (
        <Input value={val} placeholder="Size" onChange={(e) => updateImportedTrim(record.key, 'size', e.target.value)} size="small" />
      ),
    },
    {
      title: 'Consumption',
      dataIndex: 'consumption',
      width: 140,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} controls={false} placeholder="Qty" onChange={(v) => updateImportedTrim(record.key, 'consumption', v)} size="small" style={{ width: '100%' }} addonAfter={getConsumptionUom(record, importedTrimItemsRaw)?.toUpperCase() || undefined} {...numericInputProps} />
      ),
    },
    {
      title: 'Cost ($ USD)',
      dataIndex: 'costUsd',
      width: 190,
      render: (val, record) => renderRateInput({
        value: val,
        record,
        rawVariants: importedTrimItemsRaw,
        onChange: (v) => updateImportedTrim(record.key, 'costUsd', v),
        placeholder: 'Cost',
      }),
    },
    {
      title: 'Price ($ USD)',
      dataIndex: 'priceUsd',
      width: 120,
      render: (val) => (
        <Text strong>{formatCurrency(val, 'USD')}</Text>
      ),
    },
    {
      title: '',
      width: 80,
      render: (_, record) => (
        <Space size={0}>
          <ActionButton action="duplicate" onClick={() => duplicateImportedTrim(record.key)} />
          <ActionButton action="delete" onClick={() => deleteImportedTrim(record.key)} />
        </Space>
      ),
    },
  ];

  // Merge saved row values into API options so existing values always display
  const effectiveMfgOptions = useMemo(() => {
    const apiIds = new Set(manufacturingProcesses.map((o) => o.value));
    const extras = manufacturingRows
      .filter((r) => r.processId && !apiIds.has(r.processId))
      .map((r) => ({ value: r.processId, label: r.process || `Process #${r.processId}` }));
    return [...manufacturingProcesses, ...extras.filter((e, i, arr) => arr.findIndex((x) => x.value === e.value) === i)];
  }, [manufacturingProcesses, manufacturingRows]);

  const effectiveOvhOptions = useMemo(() => {
    const apiIds = new Set(overheadItems.map((o) => o.value));
    const extras = overheadRows
      .filter((r) => r.overheadId && !apiIds.has(r.overheadId))
      .map((r) => ({ value: r.overheadId, label: r.description || `Overhead #${r.overheadId}` }));
    return [...overheadItems, ...extras.filter((e, i, arr) => arr.findIndex((x) => x.value === e.value) === i)];
  }, [overheadItems, overheadRows]);

  const manufacturingColumns = [
    { title: 'S.No', width: 50, align: 'center', render: (_, __, i) => <span style={{ textAlign: 'center', display: 'block' }}>{i + 1}</span> },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      width: 180,
      render: (val, record) => (
        <Select
          mode="multiple"
          value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
          placeholder="Sizes"
          options={sizeOptions}
          onChange={(arr) => updateManufacturingRow(record.key, 'sizes', arr.join(', '))}
          size="small"
          style={{ width: '100%' }}
          maxTagCount={1}
        />
      ),
    },
    {
      title: 'Process',
      dataIndex: 'processId',
      width: 200,
      render: (val, record) => (
        <Select
          value={record.processId || undefined}
          style={{ width: '100%' }}
          options={effectiveMfgOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Select process"
          onChange={(v, opt) => {
            const defaultCost = opt.defaultCost || 0;
            updateManufacturingRow(record.key, {
              processId: v,
              process: opt.label,
              ...(defaultCost > 0 && !record.cost ? { cost: defaultCost } : {}),
            });
          }}
          size="small"
          dropdownRender={canAddProcess ? (menu) => (
            <>
              {menu}
              <Divider style={{ margin: '4px 0' }} />
              <Button type="link" icon={<PlusOutlined />} style={{ width: '100%', textAlign: 'left' }} onClick={() => { setPendingMfgRowKey(record.key); setQuickAddProcessOpen(true); }}>
                Add New Process
              </Button>
            </>
          ) : undefined}
        />
      ),
    },
    {
      title: 'Vendor',
      dataIndex: 'vendorId',
      width: 170,
      render: (val, record) => (
        <Select
          value={record.vendorId || undefined}
          style={{ width: '100%' }}
          options={supplierOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Vendor"
          allowClear
          onChange={(v, opt) => updateManufacturingRow(record.key, { vendorId: v || null, vendorName: opt?.label || '' })}
          size="small"
        />
      ),
    },
    {
      title: `Cost (${getCurrencySymbol(currency)})`,
      dataIndex: 'cost',
      width: 130,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} controls={false} placeholder="Cost" onChange={(v) => updateManufacturingRow(record.key, 'cost', v)} size="small" style={{ width: '100%' }} {...numericInputProps} />
      ),
    },
    {
      title: 'Comments',
      dataIndex: 'comments',
      render: (val, record) => (
        <Input value={val} placeholder="Notes" onChange={(e) => updateManufacturingRow(record.key, 'comments', e.target.value)} size="small" />
      ),
    },
    {
      title: '',
      width: 80,
      render: (_, record) => (
        <Space size={0}>
          <ActionButton action="duplicate" onClick={() => duplicateManufacturingRow(record.key)} />
          <ActionButton action="delete" onClick={() => deleteManufacturingRow(record.key)} />
        </Space>
      ),
    },
  ];

  const overheadColumns = [
    { title: 'S.No', width: 50, align: 'center', render: (_, __, i) => <span style={{ textAlign: 'center', display: 'block' }}>{i + 1}</span> },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      width: 180,
      render: (val, record) => (
        <Select
          mode="multiple"
          value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
          placeholder="Sizes"
          options={sizeOptions}
          onChange={(arr) => updateOverheadRow(record.key, 'sizes', arr.join(', '))}
          size="small"
          style={{ width: '100%' }}
          maxTagCount={1}
        />
      ),
    },
    {
      title: 'Description',
      dataIndex: 'overheadId',
      width: 200,
      render: (val, record) => (
        <Select
          value={record.overheadId || undefined}
          style={{ width: '100%' }}
          options={effectiveOvhOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Select overhead"
          onChange={(v, opt) => {
            const defaultCost = opt.defaultCost || 0;
            updateOverheadRow(record.key, {
              overheadId: v,
              description: opt.label,
              ...(defaultCost > 0 && !record.cost ? { cost: defaultCost } : {}),
            });
          }}
          size="small"
          dropdownRender={canAddOverhead ? (menu) => (
            <>
              {menu}
              <Divider style={{ margin: '4px 0' }} />
              <Button type="link" icon={<PlusOutlined />} style={{ width: '100%', textAlign: 'left' }} onClick={() => { setPendingOvhRowKey(record.key); setQuickAddOverheadOpen(true); }}>
                Add New Overhead
              </Button>
            </>
          ) : undefined}
        />
      ),
    },
    {
      title: `Cost (${getCurrencySymbol(currency)})`,
      dataIndex: 'cost',
      width: 130,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} controls={false} placeholder="Cost" onChange={(v) => updateOverheadRow(record.key, 'cost', v)} size="small" style={{ width: '100%' }} {...numericInputProps} />
      ),
    },
    {
      title: 'Comments',
      dataIndex: 'comments',
      render: (val, record) => (
        <Input value={val} placeholder="Notes" onChange={(e) => updateOverheadRow(record.key, 'comments', e.target.value)} size="small" />
      ),
    },
    {
      title: '',
      width: 80,
      render: (_, record) => (
        <Space size={0}>
          <ActionButton action="duplicate" onClick={() => duplicateOverheadRow(record.key)} />
          <ActionButton action="delete" onClick={() => deleteOverheadRow(record.key)} />
        </Space>
      ),
    },
  ];

  // ==================== COLLAPSE ITEMS ====================

  const collapseItems = [
    {
      key: 'general',
      label: (
        <Text strong style={{ fontSize: 15, color: '#6366f1' }}>
          Section A — General Details
        </Text>
      ),
      style: sectionHeaderStyle('#6366f1'),
      children: (
        <>
        <div style={{ display: 'flex', gap: 16 }}>
          {/* Form fields */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <Row gutter={16}>
              {isEdit && (
                <Col xs={12} md={8}>
                  <Form.Item label="Costing ID">
                    <Input value={costingId} disabled />
                  </Form.Item>
                </Col>
              )}
              <Col xs={24} md={8}>
                <Form.Item label={<Space>Buyer {form.getFieldValue('buyerId') && <Tooltip title="Buyer Price Trend"><Button type="link" size="small" icon={<BarChartOutlined />} style={{ padding: 0, height: 'auto' }} onClick={() => setPriceTrendOpen(true)} /></Tooltip>}</Space>} name="buyerId" rules={[{ required: true, message: 'Buyer is required' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select buyer"
                    options={buyerOptions}
                    loading={optionsLoading}
                    onChange={handleBuyerChange}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item label="Style #" name="styleNo" rules={[{ required: true, message: 'Style # is required' }]}>
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder="Select style"
                    options={styleOptions}
                    loading={stylesLoading}
                    disabled={!form.getFieldValue('buyerId')}
                    onChange={handleStyleChange}
                    dropdownRender={canAddStyle && form.getFieldValue('buyerId') ? (menu) => (
                      <>
                        {menu}
                        <Divider style={{ margin: '4px 0' }} />
                        <Button
                          type="link"
                          icon={<PlusOutlined />}
                          style={{ width: '100%', textAlign: 'left', padding: '4px 12px' }}
                          onClick={() => {
                            quickAddStyleForm.resetFields();
                            quickAddStyleForm.setFieldsValue({ buyerId: form.getFieldValue('buyerId') });
                            setQuickAddStyleOpen(true);
                          }}
                        >
                          Add New Style
                        </Button>
                      </>
                    ) : undefined}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item label="Garment Name" name="garmentName" rules={[{ required: true, message: 'Required' }]}>
                  <Input placeholder="Auto-filled from style" disabled style={{ backgroundColor: 'var(--bg-tertiary)' }} />
                </Form.Item>
              </Col>
              {/* Hidden fields to preserve raw values for buildPayload */}
              <Form.Item name="seasonCode" hidden noStyle><Input /></Form.Item>
              <Form.Item name="seasonYear" hidden noStyle><Input /></Form.Item>
              <Col xs={12} md={6}>
                <Form.Item label="Season">
                  <Input
                    value={seasonLabelMap[watchedSeasonCode] || ''}
                    placeholder="Auto-filled from style"
                    disabled
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="Year">
                  <Input
                    value={watchedSeasonYear || ''}
                    placeholder="Auto-filled from style"
                    disabled
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="Costing Type">
                  <Select
                    value={costingType}
                    options={COSTING_TYPES}
                    onChange={(v) => { setCostingType(v); setIsDirty(true); }}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="Pricing Unit">
                  <Segmented
                    value={pricingUnit}
                    options={PRICING_UNITS}
                    onChange={(v) => { setPricingUnit(v); setIsDirty(true); }}
                    block
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="Costing Currency" name="currency" rules={[{ required: true }]}>
                  <Select
                    options={CURRENCIES}
                    onChange={(v) => setCurrency(v)}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="Quote Currency" name="quoteCurrency" rules={[{ required: true }]}>
                  <Select
                    options={CURRENCIES}
                    onChange={(v) => setQuoteCurrency(v)}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label="Actual Rate" rules={[{ required: true }]}>
                  <InputNumber
                    value={actualRate}
                    min={0}
                    step={0.01}
                    controls={false}
                    style={{ width: '100%', height: 40 }}
                    onChange={setActualRate}
                    {...numericInputProps}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label={<Space>Today's Rate <Tooltip title="Auto-fetched exchange rate"><InfoCircleOutlined /></Tooltip></Space>}>
                  <InputNumber value={todaysRate} disabled style={{ width: '100%', height: 40 }} />
                </Form.Item>
              </Col>
              <Col xs={16}>
                <Form.Item
                  label="Sizes"
                  name="sizes"
                  rules={[{ required: true, message: 'At least one size is required' }]}
                >
                  <Select
                    mode="tags"
                    placeholder="Select or type sizes (e.g. S, M, L, XL)"
                    style={{ width: '100%' }}
                    tokenSeparators={[',']}
                    options={['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL'].map((s) => ({ value: s, label: s }))}
                    onChange={(vals) => {
                      // Normalise to upper-case + de-duplicate so "s" and "S" never coexist (CR C-15)
                      const norm = [...new Set((vals || []).map((v) => String(v).trim().toUpperCase()).filter(Boolean))];
                      form.setFieldsValue({ sizes: norm });
                      setIsDirty(true);
                    }}
                  />
                </Form.Item>
              </Col>
              <Col xs={8}>
                <Form.Item label="Scenario Name">
                  <Input
                    value={scenarioName}
                    onChange={(e) => { setScenarioName(e.target.value); setIsDirty(true); }}
                    placeholder="e.g. Option A — Cotton Body"
                    maxLength={100}
                  />
                </Form.Item>
              </Col>
            </Row>
          </div>
          {/* Style Image — fixed sidebar (view-only) */}
          {styleId && (
            <div style={{
              flexShrink: 0,
              width: 130,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 4,
            }}>
              <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>Style Image</Typography.Text>
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
                    border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`,
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
                  <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: 1.3 }}>No style<br />image</Typography.Text>
                </div>
              )}
            </div>
          )}
          {/* Garment Image — editable, stored against this cost sheet (CR C-3) */}
          <div style={{
            flexShrink: 0,
            width: 130,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 4,
          }}>
            <Typography.Text type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>Garment Image</Typography.Text>
            <FileUpload
              accept="image/png,image/jpeg,image/jpg"
              maxSizeMB={10}
              previewUrl={garmentImageUrl}
              fileName={garmentImageExisting?.originalFilename || garmentImageFile?.name || null}
              fileType={garmentImageExisting?.fileType || garmentImageFile?.type || null}
              fileSize={garmentImageExisting?.fileSizeBytes || garmentImageFile?.size || null}
              onSelect={handleGarmentImageSelect}
              onRemove={handleGarmentImageRemove}
              disabled={garmentImageUploading}
              loading={garmentImageUploading || garmentImageLoading}
              compact
              placeholder="Add garment image"
              infoMessage={
                isEdit && id
                  ? 'Image changes are saved immediately and independently of the other cost sheet fields.'
                  : 'The image will be uploaded automatically when you save the cost sheet.'
              }
            />
          </div>
        </div>
        <Row gutter={16}>
              <Col xs={24}>
                <Form.Item label={<Text strong style={{ fontSize: 15, color: '#6366f1' }}>Attachments</Text>} style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'row', gap: 16 }}>
                    {ATTACHMENT_CATEGORIES.map((cat) => (
                      <Card
                        key={cat.value}
                        size="small"
                        title={
                          <Space size={6}>
                            {categoryIcons[cat.value]}
                            <Typography.Text style={{ fontSize: 13, fontWeight: 600 }}>{cat.label}</Typography.Text>
                            {fileList[cat.value]?.length > 0 && (
                              <Tag style={{ marginLeft: 4, fontSize: 11 }}>{fileList[cat.value].length}</Tag>
                            )}
                          </Space>
                        }
                        styles={{ body: { padding: '8px 12px' } }}
                        style={{
                          flex: 1,
                          borderRadius: 8,
                          border: `1px solid ${isDarkMode ? '#333' : '#e5e7eb'}`,
                        }}
                      >
                        <Dragger
                          {...getUploadProps(cat.value)}
                          style={{ padding: '6px 0', background: 'transparent', border: `1px dashed ${isDarkMode ? '#444' : '#d9d9d9'}` }}
                        >
                          <p className="ant-upload-drag-icon" style={{ marginBottom: 2 }}>
                            <InboxOutlined style={{ color: '#6366f1', fontSize: 22 }} />
                          </p>
                          <p className="ant-upload-text" style={{ fontSize: 12, marginBottom: 0 }}>
                            Click or drag files
                          </p>
                          <p className="ant-upload-hint" style={{ fontSize: 11 }}>
                            max {MAX_FILE_SIZE_MB}MB
                          </p>
                        </Dragger>
                      </Card>
                    ))}
                  </div>
                </Form.Item>
              </Col>
            </Row>
        </>
      ),
    },
    {
      key: 'fabric',
      label: (
        <Space>
          <Text strong style={{ fontSize: 15, color: 'var(--info-color)' }}>
            Section B — Fabric Cost Breakup
          </Text>
          <Tag color="blue">{formatCurrency(totalFabricCost, currency)}</Tag>
        </Space>
      ),
      style: sectionHeaderStyle('var(--info-color)'),
      children: (
        <>
          {costingType === 'CMT' && (
            <Alert type="info" showIcon message="CMT Mode: Fabric cost is excluded from the total price — fabric is supplied by buyer." style={{ marginBottom: 12 }} />
          )}
          <Table
            dataSource={fabricRows}
            columns={fabricColumns}
            pagination={false}
            size="small"
            rowKey="key"
            scroll={{ x: 1540 }}
            locale={{ emptyText: 'No fabrics added. Click + Add Fabric to begin.' }}
            summary={() =>
              fabricRows.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row style={summaryRowStyle}>
                    <Table.Summary.Cell index={0} colSpan={10}>
                      <Text strong>Total Fabric Cost</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={10}>
                      <Text strong style={{ color: 'var(--primary-color)', fontSize: 14 }}>
                        {formatCurrency(totalFabricCost, currency)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={11} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null
            }
          />
          <SectionAddButton
            text="Add Fabric"
            color="var(--info-color)"
            onClick={addFabricRow}
            style={{ marginTop: 12 }}
          />
          <Input.TextArea
            value={fabricNotes}
            onChange={(e) => { setFabricNotes(e.target.value); setIsDirty(true); }}
            placeholder="Fabric section notes / remarks..."
            maxLength={1000}
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{ marginTop: 12 }}
          />
        </>
      ),
    },
    {
      key: 'trims',
      label: (
        <Space>
          <Text strong style={{ fontSize: 15, color: '#8b5cf6' }}>
            Section C — Trims / Accessories Cost Breakup
          </Text>
          <Tag color="purple">{formatCurrency(totalAccessoriesCost, currency)}</Tag>
        </Space>
      ),
      style: sectionHeaderStyle('#8b5cf6'),
      children: (
        <>
          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
            C.1 — Local Accessories
          </Text>
          <Table
            dataSource={localTrims}
            columns={localTrimColumns}
            pagination={false}
            size="small"
            rowKey="key"
            scroll={{ x: 960 }}
            locale={{ emptyText: 'No local accessories added.' }}
            summary={() =>
              localTrims.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row style={summaryRowStyle}>
                    <Table.Summary.Cell index={0} colSpan={7}>
                      <Text strong>Local Accessories Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7}>
                      <Text strong>{formatCurrency(totalLocalTrimsCost, currency)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null
            }
          />
          <SectionAddButton
            text="Add Local Item"
            color="#8b5cf6"
            onClick={addLocalTrim}
            style={{ marginTop: 8 }}
          />

          <Divider style={{ margin: '16px 0' }} />

          <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
            C.2 — Imported Accessories
          </Text>
          <Table
            dataSource={importedTrims}
            columns={importedTrimColumns}
            pagination={false}
            size="small"
            rowKey="key"
            scroll={{ x: 960 }}
            locale={{ emptyText: 'No imported accessories added.' }}
            summary={() =>
              importedTrims.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row style={summaryRowStyle}>
                    <Table.Summary.Cell index={0} colSpan={7}>
                      <Text strong>Imported Accessories Total (USD)</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={7}>
                      <Text strong>{formatCurrency(totalImportedTrimsCostUsd, 'USD')}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null
            }
          />
          <SectionAddButton
            text="Add Imported Item"
            color="#8b5cf6"
            onClick={addImportedTrim}
            style={{ marginTop: 8 }}
          />

          <Card
            size="small"
            style={{ marginTop: 16, background: isDarkMode ? 'rgba(139, 92, 246, 0.08)' : 'rgba(139, 92, 246, 0.04)' }}
          >
            <Text strong style={{ fontSize: 14 }}>
              Total Accessories Cost: {formatCurrency(totalAccessoriesCost, currency)}
            </Text>
            <Text type="secondary" style={{ marginLeft: 16, fontSize: 12 }}>
              (Local: {formatCurrency(totalLocalTrimsCost, currency)} + Imported: {formatCurrency(totalImportedTrimsCostUsd, 'USD')} × {usdToCostingRate} rate)
            </Text>
          </Card>
          <Input.TextArea
            value={trimsNotes}
            onChange={(e) => { setTrimsNotes(e.target.value); setIsDirty(true); }}
            placeholder="Trims section notes / remarks..."
            maxLength={1000}
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{ marginTop: 12 }}
          />
        </>
      ),
    },
    {
      key: 'manufacturing',
      label: (
        <Space>
          <Text strong style={{ fontSize: 15, color: '#f59e0b' }}>
            Section D — Manufacturing Cost
          </Text>
          <Tag color="orange">{formatCurrency(totalManufacturingCost, currency)}</Tag>
        </Space>
      ),
      style: sectionHeaderStyle('#f59e0b'),
      children: (
        <>
          <Table
            dataSource={manufacturingRows}
            columns={manufacturingColumns}
            pagination={false}
            size="small"
            rowKey="key"
            scroll={{ x: 760 }}
            locale={{ emptyText: 'No manufacturing costs added.' }}
            summary={() =>
              manufacturingRows.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row style={summaryRowStyle}>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <Text strong>Total Manufacturing Cost</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <Text strong style={{ color: 'var(--primary-color)', fontSize: 14 }}>
                        {formatCurrency(totalManufacturingCost, currency)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} colSpan={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null
            }
          />
          <SectionAddButton
            text="Add Process"
            color="#f59e0b"
            onClick={addManufacturingRow}
            style={{ marginTop: 12 }}
          />
          <Input.TextArea
            value={manufacturingNotes}
            onChange={(e) => { setManufacturingNotes(e.target.value); setIsDirty(true); }}
            placeholder="Manufacturing section notes / remarks..."
            maxLength={1000}
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{ marginTop: 12 }}
          />
        </>
      ),
    },
    {
      key: 'overhead',
      label: (
        <Space>
          <Text strong style={{ fontSize: 15, color: '#ef4444' }}>
            Section E — Overhead / Markup Costs
          </Text>
          <Tag color="red">{formatCurrency(totalMarkupCost, currency)}</Tag>
        </Space>
      ),
      style: sectionHeaderStyle('#ef4444'),
      children: (
        <>
          <Table
            dataSource={overheadRows}
            columns={overheadColumns}
            pagination={false}
            size="small"
            rowKey="key"
            scroll={{ x: 760 }}
            locale={{ emptyText: 'No overhead costs added.' }}
            summary={() =>
              overheadRows.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row style={summaryRowStyle}>
                    <Table.Summary.Cell index={0} colSpan={3}>
                      <Text strong>Total Markup Cost</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3}>
                      <Text strong style={{ color: 'var(--primary-color)', fontSize: 14 }}>
                        {formatCurrency(totalMarkupCost, currency)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={4} colSpan={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null
            }
          />
          <SectionAddButton
            text="Add Overhead"
            color="#ef4444"
            onClick={addOverheadRow}
            style={{ marginTop: 12 }}
          />
          <Input.TextArea
            value={overheadNotes}
            onChange={(e) => { setOverheadNotes(e.target.value); setIsDirty(true); }}
            placeholder="Overhead section notes / remarks..."
            maxLength={1000}
            autoSize={{ minRows: 1, maxRows: 3 }}
            style={{ marginTop: 12 }}
          />
        </>
      ),
    },
    {
      key: 'summary',
      label: (
        <Text strong style={{ fontSize: 15, color: '#10b981' }}>
          Section F — Cost Summary
        </Text>
      ),
      style: sectionHeaderStyle('#10b981'),
      children: (
        <Card
          style={{
            background: isDarkMode
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(99, 102, 241, 0.03) 100%)',
            border: `1px solid ${isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)'}`,
          }}
        >
          <Row gutter={[24, 16]}>
            <Col xs={12} md={6}>
              <Statistic
                title="Fabric Cost"
                value={totalFabricCost}
                precision={2}
                prefix={getCurrencySymbol(currency)}
                valueStyle={{ fontSize: 16, color: 'var(--info-color)' }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="Trims / Accessories"
                value={totalAccessoriesCost}
                precision={2}
                prefix={getCurrencySymbol(currency)}
                valueStyle={{ fontSize: 16, color: '#8b5cf6' }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="Manufacturing Cost"
                value={totalManufacturingCost}
                precision={2}
                prefix={getCurrencySymbol(currency)}
                valueStyle={{ fontSize: 16, color: '#f59e0b' }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="Markup / Overhead"
                value={totalMarkupCost}
                precision={2}
                prefix={getCurrencySymbol(currency)}
                valueStyle={{ fontSize: 16, color: '#ef4444' }}
              />
            </Col>
          </Row>

          {/* Cost % Breakdown Bar */}
          {totalMakingPrice > 0 && (
            <div style={{ margin: '16px 0 8px' }}>
              <Text type="secondary" style={{ fontSize: 12, marginBottom: 6, display: 'block' }}>Cost Composition</Text>
              <div style={{ display: 'flex', height: 22, borderRadius: 6, overflow: 'hidden', fontSize: 11, fontWeight: 600, color: '#fff' }}>
                {[
                  { val: costingType === 'CMT' ? 0 : totalFabricCost, color: '#3b82f6', label: 'Fabric' },
                  { val: totalAccessoriesCost, color: '#8b5cf6', label: 'Trims' },
                  { val: totalManufacturingCost, color: '#f59e0b', label: 'Mfg' },
                  { val: totalMarkupCost, color: '#ef4444', label: 'Overhead' },
                ].filter((s) => s.val > 0).map((s) => {
                  const pct = ((s.val / totalMakingPrice) * 100).toFixed(1);
                  return (
                    <Tooltip key={s.label} title={`${s.label}: ${formatCurrency(s.val, currency)} (${pct}%)`}>
                      <div style={{ width: `${pct}%`, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: pct > 8 ? undefined : 0, transition: 'width 0.3s' }}>
                        {parseFloat(pct) > 12 ? `${s.label} ${pct}%` : parseFloat(pct) > 6 ? `${pct}%` : ''}
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          )}

          <Divider style={{ margin: '16px 0' }} />

          <Row gutter={[24, 16]} align="middle">
            <Col xs={12} md={6}>
              <Statistic
                title="Total Making Price"
                value={totalMakingPrice}
                precision={2}
                prefix={getCurrencySymbol(currency)}
                valueStyle={{ fontSize: 18, fontWeight: 700 }}
              />
            </Col>
            <Col xs={12} md={4}>
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Agent Commission %</Text>
              </div>
              <InputNumber
                value={agentCommissionPct}
                min={0}
                max={100}
                step={0.5}
                onChange={(v) => { setAgentCommissionPct(v); setIsDirty(true); }}
                style={{ width: '100%' }}
                addonAfter="%"
                {...numericInputProps}
              />
            </Col>
            <Col xs={12} md={4}>
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Profit %</Text>
              </div>
              <InputNumber
                value={profitPct}
                min={0}
                max={100}
                step={0.5}
                onChange={(v) => { setProfitPct(v); setTargetPrice(''); setIsDirty(true); }}
                style={{ width: '100%' }}
                addonAfter="%"
                {...numericInputProps}
              />
            </Col>
            <Col xs={12} md={4}>
              <div style={{ marginBottom: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Target Price ({getCurrencySymbol(currency)})</Text>
              </div>
              <InputNumber
                value={targetPrice}
                min={0}
                step={0.01}
                placeholder="Auto-calc profit"
                onChange={(v) => { setTargetPrice(v); setIsDirty(true); }}
                style={{ width: '100%' }}
                {...numericInputProps}
              />
            </Col>
            <Col xs={12} md={6}>
              <Statistic
                title="Overhead Charges"
                value={totalOverheadCharges}
                precision={2}
                prefix={getCurrencySymbol(currency)}
                valueStyle={{ fontSize: 16, color: '#64748b' }}
              />
            </Col>
          </Row>

          <Divider style={{ margin: '16px 0' }} />

          <Row gutter={[16, 16]} align="middle">
            <Col xs={12} md={6}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#6366f1' }}>
                <Text style={{ color: '#6366f1', fontSize: 12, display: 'block' }}>
                  Total Price ({currency})
                </Text>
                <Text style={{ color: '#6366f1', fontSize: 24, fontWeight: 800, display: 'block' }}>
                  {getCurrencySymbol(currency)} {totalPrice.toFixed(2)}
                </Text>
              </Card>
            </Col>
            {quoteCurrency !== currency && quoteCurrency !== 'USD' && (
              <Col xs={12} md={6}>
                <Card size="small" style={{ textAlign: 'center', borderColor: '#10b981' }}>
                  <Text style={{ color: '#10b981', fontSize: 12, display: 'block' }}>
                    Final Price ({quoteCurrency})
                  </Text>
                  <Text style={{ color: '#10b981', fontSize: 24, fontWeight: 800, display: 'block' }}>
                    {getCurrencySymbol(quoteCurrency)} {finalPrice.toFixed(2)}
                  </Text>
                </Card>
              </Col>
            )}
            <Col xs={12} md={quoteCurrency !== currency && quoteCurrency !== 'USD' ? 6 : 9}>
              <Card size="small" style={{ textAlign: 'center', borderColor: '#3b82f6' }}>
                <Text style={{ color: '#3b82f6', fontSize: 12, display: 'block' }}>
                  Final Price (USD)
                </Text>
                <Text style={{ color: '#3b82f6', fontSize: 24, fontWeight: 800, display: 'block' }}>
                  $ {finalPriceUsd.toFixed(2)}
                </Text>
              </Card>
            </Col>
          </Row>

          {/* Per-Dozen / Per-Piece conversion */}
          {pricingUnit === 'DOZEN' && totalPrice > 0 && (
            <div style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, background: isDarkMode ? 'rgba(99, 102, 241, 0.06)' : 'rgba(99, 102, 241, 0.03)', border: '1px dashed var(--border-color)' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Per-Piece Equivalent: </Text>
              <Text strong style={{ fontSize: 14 }}>{getCurrencySymbol(currency)} {(totalPrice / 12).toFixed(2)}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}> | </Text>
              <Text strong style={{ fontSize: 14, color: '#3b82f6' }}>$ {(finalPriceUsd / 12).toFixed(2)}</Text>
              <Text type="secondary" style={{ fontSize: 12 }}> per piece (÷12)</Text>
            </div>
          )}

          {/* Per-Size Breakdown */}
          {perSizeSummaries.length > 0 && (
            <>
              <Divider style={{ margin: '16px 0' }} />
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 15, marginRight: 16 }}>Per-Size Breakdown</Text>
                <Checkbox
                  checked={syncPercentages}
                  onChange={(e) => { setSyncPercentages(e.target.checked); setIsDirty(true); }}
                >
                  Apply same % to all sizes
                </Checkbox>
              </div>
              <Row gutter={[16, 16]}>
                {perSizeSummaries.map((ps) => (
                  <Col xs={24} sm={12} md={Math.max(6, Math.floor(24 / perSizeSummaries.length))} key={ps.sizeKey}>
                    <Card
                      size="small"
                      title={<Tag color="blue">{ps.sizeKey}</Tag>}
                      style={{ borderColor: '#10b981' }}
                    >
                      <div style={{ fontSize: 12, lineHeight: '22px' }}>
                        <div>Fabric: {formatCurrency(ps.fabCost, currency)}</div>
                        <div>Accessories: {formatCurrency(ps.accCost, currency)}</div>
                        <div>Manufacturing: {formatCurrency(ps.mfgCost, currency)}</div>
                        <div>Markup: {formatCurrency(ps.ovhCost, currency)}</div>
                        <Divider style={{ margin: '6px 0' }} />
                        <div><Text strong>Making: {formatCurrency(ps.makingPrice, currency)}</Text></div>
                      </div>
                      {!syncPercentages && (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ marginBottom: 4 }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Agent %</Text>
                            <InputNumber
                              value={perSizeOverrides[ps.sizeKey]?.agentCommissionPct ?? agentCommissionPct}
                              min={0} max={100} step={0.5} size="small"
                              style={{ width: '100%' }}
                              onChange={(v) => { setPerSizeOverrides((prev) => ({
                                ...prev,
                                [ps.sizeKey]: { ...prev[ps.sizeKey], agentCommissionPct: v },
                              })); setIsDirty(true); }}
                              {...numericInputProps}
                            />
                          </div>
                          <div style={{ marginBottom: 4 }}>
                            <Text type="secondary" style={{ fontSize: 11 }}>Profit %</Text>
                            <InputNumber
                              value={perSizeOverrides[ps.sizeKey]?.profitPct ?? profitPct}
                              min={0} max={100} step={0.5} size="small"
                              style={{ width: '100%' }}
                              onChange={(v) => { setPerSizeOverrides((prev) => ({
                                ...prev,
                                [ps.sizeKey]: { ...prev[ps.sizeKey], profitPct: v },
                              })); setIsDirty(true); }}
                              {...numericInputProps}
                            />
                          </div>
                          <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>Target Price</Text>
                            <InputNumber
                              value={perSizeOverrides[ps.sizeKey]?.targetPrice ?? ''}
                              min={0} step={0.01} size="small"
                              style={{ width: '100%' }}
                              placeholder="Target"
                              onChange={(v) => { setPerSizeOverrides((prev) => ({
                                ...prev,
                                [ps.sizeKey]: { ...prev[ps.sizeKey], targetPrice: v },
                              })); setIsDirty(true); }}
                              {...numericInputProps}
                            />
                          </div>
                        </div>
                      )}
                      <Divider style={{ margin: '6px 0' }} />
                      <div style={{ textAlign: 'center' }}>
                        <Text style={{ color: '#3b82f6', fontSize: 18, fontWeight: 700 }}>
                          $ {ps.finalPriceUsd.toFixed(2)}
                        </Text>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {getCurrencySymbol(currency)} {ps.totalPrice.toFixed(2)}
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </>
          )}
        </Card>
      ),
    },
  ];

  // Skeleton loading state for edit mode
  if (loading && isEdit) {
    return (
      <div className="animate-fade-in-up">
        <div className="page-header">
          <Space>
            <Skeleton.Button active size="small" style={{ width: 32, height: 32 }} />
            <Skeleton.Input active style={{ width: 180 }} />
          </Space>
          <Space>
            <Skeleton.Button active style={{ width: 140 }} />
          </Space>
        </div>
        {/* General Details skeleton */}
        <Card style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 200, marginBottom: 16 }} />
          <Row gutter={[16, 16]}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Col xs={12} md={8} key={i}>
                <Skeleton.Input active size="small" style={{ width: 70, marginBottom: 8 }} block={false} />
                <Skeleton.Input active block />
              </Col>
            ))}
          </Row>
        </Card>
        {/* Fabric section skeleton */}
        <Card style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 160, marginBottom: 16 }} />
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
        {/* Trims section skeleton */}
        <Card style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 140, marginBottom: 16 }} />
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
        {/* Manufacturing & overhead skeleton */}
        <Card style={{ marginBottom: 16 }}>
          <Skeleton.Input active style={{ width: 180, marginBottom: 16 }} />
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
        {/* Summary skeleton */}
        <Card style={{ marginBottom: 80 }}>
          <Skeleton.Input active style={{ width: 120, marginBottom: 16 }} />
          <Row gutter={[16, 16]}>
            {[1, 2, 3, 4].map((i) => (
              <Col xs={12} md={6} key={i}>
                <Skeleton.Input active size="small" style={{ width: 80, marginBottom: 8 }} block={false} />
                <Skeleton.Input active block />
              </Col>
            ))}
          </Row>
        </Card>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title={isEdit ? 'Edit Cost Sheet' : 'Create Cost Sheet'}
        backPath="/costing/list"
        subtitle={isEdit && savedDate ? savedDate.format('DD-MMM-YYYY') : undefined}
        status={
          isEdit && costingId ? (
            <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>
              {costingId}
            </Tag>
          ) : undefined
        }
        style={{ position: 'sticky', top: 64, zIndex: 10 }}
      >
        <Space>
          {styleId && (
            <ActionButton
              action="upload"
              text="Import from BOM"
              onClick={() => setBomImportOpen(true)}
            />
          )}
          <ActionButton
            action="upload"
            text="Import from Techpack"
            onClick={() => setTechpackModalOpen(true)}
          />
          <Button onClick={() => { setTemplateModalMode('load'); setTemplateModalOpen(true); }}>Load Template</Button>
          <Button onClick={() => { setTemplateModalMode('save'); setTemplateModalOpen(true); }}>Save as Template</Button>
          <ActionButton
            action="save"
            variant="draft"
            text="Save as Draft"
            onClick={handleSaveDraft}
            loading={savingDraft}
            disabled={submitting}
          />
          <ActionButton
            action="save"
            text="Submit"
            onClick={handleSubmit}
            loading={submitting}
            disabled={savingDraft}
          />
        </Space>
      </PageHeader>

      {isEdit && loadedStatus === COSTING_STATUS.FINAL && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Revising a submitted cost sheet"
          description="This cost sheet is pending approval. Saving your changes will revert it to Draft and cancel the current approval request — you will need to submit it again."
        />
      )}

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          currency: 'INR',
          quoteCurrency: 'USD',
        }}
        onValuesChange={() => setIsDirty(true)}
      >
        <Collapse
          defaultActiveKey={['general', 'fabric', 'trims', 'manufacturing', 'overhead', 'summary']}
          items={collapseItems}
        />
      </Form>

      {/* Knits Consumption Modal */}
      <KnitsConsumptionModal
        open={knitsModalOpen}
        onApply={handleKnitsApply}
        onCancel={() => setKnitsModalOpen(false)}
        initialParts={knitsParts}
        targetUom={knitsTargetUom}
      />

      {/* Techpack AI Import Modal */}
      <TechpackImportModal
        open={techpackModalOpen}
        onClose={() => setTechpackModalOpen(false)}
        onApply={handleTechpackApply}
      />

      {/* AI Consumption Calculator Modal */}
      <ConsumptionCalcModal
        open={consumptionModalOpen}
        onClose={() => setConsumptionModalOpen(false)}
        onApply={handleConsumptionApply}
        onOpenKnitsCalc={handleOpenKnitsCalcFromAI}
        fabricRow={consumptionFabricRow}
      />

      {/* Woven Consumption Calculator Modal */}
      <WovenConsumptionModal
        open={wovenModalOpen}
        onCancel={() => setWovenModalOpen(false)}
        onApply={(consumption) => {
          if (wovenRowKey) {
            // This calculator always works in METRES. If the row is consumed in some other
            // unit the figure is not comparable, so flag it rather than applying silently.
            const row = fabricRows.find((r) => r.key === wovenRowKey);
            const rowUom = row ? getConsumptionUom(row, fabricItemsRaw) : '';
            if (rowUom && !['m', 'mtr', 'mtrs', 'meter', 'meters', 'metre', 'metres']
              .includes(normaliseUomSymbol(rowUom))) {
              message.warning(
                `Calculated in METRES but this fabric is consumed in ${rowUom.toUpperCase()}. ` +
                'Check the value — it was applied as-is.',
              );
            }
            updateFabricRow(wovenRowKey, 'consumption', consumption);
          }
          setWovenModalOpen(false);
        }}
      />

      {/* BOM Import Modal */}
      <BomImportModal
        open={bomImportOpen}
        onClose={() => setBomImportOpen(false)}
        styleId={styleId}
        onApply={({ fabricRows: fr, localTrims: lt, importedTrims: it }) => {
          if (fr?.length) setFabricRows((prev) => [...prev, ...fr]);
          if (lt?.length) setLocalTrims((prev) => [...prev, ...lt]);
          if (it?.length) setImportedTrims((prev) => [...prev, ...it]);
          setIsDirty(true);
          message.success('BOM data imported successfully');
        }}
      />

      {/* PDF Preview Modal */}
      <CostingPdfPreviewModal
        open={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        costSheetData={pdfPreviewData}
      />

      {/* Costing Template Modal */}
      <CostingTemplateModal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        mode={templateModalMode}
        currentData={{
          fabricRows,
          localTrims,
          importedTrims,
          manufacturingRows,
          overheadRows,
        }}
        onApply={(templateData) => {
          if (templateData.fabricRows?.length) setFabricRows(templateData.fabricRows.map((r, i) => ({ ...r, key: `tf_${Date.now()}_${i}` })));
          if (templateData.localTrims?.length) setLocalTrims(templateData.localTrims.map((r, i) => ({ ...r, key: `tlt_${Date.now()}_${i}` })));
          if (templateData.importedTrims?.length) setImportedTrims(templateData.importedTrims.map((r, i) => ({ ...r, key: `tit_${Date.now()}_${i}` })));
          if (templateData.manufacturingRows?.length) setManufacturingRows(templateData.manufacturingRows.map((r, i) => ({ ...r, key: `tm_${Date.now()}_${i}` })));
          if (templateData.overheadRows?.length) setOverheadRows(templateData.overheadRows.map((r, i) => ({ ...r, key: `to_${Date.now()}_${i}` })));
          setIsDirty(true);
        }}
      />

      {/* Buyer Price Trend Modal */}
      <BuyerPriceTrendModal
        open={priceTrendOpen}
        onClose={() => setPriceTrendOpen(false)}
        buyerId={form.getFieldValue('buyerId')}
        buyerName={buyerOptions.find((b) => b.value === form.getFieldValue('buyerId'))?.label}
      />

      {/* Quick Add Process Modal */}
      <Modal
        title="Add New Process"
        open={quickAddProcessOpen}
        onCancel={() => { setQuickAddProcessOpen(false); quickAddProcessForm.resetFields(); }}
        onOk={() => quickAddProcessForm.submit()}
        confirmLoading={quickAddProcessLoading}
        okText="Create"
        centered
        destroyOnHidden
        width={420}
      >
        <Form form={quickAddProcessForm} layout="vertical" onFinish={async (values) => {
          setQuickAddProcessLoading(true);
          try {
            const created = await createProcess({ ...values, isActive: true });
            setManufacturingProcesses((prev) => [...prev, { value: created.id, label: created.processName, defaultCost: created.defaultCost || 0 }]);
            if (pendingMfgRowKey) {
              updateManufacturingRow(pendingMfgRowKey, {
                processId: created.id,
                process: created.processName,
                ...(values.defaultCost > 0 ? { cost: values.defaultCost } : {}),
              });
            }
            message.success(`Process "${created.processName}" created`);
            setQuickAddProcessOpen(false);
            quickAddProcessForm.resetFields();
          } catch {
            message.error('Failed to create process');
          } finally {
            setQuickAddProcessLoading(false);
          }
        }}>
          <Form.Item name="processName" label="Process Name" rules={[{ required: true, message: 'Please enter a process name' }]}>
            <Input placeholder="e.g. Cutting, Sewing, Washing" maxLength={200} />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Please select a category' }]} initialValue="Manufacturing">
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select category"
              options={categoryOptions}
            />
          </Form.Item>
          <Form.Item name="defaultCost" label="Default Cost">
            <InputNumber min={0} precision={2} controls={false} prefix="₹" placeholder="e.g. 25.50" style={{ width: '100%' }} {...numericInputProps} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Quick Add Overhead Modal */}
      <Modal
        title="Add New Overhead"
        open={quickAddOverheadOpen}
        onCancel={() => { setQuickAddOverheadOpen(false); quickAddOverheadForm.resetFields(); }}
        onOk={() => quickAddOverheadForm.submit()}
        confirmLoading={quickAddOverheadLoading}
        okText="Create"
        centered
        destroyOnHidden
        width={420}
      >
        <Form form={quickAddOverheadForm} layout="vertical" onFinish={async (values) => {
          setQuickAddOverheadLoading(true);
          try {
            // Creates an OVERHEAD, not a process — cost sheet overhead rows are a FK
            // to mst_overheads and the server resolves their description from it.
            const created = await createOverhead({ overheadName: values.overheadName, defaultCost: values.defaultCost, isActive: true });
            setOverheadItems((prev) => [...prev, { value: created.id, label: created.overheadName, defaultCost: created.defaultCost || 0 }]);
            if (pendingOvhRowKey) {
              updateOverheadRow(pendingOvhRowKey, {
                overheadId: created.id,
                description: created.overheadName,
                ...(values.defaultCost > 0 ? { cost: values.defaultCost } : {}),
              });
            }
            message.success(`Overhead "${created.overheadName}" created`);
            setQuickAddOverheadOpen(false);
            quickAddOverheadForm.resetFields();
          } catch {
            message.error('Failed to create overhead');
          } finally {
            setQuickAddOverheadLoading(false);
          }
        }}>
          <Form.Item name="overheadName" label="Overhead Name" rules={[{ required: true, message: 'Please enter an overhead name' }]}>
            <Input placeholder="e.g. Testing Fees, Freight, Commission" maxLength={200} />
          </Form.Item>
          <Form.Item name="defaultCost" label="Default Cost">
            <InputNumber min={0} precision={2} controls={false} prefix="₹" placeholder="e.g. 15.00" style={{ width: '100%' }} {...numericInputProps} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Quick Add Style Modal */}
      <Modal
        title="Add New Style"
        open={quickAddStyleOpen}
        onCancel={() => {
          setQuickAddStyleOpen(false);
          quickAddStyleForm.resetFields();
          if (quickAddStyleImageUrl) URL.revokeObjectURL(quickAddStyleImageUrl);
          setQuickAddStyleImage(null);
          setQuickAddStyleImageUrl(null);
        }}
        onOk={() => quickAddStyleForm.submit()}
        confirmLoading={quickAddStyleLoading}
        okText="Create"
        centered
        destroyOnHidden
        width={520}
        afterClose={() => {
          quickAddStyleForm.resetFields();
          if (quickAddStyleImageUrl) URL.revokeObjectURL(quickAddStyleImageUrl);
          setQuickAddStyleImage(null);
          setQuickAddStyleImageUrl(null);
        }}
      >
        <Form form={quickAddStyleForm} layout="vertical" onFinish={async (values) => {
          setQuickAddStyleLoading(true);
          try {
            const created = await saveStyle({ ...values, isActive: true });
            // Upload staged image if any
            if (quickAddStyleImage && created?.id) {
              try {
                await uploadFile(quickAddStyleImage, {
                  module: 'STYLE',
                  entity: 'STYLE',
                  entityId: created.id,
                  fileCategory: 'IMAGE',
                });
              } catch {
                message.warning('Style created, but image upload failed. You can re-upload from Style Master.');
              }
            }
            // Add to dropdown options
            setStyleOptions((prev) => [...prev, { value: created.id, label: created.styleNo, style: created }]);
            // Auto-select the new style
            form.setFieldsValue({
              styleNo: created.id,
              garmentName: created.garmentName || '',
              seasonCode: created.seasonCode || undefined,
              seasonYear: created.seasonYear || undefined,
            });
            setStyleId(created.id);
            // Load the style image into the Section A placeholder
            loadStyleImage(created.id);
            message.success(`Style "${created.styleNo}" created`);
            setQuickAddStyleOpen(false);
            quickAddStyleForm.resetFields();
            if (quickAddStyleImageUrl) URL.revokeObjectURL(quickAddStyleImageUrl);
            setQuickAddStyleImage(null);
            setQuickAddStyleImageUrl(null);
            setIsDirty(true);
          } catch {
            message.error('Failed to create style');
          } finally {
            setQuickAddStyleLoading(false);
          }
        }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="styleNo" label="Style No" rules={[{ required: true, message: 'Please enter Style No' }]}>
                <Input placeholder="e.g. STY-001" maxLength={50} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="garmentName" label="Garment Name" rules={[{ required: true, message: 'Please enter Garment Name' }]}>
                <Input placeholder="e.g. Polo T-Shirt" maxLength={150} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="buyerId" label="Buyer" rules={[{ required: true, message: 'Buyer is required' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="Select buyer"
                  options={buyerOptions}
                  disabled
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="seasonCode" label="Season">
                <Select placeholder="Season" allowClear options={SEASON_CODES} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="seasonYear" label="Year">
                <Select placeholder="Year" allowClear options={SEASON_YEARS} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Fabric Description">
            <Input.TextArea rows={2} placeholder="Fabric description (optional)" maxLength={500} />
          </Form.Item>
          <div style={{
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border-color, #e5e7eb)',
            background: 'var(--bg-secondary, #f8fafc)',
          }}>
            <Typography.Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Style Image
            </Typography.Text>
            <FileUpload
              accept="image/png,image/jpeg,image/jpg"
              maxSizeMB={10}
              previewUrl={quickAddStyleImageUrl}
              fileName={quickAddStyleImage?.name || null}
              fileType={quickAddStyleImage?.type || null}
              fileSize={quickAddStyleImage?.size || null}
              onSelect={(file) => {
                if (quickAddStyleImageUrl) URL.revokeObjectURL(quickAddStyleImageUrl);
                setQuickAddStyleImage(file);
                setQuickAddStyleImageUrl(URL.createObjectURL(file));
              }}
              onRemove={() => {
                if (quickAddStyleImageUrl) URL.revokeObjectURL(quickAddStyleImageUrl);
                setQuickAddStyleImage(null);
                setQuickAddStyleImageUrl(null);
              }}
              compact
              placeholder="Click or drag to upload style image"
              hint="PNG, JPG up to 10 MB"
              infoMessage="The image will be uploaded automatically when the style is created."
            />
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default CostingForm;
