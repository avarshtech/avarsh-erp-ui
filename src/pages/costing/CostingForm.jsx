import { useState, useEffect, useMemo, useRef } from 'react';
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
} from '../../services/costingService';
import {
  COSTING_STATUS,
  FABRIC_CLASSIFICATIONS,
  CURRENCIES,
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
import { getCurrencySymbol } from '../../utils/orderConstants';
import { getBuyers } from '../../services/buyerService';
import { getStylesByBuyerId, saveStyle } from '../../services/styleService';
import { uploadFile } from '../../services/fileService';
import { getFilesByEntity, downloadFileAsBlob } from '../../services/fileService';
import { searchItems } from '../../services/itemService';
import { getAllCategories } from '../../services/masterDataService';
import { getActiveProcesses, createProcess } from '../../services/processService';
import { getActiveOverheads, createOverhead } from '../../services/overheadService';
import { hasPermission } from '../../utils/permissions';
import { useTheme } from '../../context/ThemeContext';
import { generateCostingPdf } from '../../utils/costingPdfGenerator';
import KnitsConsumptionModal from './KnitsConsumptionModal';
import FileUpload from '../../components/FileUpload';
import TechpackImportModal from './TechpackImportModal';
import ConsumptionCalcModal from './ConsumptionCalcModal';

const { Text } = Typography;
const { Dragger } = Upload;

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

  // Style image (view-only)
  const [styleImageUrl, setStyleImageUrl] = useState(null);
  const [styleImageLoading, setStyleImageLoading] = useState(false);
  const imageLoadIdRef = useRef(0);

  // Season code → label map
  const seasonLabelMap = useMemo(
    () => Object.fromEntries(SEASON_CODES.map((s) => [s.value, s.label])),
    [],
  );

  // API-fetched dropdown options
  const [buyerOptions, setBuyerOptions] = useState([]);
  const [styleOptions, setStyleOptions] = useState([]);
  const [fabricItemOptions, setFabricItemOptions] = useState([]);
  const [fabricItemsRaw, setFabricItemsRaw] = useState([]);
  const [localTrimItemsRaw, setLocalTrimItemsRaw] = useState([]);
  const [importedTrimItemsRaw, setImportedTrimItemsRaw] = useState([]);
  const [localTrimOptions, setLocalTrimOptions] = useState([]);
  const [importedTrimOptions, setImportedTrimOptions] = useState([]);
  const [manufacturingProcesses, setManufacturingProcesses] = useState([]);
  const [overheadItems, setOverheadItems] = useState([]);
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

  // Techpack import modal
  const [techpackModalOpen, setTechpackModalOpen] = useState(false);

  // AI consumption calculator modal
  const [consumptionModalOpen, setConsumptionModalOpen] = useState(false);
  const [consumptionRowKey, setConsumptionRowKey]       = useState(null);
  const [consumptionFabricRow, setConsumptionFabricRow] = useState(null);

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
        // Collect all unique category IDs and fetch items in a single API call
        const catMap = {};
        if (fabricCat) catMap.fabric = fabricCat.id;
        if (effectiveLocalTrimCat) catMap.localTrim = effectiveLocalTrimCat.id;
        if (effectiveImportedTrimCat) catMap.importedTrim = effectiveImportedTrimCat.id;

        const uniqueCatIds = [...new Set(Object.values(catMap))];

        if (uniqueCatIds.length > 0) {
          const res = await searchItems({ categoryIds: uniqueCatIds, size: 1000 });
          const allItems = res.data?.content || res.data || [];

          // Group items by categoryId
          const byCat = {};
          for (const item of allItems) {
            const cid = item.categoryId;
            if (!byCat[cid]) byCat[cid] = [];
            byCat[cid].push(item);
          }

          const toOptions = (items) => (items || []).map((item) => ({ value: item.id, label: item.itemName, itemCode: item.itemCode }));

          if (catMap.fabric) {
            const fabItems = byCat[catMap.fabric] || [];
            setFabricItemsRaw(fabItems);
            setFabricItemOptions(toOptions(fabItems));
          }
          if (catMap.localTrim) {
            const ltItems = byCat[catMap.localTrim] || [];
            setLocalTrimItemsRaw(ltItems);
            setLocalTrimOptions(toOptions(ltItems));
          }
          if (catMap.importedTrim) {
            const itItems = byCat[catMap.importedTrim] || [];
            setImportedTrimItemsRaw(itItems);
            setImportedTrimOptions(toOptions(itItems));
          }
        }

        // Fetch processes (Manufacturing) and overheads from their dedicated masters
        const [mfgResult, ovhResult] = await Promise.allSettled([
          getActiveProcesses('Manufacturing'),
          getActiveOverheads(),
        ]);
        if (mfgResult.status === 'fulfilled') {
          const procs = Array.isArray(mfgResult.value) ? mfgResult.value : mfgResult.value?.data || [];
          setManufacturingProcesses(procs.map((p) => ({ value: p.id, label: p.processName, defaultCost: p.defaultCost || 0 })));
        }
        if (ovhResult.status === 'fulfilled') {
          const ovhs = Array.isArray(ovhResult.value) ? ovhResult.value : ovhResult.value?.data || [];
          setOverheadItems(ovhs.map((o) => ({ value: o.id, label: o.overheadName, defaultCost: o.defaultCost || 0 })));
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
      // Normalise UOM: API returns uomId + uomName; set uom (symbol) for display/conversion
      setFabricRows(withKeys(cs.fabricRows, 'f').map((r) => ({
        ...r,
        uom: r.uom || r.uomSymbol || r.uomName || '',
      })));
      setLocalTrims(withKeys(cs.localTrims, 'lt'));
      setImportedTrims(withKeys(cs.importedTrims, 'it'));
      setManufacturingRows(withKeys(cs.manufacturingRows, 'm'));
      setOverheadRows(withKeys(cs.overheadRows, 'o'));
      setAgentCommissionPct(cs.agentCommissionPct || 0);
      setProfitPct(cs.profitPct || 0);
      setTargetPrice(cs.targetPrice || '');
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

  const totalAccessoriesCost = useMemo(() => {
    return totalLocalTrimsCost + totalImportedTrimsCostUsd * actualRate;
  }, [totalLocalTrimsCost, totalImportedTrimsCostUsd, actualRate]);

  const totalManufacturingCost = useMemo(() => {
    return manufacturingRows.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
  }, [manufacturingRows]);

  const totalMarkupCost = useMemo(() => {
    return overheadRows.reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
  }, [overheadRows]);

  const totalMakingPrice = useMemo(() => {
    return calcTotalMakingPrice(totalFabricCost, totalAccessoriesCost, totalManufacturingCost, totalMarkupCost);
  }, [totalFabricCost, totalAccessoriesCost, totalManufacturingCost, totalMarkupCost]);

  const totalOverheadCharges = useMemo(() => {
    return calcTotalOverheadCharges(agentCommissionPct, profitPct, totalMakingPrice);
  }, [agentCommissionPct, profitPct, totalMakingPrice]);

  const totalPrice = useMemo(() => {
    return totalMakingPrice + totalOverheadCharges;
  }, [totalMakingPrice, totalOverheadCharges]);

  const finalPrice = useMemo(() => {
    return calcFinalPrice(totalPrice, actualRate);
  }, [totalPrice, actualRate]);

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
      const accCost = localCost + importCostUsd * (parseFloat(actualRate) || 1);
      const mfgCost = manufacturingRows.filter((r) => matchesSize(r, sizeKey)).reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
      const ovhCost = overheadRows.filter((r) => matchesSize(r, sizeKey)).reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
      const makingPrice = calcTotalMakingPrice(fabCost, accCost, mfgCost, ovhCost);

      const sizeAgent = syncPercentages ? agentCommissionPct : (perSizeOverrides[sizeKey]?.agentCommissionPct ?? agentCommissionPct);
      const sizeProfit = syncPercentages ? profitPct : (perSizeOverrides[sizeKey]?.profitPct ?? profitPct);
      const sizeTarget = perSizeOverrides[sizeKey]?.targetPrice ?? '';

      const overheadCharges = calcTotalOverheadCharges(sizeAgent, sizeProfit, makingPrice);
      const sizeTotalPrice = makingPrice + overheadCharges;
      const sizeFinalPrice = calcFinalPrice(sizeTotalPrice, actualRate);
      const sizeFinalPriceUsd = quoteCurrency === 'USD' ? sizeFinalPrice : calcFinalPriceUsd(sizeFinalPrice, quoteCurrency, actualRate, usdToInrRate);

      return {
        sizeKey, fabCost, localCost, importCostUsd, accCost, mfgCost, ovhCost,
        makingPrice, agentCommissionPct: sizeAgent, profitPct: sizeProfit,
        targetPrice: sizeTarget, overheadCharges, totalPrice: sizeTotalPrice,
        finalPrice: sizeFinalPrice, finalPriceUsd: sizeFinalPriceUsd,
      };
    });
  }, [uniqueSizeKeys, fabricRows, localTrims, importedTrims, manufacturingRows, overheadRows,
      actualRate, agentCommissionPct, profitPct, syncPercentages, perSizeOverrides, quoteCurrency, usdToInrRate]);

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

  // ==================== TECHPACK IMPORT HANDLER ====================

  const handleTechpackApply = async (result) => {
    // 1. Load buyer styles if buyer matched, then set buyer + style fields
    if (result.matchedBuyerId) {
      form.setFieldValue('buyerId', result.matchedBuyerId);
      try {
        const styles = await import('../../services/styleService').then((m) =>
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
          const rawItem = r.matchedItemId ? fabricItemsRaw.find((item) => item.id === r.matchedItemId) : null;
          return {
            key:              `f_import_${Date.now()}_${i}`,
            itemId:           r.matchedItemId   || null,
            fabricType:       r.matchedItemName || r.extractedName || '',
            classification:   r.classification  || 'Woven',
            description:      r.notes           || '',
            consumption:      '',
            uom:              rawItem?.secondaryUomSymbol || rawItem?.uomSymbol || r.uom || '',
            uomId:            rawItem?.uomId || null,
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
        result.localTrimRows.map((r, i) => ({
          key:         `lt_import_${Date.now()}_${i}`,
          itemId:      r.matchedItemId   || null,
          item:        r.matchedItemName || r.extractedName || '',
          code:        '',
          size:        '',
          consumption: r.quantity || '',
          uom:         r.uom || 'pcs',
          cost:        '',
          price:       0,
          sizes:       '',
        }))
      );
    }

    // 5. Map imported trim rows
    if (result.importedTrimRows?.length) {
      setImportedTrims(
        result.importedTrimRows.map((r, i) => ({
          key:         `it_import_${Date.now()}_${i}`,
          itemId:      r.matchedItemId   || null,
          item:        r.matchedItemName || r.extractedName || '',
          code:        '',
          size:        '',
          consumption: r.quantity || '',
          uom:         r.uom || 'pcs',
          costUsd:     '',
          priceUsd:    0,
          sizes:       '',
        }))
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
        updated.netCost = calcFabricNetCost(updated.consumption, updated.fabricPrice, updated.allowancePct);
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
        fabricType: '',
        classification: 'Woven',
        description: '',
        consumption: '',
        uom: '',
        uomId: null,
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

  const handleFabricItemSelect = (key, itemId, option) => {
    // Set itemId and fabricType from the selected item
    const rawItem = fabricItemsRaw.find((item) => item.id === itemId);
    setFabricRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = {
          ...r,
          itemId,
          fabricType: option.label,
          // Set UOM from item's secondary UOM (fallback to primary)
          uom: rawItem?.secondaryUomSymbol || rawItem?.uomSymbol || r.uom || '',
          uomId: rawItem?.uomId || r.uomId || null,
          primaryUom: rawItem?.uomSymbol || '',
        };
        // Auto-set classification from subcategory
        if (rawItem?.subCategoryName) {
          const subName = rawItem.subCategoryName.toLowerCase();
          if (subName.includes('knit')) updated.classification = 'Knits';
          else if (subName.includes('woven')) updated.classification = 'Woven';
        }
        return updated;
      })
    );
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
        updated.price = calcTrimPrice(updated.consumption, updated.cost);
        return updated;
      })
    );
    setIsDirty(true);
  };

  const addLocalTrim = () => {
    setLocalTrims((prev) => [
      ...prev,
      { key: `lt_${Date.now()}`, itemId: null, item: '', code: '', size: '', consumption: '', uom: '', cost: '', price: 0, sizes: '' },
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
        updated.priceUsd = calcTrimPrice(updated.consumption, updated.costUsd);
        return updated;
      })
    );
    setIsDirty(true);
  };

  const addImportedTrim = () => {
    setImportedTrims((prev) => [
      ...prev,
      { key: `it_${Date.now()}`, itemId: null, item: '', code: '', size: '', consumption: '', uom: '', costUsd: '', priceUsd: 0, sizes: '' },
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
    setKnitsModalOpen(true);
  };

  const handleKnitsApply = (totalConsumption, parts) => {
    setFabricRows((prev) =>
      prev.map((r) => {
        if (r.key !== knitsRowKey) return r;
        const finalConsumption = Math.round(totalConsumption * 10000) / 10000;
        const updated = { ...r, consumption: finalConsumption, knitsParts: parts };
        updated.netCost = calcFabricNetCost(updated.consumption, updated.fabricPrice, updated.allowancePct);
        return updated;
      })
    );
    setKnitsModalOpen(false);
  };

  // AI Consumption modal handlers
  const openConsumptionModal = (rowKey, row) => {
    setConsumptionRowKey(rowKey);
    setConsumptionFabricRow(row);
    setConsumptionModalOpen(true);
  };

  const handleConsumptionApply = (result) => {
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
            netCost:     calcFabricNetCost(c, source.fabricPrice, source.allowancePct),
          };
        });
        return [...prev.filter((r) => r.key !== consumptionRowKey), ...newRows];
      });
    } else {
      setFabricRows((prev) =>
        prev.map((r) => {
          if (r.key !== consumptionRowKey) return r;
          const updated = { ...r, consumption: result.consumption, uom: r.uom || result.uom };
          updated.netCost = calcFabricNetCost(updated.consumption, updated.fabricPrice, updated.allowancePct);
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
      message.success({
        content: 'WhatsApp notification sent',
        icon: <WhatsAppOutlined style={{ color: '#25D366' }} />,
      });
      if (saved?.version != null) setEntityVersion(saved.version);
      setIsDirty(false);
      clearDirty();
      navigate('/costing/list');
    } catch {
      message.error('Failed to save cost sheet');
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
      message.success({
        content: 'WhatsApp notification sent',
        icon: <WhatsAppOutlined style={{ color: '#25D366' }} />,
      });
      if (saved?.version != null) setEntityVersion(saved.version);
      setIsDirty(false);
      clearDirty();
      navigate('/costing/list');
    } catch {
      message.error('Failed to submit cost sheet');
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
              const sizeAccessories = sizeLocalTrims + sizeImportedTrims * actualRate;
              const sizeMfg = manufacturingRows.filter((r) => r.sizes === sk).reduce((s, r) => s + (Number(r.cost) || 0), 0);
              const sizeMarkup = overheadRows.filter((r) => r.sizes === sk).reduce((s, r) => s + (Number(r.cost) || 0), 0);
              const sizeMaking = sizeFabric + sizeAccessories + sizeMfg + sizeMarkup;
              const sizeAgent = syncPercentages ? agentCommissionPct : (perSizeOverrides[sk]?.agentCommissionPct ?? agentCommissionPct);
              const sizeProfit = syncPercentages ? profitPct : (perSizeOverrides[sk]?.profitPct ?? profitPct);
              const sizeOverhead = ((sizeAgent + sizeProfit) / 100) * sizeMaking;
              const sizeTotalPrice = sizeMaking + sizeOverhead;
              const sizeFinalPrice = actualRate ? sizeTotalPrice / actualRate : 0;
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

  const getUploadProps = (category) => ({
    onRemove: (file) => handleFileRemove(file, category),
    onDownload: handleFileDownload,
    showUploadList: { showDownloadIcon: true },
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

  const getConsumptionUom = (record, rawItems) => {
    if (!record.itemId) return '';
    const item = rawItems?.find((i) => i.id === record.itemId);
    return item?.secondaryUomSymbol || item?.uomSymbol || '';
  };

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
      dataIndex: 'itemId',
      width: 240,
      render: (val, record) => (
        <Select
          value={record.itemId || undefined}
          style={{ width: '100%' }}
          options={fabricItemOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Select"
          onChange={(v, opt) => handleFabricItemSelect(record.key, v, opt)}
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
      width: 160,
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
      width: 130,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          step={0.01}
          controls={false}
          placeholder="Price"
          onChange={(v) => updateFabricRow(record.key, 'fabricPrice', v)}
          size="small"
          style={{ width: '100%' }}
          {...numericInputProps}
        />
      ),
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
      width: 80,
      render: (_, record) => (
        <Space size={0}>
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
      dataIndex: 'itemId',
      render: (_, record) => (
        <Select
          value={record.itemId || undefined}
          style={{ width: '100%' }}
          options={localTrimOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Select item"
          onChange={(v, opt) => {
            const rawItem = localTrimItemsRaw.find((i) => i.id === v);
            updateLocalTrim(record.key, { itemId: v, item: opt.label, code: opt.itemCode || '', uom: rawItem?.secondaryUomSymbol || rawItem?.uomSymbol || '' });
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
      width: 120,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} controls={false} placeholder="Cost" onChange={(v) => updateLocalTrim(record.key, 'cost', v)} size="small" style={{ width: '100%' }} {...numericInputProps} />
      ),
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
      dataIndex: 'itemId',
      render: (_, record) => (
        <Select
          value={record.itemId || undefined}
          style={{ width: '100%' }}
          options={importedTrimOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Select item"
          onChange={(v, opt) => {
            const rawItem = importedTrimItemsRaw.find((i) => i.id === v);
            updateImportedTrim(record.key, { itemId: v, item: opt.label, code: opt.itemCode || '', uom: rawItem?.secondaryUomSymbol || rawItem?.uomSymbol || '' });
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
      width: 120,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} controls={false} placeholder="Cost" onChange={(v) => updateImportedTrim(record.key, 'costUsd', v)} size="small" style={{ width: '100%' }} {...numericInputProps} />
      ),
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
          placeholder="Select category"
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
                <Form.Item label="Buyer" name="buyerId" rules={[{ required: true, message: 'Buyer is required' }]}>
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
              <Col xs={24}>
                <Form.Item label="Sizes" name="sizes">
                  <Select
                    mode="tags"
                    placeholder="Enter sizes (e.g. S, M, L, XL)"
                    style={{ width: '100%' }}
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
              (Local: {formatCurrency(totalLocalTrimsCost, currency)} + Imported: {formatCurrency(totalImportedTrimsCostUsd, 'USD')} × {actualRate} rate)
            </Text>
          </Card>
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
          <ActionButton
            action="upload"
            text="Import from Techpack"
            onClick={() => setTechpackModalOpen(true)}
          />
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

      {/* Quick Add Process Modal */}
      <Modal
        title="Add New Process"
        open={quickAddProcessOpen}
        onCancel={() => { setQuickAddProcessOpen(false); quickAddProcessForm.resetFields(); }}
        onOk={() => quickAddProcessForm.submit()}
        confirmLoading={quickAddProcessLoading}
        okText="Create"
        centered
        destroyOnClose
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
        destroyOnClose
        width={420}
      >
        <Form form={quickAddOverheadForm} layout="vertical" onFinish={async (values) => {
          setQuickAddOverheadLoading(true);
          try {
            const created = await createOverhead({ ...values, isActive: true });
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
        destroyOnClose
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
            />
            {quickAddStyleImage && (
              <Typography.Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
                Will upload on create
              </Typography.Text>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default CostingForm;
