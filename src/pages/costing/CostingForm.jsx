import { useState, useEffect, useMemo } from 'react';
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
  Table,
  Typography,
  Upload,
  Collapse,
  Popconfirm,
  Tooltip,
  Tag,
  Divider,
  Checkbox,
  message,
  Statistic,
  Skeleton,
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
  FileTextOutlined,
  BarChartOutlined,
  CloudUploadOutlined,
  WhatsAppOutlined,
  PrinterOutlined,
  ImportOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
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
  FABRIC_UOMS,
  TRIM_UOMS,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE_MB,
  ATTACHMENT_CATEGORIES,
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
import { getStylesByBuyerId } from '../../services/styleService';
import { searchItems } from '../../services/itemService';
import { getAllCategories } from '../../services/masterDataService';
import { useTheme } from '../../context/ThemeContext';
import { generateCostingPdf } from '../../utils/costingPdfGenerator';
import KnitsConsumptionModal from './KnitsConsumptionModal';
import TechpackImportModal from './TechpackImportModal';
import ConsumptionCalcModal from './ConsumptionCalcModal';

const { Text } = Typography;
const { Dragger } = Upload;

const CostingForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { isDarkMode } = useTheme();
  const isEdit = Boolean(id);


  // Watch Section A sizes to use as options in other sections
  const formSizes = Form.useWatch('sizes', form) || [];
  const sizeOptions = useMemo(
    () => formSizes.map((s) => ({ label: s, value: s })),
    [formSizes],
  );

  // Unsaved changes guard
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChanges(isDirty);

  // State
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [entityVersion, setEntityVersion] = useState(null);
  const [costingId, setCostingId] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [quoteCurrency, setQuoteCurrency] = useState('USD');
  const [actualRate, setActualRate] = useState(83.80);
  const [todaysRate, setTodaysRate] = useState(83.80);
  const [fileList, setFileList] = useState({ TECHPACK: [], MEASUREMENT_CHART: [], OTHER: [] });
  const [usdToInrRate, setUsdToInrRate] = useState(83.80);
  const [styleId, setStyleId] = useState(null);

  // API-fetched dropdown options
  const [buyerOptions, setBuyerOptions] = useState([]);
  const [styleOptions, setStyleOptions] = useState([]);
  const [fabricItemOptions, setFabricItemOptions] = useState([]);
  const [fabricItemsRaw, setFabricItemsRaw] = useState([]);
  const [localTrimOptions, setLocalTrimOptions] = useState([]);
  const [importedTrimOptions, setImportedTrimOptions] = useState([]);
  const [manufacturingOptions, setManufacturingOptions] = useState([]);
  const [overheadOptions, setOverheadOptions] = useState([]);
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
        const mfgCat = categories.find((c) => c.name?.toLowerCase().includes('manufactur'));
        const ovhCat = categories.find((c) => c.name?.toLowerCase().includes('overhead'));

        // Collect all unique category IDs and fetch items in a single API call
        const catMap = {};
        if (fabricCat) catMap.fabric = fabricCat.id;
        if (effectiveLocalTrimCat) catMap.localTrim = effectiveLocalTrimCat.id;
        if (effectiveImportedTrimCat) catMap.importedTrim = effectiveImportedTrimCat.id;
        if (mfgCat) catMap.manufacturing = mfgCat.id;
        if (ovhCat) catMap.overhead = ovhCat.id;

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

          const toOptions = (items) => (items || []).map((item) => ({ value: item.id, label: item.itemName }));

          if (catMap.fabric) {
            const fabItems = byCat[catMap.fabric] || [];
            setFabricItemsRaw(fabItems);
            setFabricItemOptions(toOptions(fabItems));
          }
          if (catMap.localTrim) setLocalTrimOptions(toOptions(byCat[catMap.localTrim]));
          if (catMap.importedTrim) setImportedTrimOptions(toOptions(byCat[catMap.importedTrim]));
          if (catMap.manufacturing) setManufacturingOptions(toOptions(byCat[catMap.manufacturing]));
          if (catMap.overhead) setOverheadOptions(toOptions(byCat[catMap.overhead]));
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
      setCostingId(cs.costingId);
      setStyleId(cs.styleId || null);
      setCurrency(cs.currency);
      setQuoteCurrency(cs.quoteCurrency);
      setActualRate(cs.actualRate);
      // Ensure every loaded row has a unique `key` — the API strips keys on save,
      // and the Table + update/delete functions depend on `key` for row identity.
      const withKeys = (rows, prefix) =>
        (rows || []).map((r, i) => ({ ...r, key: r.key || `${prefix}_${Date.now()}_${i}` }));
      setFabricRows(withKeys(cs.fabricRows, 'f'));
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

      form.setFieldsValue({
        date: cs.date ? dayjs(cs.date) : null,
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
  };

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
    if (result.matchedStyleId) setStyleId(result.matchedStyleId);

    // 3. Map fabric rows
    if (result.fabricRows?.length) {
      setFabricRows(
        result.fabricRows.map((r, i) => ({
          key:              `f_import_${Date.now()}_${i}`,
          itemId:           r.matchedItemId   || null,
          fabricType:       r.matchedItemName || r.extractedName || '',
          classification:   r.classification  || 'Woven',
          description:      r.notes           || '',
          consumption:      '',
          uom:              r.uom || 'meters',
          fabricPrice:      '',
          fabricWidthStd:   '',
          fabricWidthVendor: '',
          vendorId:         null,
          vendorName:       '',
          allowancePct:     0,
          netCost:          0,
          sizes:            '',
        }))
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
          itemId:   r.matchedItemId   || null,
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
        uom: 'meters',
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
        const updated = { ...r, itemId, fabricType: option.label };
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

  const updateLocalTrim = (key, field, value) => {
    setLocalTrims((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, [field]: value };
        updated.price = calcTrimPrice(updated.consumption, updated.cost);
        return updated;
      })
    );
    setIsDirty(true);
  };

  const addLocalTrim = () => {
    setLocalTrims((prev) => [
      ...prev,
      { key: `lt_${Date.now()}`, itemId: null, item: '', code: '', size: '', consumption: '', uom: 'pcs', cost: '', price: 0, sizes: '' },
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

  const updateImportedTrim = (key, field, value) => {
    setImportedTrims((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const updated = { ...r, [field]: value };
        updated.priceUsd = calcTrimPrice(updated.consumption, updated.costUsd);
        return updated;
      })
    );
    setIsDirty(true);
  };

  const addImportedTrim = () => {
    setImportedTrims((prev) => [
      ...prev,
      { key: `it_${Date.now()}`, itemId: null, item: '', code: '', size: '', consumption: '', uom: 'pcs', costUsd: '', priceUsd: 0, sizes: '' },
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

  const updateManufacturingRow = (key, field, value) => {
    setManufacturingRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
    setIsDirty(true);
  };

  const addManufacturingRow = () => {
    setManufacturingRows((prev) => [
      ...prev,
      { key: `m_${Date.now()}`, itemId: null, process: '', cost: '', comments: '', sizes: '' },
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

  const updateOverheadRow = (key, field, value) => {
    setOverheadRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
    setIsDirty(true);
  };

  const addOverheadRow = () => {
    setOverheadRows((prev) => [
      ...prev,
      { key: `o_${Date.now()}`, itemId: null, description: '', cost: '', comments: '', sizes: '' },
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
        const updated = { ...r, consumption: Math.round(totalConsumption * 10000) / 10000, knitsParts: parts };
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
            uom:         result.uom || source.uom,
            netCost:     calcFabricNetCost(c, source.fabricPrice, source.allowancePct),
          };
        });
        return [...prev.filter((r) => r.key !== consumptionRowKey), ...newRows];
      });
    } else {
      setFabricRows((prev) =>
        prev.map((r) => {
          if (r.key !== consumptionRowKey) return r;
          const updated = { ...r, consumption: result.consumption, uom: result.uom || r.uom };
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
  const loadSuggestions = async (type, itemName) => {
    if (!itemName) return;
    const suggestions = await getPastPOSuggestions(type, itemName);
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

    // Strip `key` from row arrays and ensure itemId is included
    const cleanRows = (rows) => rows.map(({ key, ...rest }) => rest);

    return {
      version: entityVersion,
      costingId,
      status,
      date: formValues.date?.format('YYYY-MM-DD'),
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
    try {
      const values = await form.validateFields().catch(() => form.getFieldsValue());
      setSavingDraft(true);
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
      navigate('/costing/list');
    } catch {
      message.error('Failed to save cost sheet');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
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
      navigate('/costing/list');
    } catch {
      message.error('Please fill all required fields');
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
        date: values.date?.format('YYYY-MM-DD'),
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
    MEASUREMENT_CHART: <BarChartOutlined style={{ color: '#0ea5e9' }} />,
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

  // ==================== COLUMN DEFINITIONS ====================

  const fabricColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      width: 120,
      render: (val, record) => (
        <Select
          mode="multiple"
          value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
          placeholder="Sizes"
          options={sizeOptions}
          onChange={(arr) => updateFabricRow(record.key, 'sizes', arr.join(', '))}
          size="small"
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
      ),
    },
    {
      title: 'Fabric Type',
      dataIndex: 'itemId',
      width: 150,
      render: (val, record) => (
        <Select
          value={record.itemId || undefined}
          style={{ width: '100%' }}
          options={fabricItemOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Select"
          onChange={(v, opt) => handleFabricItemSelect(record.key, v, opt)}
          onFocus={() => loadSuggestions('fabric', record.fabricType)}
          size="small"
        />
      ),
    },
    {
      title: 'Classification',
      dataIndex: 'classification',
      width: 110,
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
      width: 160,
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
      width: 145,
      render: (val, record) => (
        <Space.Compact style={{ width: '100%' }}>
          <InputNumber
            value={val}
            min={0}
            step={0.01}
            placeholder="Qty"
            onChange={(v) => updateFabricRow(record.key, 'consumption', v)}
            size="small"
            style={{ width: record.classification === 'Knits' ? '58%' : '78%' }}
          />
          {record.classification === 'Knits' && (
            <Tooltip title="Knits Consumption Calculator (manual parts)">
              <Button
                icon={<CalculatorOutlined />}
                onClick={() => openKnitsModal(record.key)}
                size="small"
                type="primary"
                ghost
              />
            </Tooltip>
          )}
          <Tooltip title="Calculate from Measurement Chart (AI)">
            <Button
              icon={<ThunderboltOutlined />}
              onClick={() => openConsumptionModal(record.key, record)}
              size="small"
              style={{ color: '#faad14', borderColor: '#faad14' }}
            />
          </Tooltip>
        </Space.Compact>
      ),
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      width: 100,
      render: (val, record) => (
        <Select
          value={val || 'meters'}
          style={{ width: '100%' }}
          options={FABRIC_UOMS}
          onChange={(v) => updateFabricRow(record.key, 'uom', v)}
          size="small"
        />
      ),
    },
    {
      title: `Price (${getCurrencySymbol(currency)})`,
      dataIndex: 'fabricPrice',
      width: 110,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          step={0.01}
          placeholder="Price"
          onChange={(v) => updateFabricRow(record.key, 'fabricPrice', v)}
          size="small"
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: 'Width (Std)',
      dataIndex: 'fabricWidthStd',
      width: 90,
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
      width: 95,
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
      width: 95,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          max={100}
          placeholder="%"
          onChange={(v) => updateFabricRow(record.key, 'allowancePct', v)}
          size="small"
          style={{ width: '100%' }}
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
          <Tooltip title="Duplicate row">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => duplicateFabricRow(record.key)} />
          </Tooltip>
          <Popconfirm title="Remove this fabric row?" onConfirm={() => deleteFabricRow(record.key)}>
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const localTrimColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      width: 120,
      render: (val, record) => (
        <Select
          mode="multiple"
          value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
          placeholder="Sizes"
          options={sizeOptions}
          onChange={(arr) => updateLocalTrim(record.key, 'sizes', arr.join(', '))}
          size="small"
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
      ),
    },
    {
      title: 'Item',
      dataIndex: 'itemId',
      width: 160,
      render: (_, record) => (
        <Select
          value={record.itemId || undefined}
          style={{ width: '100%' }}
          options={localTrimOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Select item"
          onChange={(v, opt) => {
            updateLocalTrim(record.key, 'itemId', v);
            updateLocalTrim(record.key, 'item', opt.label);
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
      width: 100,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} placeholder="Qty" onChange={(v) => updateLocalTrim(record.key, 'consumption', v)} size="small" style={{ width: '100%' }} />
      ),
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      width: 100,
      render: (val, record) => (
        <Select
          value={val || 'pcs'}
          style={{ width: '100%' }}
          options={TRIM_UOMS}
          onChange={(v) => updateLocalTrim(record.key, 'uom', v)}
          size="small"
        />
      ),
    },
    {
      title: `Cost (${getCurrencySymbol(currency)})`,
      dataIndex: 'cost',
      width: 110,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} placeholder="Cost" onChange={(v) => updateLocalTrim(record.key, 'cost', v)} size="small" style={{ width: '100%' }} />
      ),
    },
    {
      title: `Price (${getCurrencySymbol(currency)})`,
      dataIndex: 'price',
      width: 110,
      render: (val) => (
        <Text strong>{formatCurrency(val, currency)}</Text>
      ),
    },
    {
      title: '',
      width: 80,
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="Duplicate row">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => duplicateLocalTrim(record.key)} />
          </Tooltip>
          <Popconfirm title="Remove this item?" onConfirm={() => deleteLocalTrim(record.key)}>
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const importedTrimColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      width: 120,
      render: (val, record) => (
        <Select
          mode="multiple"
          value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
          placeholder="Sizes"
          options={sizeOptions}
          onChange={(arr) => updateImportedTrim(record.key, 'sizes', arr.join(', '))}
          size="small"
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
      ),
    },
    {
      title: 'Item',
      dataIndex: 'itemId',
      width: 160,
      render: (_, record) => (
        <Select
          value={record.itemId || undefined}
          style={{ width: '100%' }}
          options={importedTrimOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Select item"
          onChange={(v, opt) => {
            updateImportedTrim(record.key, 'itemId', v);
            updateImportedTrim(record.key, 'item', opt.label);
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
      width: 100,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} placeholder="Qty" onChange={(v) => updateImportedTrim(record.key, 'consumption', v)} size="small" style={{ width: '100%' }} />
      ),
    },
    {
      title: 'UOM',
      dataIndex: 'uom',
      width: 100,
      render: (val, record) => (
        <Select
          value={val || 'pcs'}
          style={{ width: '100%' }}
          options={TRIM_UOMS}
          onChange={(v) => updateImportedTrim(record.key, 'uom', v)}
          size="small"
        />
      ),
    },
    {
      title: 'Cost ($ USD)',
      dataIndex: 'costUsd',
      width: 110,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} placeholder="Cost" onChange={(v) => updateImportedTrim(record.key, 'costUsd', v)} size="small" style={{ width: '100%' }} />
      ),
    },
    {
      title: 'Price ($ USD)',
      dataIndex: 'priceUsd',
      width: 110,
      render: (val) => (
        <Text strong>{formatCurrency(val, 'USD')}</Text>
      ),
    },
    {
      title: '',
      width: 80,
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="Duplicate row">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => duplicateImportedTrim(record.key)} />
          </Tooltip>
          <Popconfirm title="Remove this item?" onConfirm={() => deleteImportedTrim(record.key)}>
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Merge saved row values into API options so existing values always display
  const effectiveMfgOptions = useMemo(() => {
    const apiIds = new Set(manufacturingOptions.map((o) => o.value));
    const extras = manufacturingRows
      .filter((r) => r.itemId && !apiIds.has(r.itemId))
      .map((r) => ({ value: r.itemId, label: r.process || `Item #${r.itemId}` }));
    return [...manufacturingOptions, ...extras.filter((e, i, arr) => arr.findIndex((x) => x.value === e.value) === i)];
  }, [manufacturingOptions, manufacturingRows]);

  const effectiveOvhOptions = useMemo(() => {
    const apiIds = new Set(overheadOptions.map((o) => o.value));
    const extras = overheadRows
      .filter((r) => r.itemId && !apiIds.has(r.itemId))
      .map((r) => ({ value: r.itemId, label: r.description || `Item #${r.itemId}` }));
    return [...overheadOptions, ...extras.filter((e, i, arr) => arr.findIndex((x) => x.value === e.value) === i)];
  }, [overheadOptions, overheadRows]);

  const manufacturingColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      width: 120,
      render: (val, record) => (
        <Select
          mode="multiple"
          value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
          placeholder="Sizes"
          options={sizeOptions}
          onChange={(arr) => updateManufacturingRow(record.key, 'sizes', arr.join(', '))}
          size="small"
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
      ),
    },
    {
      title: 'Process',
      dataIndex: 'itemId',
      width: 200,
      render: (val, record) => (
        <Select
          value={record.itemId || undefined}
          style={{ width: '100%' }}
          options={effectiveMfgOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Select process"
          onChange={(v, opt) => {
            updateManufacturingRow(record.key, 'itemId', v);
            updateManufacturingRow(record.key, 'process', opt.label);
          }}
          size="small"
        />
      ),
    },
    {
      title: `Cost (${getCurrencySymbol(currency)})`,
      dataIndex: 'cost',
      width: 130,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} placeholder="Cost" onChange={(v) => updateManufacturingRow(record.key, 'cost', v)} size="small" style={{ width: '100%' }} />
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
          <Tooltip title="Duplicate row">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => duplicateManufacturingRow(record.key)} />
          </Tooltip>
          <Popconfirm title="Remove this process?" onConfirm={() => deleteManufacturingRow(record.key)}>
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const overheadColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
    {
      title: 'Sizes',
      dataIndex: 'sizes',
      width: 120,
      render: (val, record) => (
        <Select
          mode="multiple"
          value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
          placeholder="Sizes"
          options={sizeOptions}
          onChange={(arr) => updateOverheadRow(record.key, 'sizes', arr.join(', '))}
          size="small"
          style={{ width: '100%' }}
          maxTagCount="responsive"
        />
      ),
    },
    {
      title: 'Description',
      dataIndex: 'itemId',
      width: 200,
      render: (val, record) => (
        <Select
          value={record.itemId || undefined}
          style={{ width: '100%' }}
          options={effectiveOvhOptions}
          showSearch
          optionFilterProp="label"
          placeholder="Select category"
          onChange={(v, opt) => {
            updateOverheadRow(record.key, 'itemId', v);
            updateOverheadRow(record.key, 'description', opt.label);
          }}
          size="small"
        />
      ),
    },
    {
      title: `Cost (${getCurrencySymbol(currency)})`,
      dataIndex: 'cost',
      width: 130,
      render: (val, record) => (
        <InputNumber value={val} min={0} step={0.01} placeholder="Cost" onChange={(v) => updateOverheadRow(record.key, 'cost', v)} size="small" style={{ width: '100%' }} />
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
          <Tooltip title="Duplicate row">
            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => duplicateOverheadRow(record.key)} />
          </Tooltip>
          <Popconfirm title="Remove this item?" onConfirm={() => deleteOverheadRow(record.key)}>
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
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
        <Row gutter={24}>
          <Col xs={24} lg={16}>
            <Row gutter={16}>
              <Col xs={12} md={8}>
                <Form.Item label="Costing ID">
                  <Input value={costingId} disabled />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item label="Date" name="date" rules={[{ required: true, message: 'Date is required' }]}>
                  <DatePicker style={{ width: '100%' }} format="DD-MMM-YYYY" />
                </Form.Item>
              </Col>
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
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={8}>
                <Form.Item label="Garment Name" name="garmentName" rules={[{ required: true, message: 'Required' }]}>
                  <Input placeholder="Auto-filled from style" readOnly />
                </Form.Item>
              </Col>
              <Col xs={12} md={4}>
                <Form.Item label="Season" name="seasonCode">
                  <Select
                    placeholder="Season"
                    allowClear
                    options={[
                      { value: 'SS', label: 'Spring/Summer' },
                      { value: 'AW', label: 'Autumn/Winter' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={4}>
                <Form.Item label="Year" name="seasonYear">
                  <Select
                    placeholder="Year"
                    allowClear
                    options={Array.from({ length: 7 }, (_, i) => {
                      const yr = new Date().getFullYear() - 1 + i;
                      return { value: String(yr), label: String(yr) };
                    })}
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
                    style={{ width: '100%', height: 40 }}
                    onChange={setActualRate}
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
          </Col>
          <Col xs={24} lg={8}>
            <Form.Item label="Attachments">
              <Row gutter={[0, 10]}>
                {ATTACHMENT_CATEGORIES.map((cat) => (
                  <Col span={24} key={cat.value}>
                    <Card
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
                  </Col>
                ))}
              </Row>
            </Form.Item>
          </Col>
        </Row>
      ),
    },
    {
      key: 'fabric',
      label: (
        <Space>
          <Text strong style={{ fontSize: 15, color: '#0ea5e9' }}>
            Section B — Fabric Cost Breakup
          </Text>
          <Tag color="blue">{formatCurrency(totalFabricCost, currency)}</Tag>
        </Space>
      ),
      style: sectionHeaderStyle('#0ea5e9'),
      children: (
        <>
          <Table
            dataSource={fabricRows}
            columns={fabricColumns}
            pagination={false}
            size="small"
            rowKey="key"
            scroll={{ x: 1400 }}
            locale={{ emptyText: 'No fabrics added. Click + Add Fabric to begin.' }}
            summary={() =>
              fabricRows.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row style={summaryRowStyle}>
                    <Table.Summary.Cell index={0} colSpan={11}>
                      <Text strong>Total Fabric Cost</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={11}>
                      <Text strong style={{ color: 'var(--primary-color)', fontSize: 14 }}>
                        {formatCurrency(totalFabricCost, currency)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={12} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null
            }
          />
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={addFabricRow}
            style={{ width: '100%', marginTop: 12 }}
          >
            Add Fabric
          </Button>
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
            scroll={{ x: 900 }}
            locale={{ emptyText: 'No local accessories added.' }}
            summary={() =>
              localTrims.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row style={summaryRowStyle}>
                    <Table.Summary.Cell index={0} colSpan={8}>
                      <Text strong>Local Accessories Total</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8}>
                      <Text strong>{formatCurrency(totalLocalTrimsCost, currency)}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={9} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null
            }
          />
          <Button type="dashed" icon={<PlusOutlined />} onClick={addLocalTrim} style={{ width: '100%', marginTop: 8 }}>
            Add Local Item
          </Button>

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
            scroll={{ x: 900 }}
            locale={{ emptyText: 'No imported accessories added.' }}
            summary={() =>
              importedTrims.length > 0 ? (
                <Table.Summary fixed>
                  <Table.Summary.Row style={summaryRowStyle}>
                    <Table.Summary.Cell index={0} colSpan={8}>
                      <Text strong>Imported Accessories Total (USD)</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={8}>
                      <Text strong>{formatCurrency(totalImportedTrimsCostUsd, 'USD')}</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={9} />
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null
            }
          />
          <Button type="dashed" icon={<PlusOutlined />} onClick={addImportedTrim} style={{ width: '100%', marginTop: 8 }}>
            Add Imported Item
          </Button>

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
          <Button type="dashed" icon={<PlusOutlined />} onClick={addManufacturingRow} style={{ width: '100%', marginTop: 12 }}>
            Add Process
          </Button>
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
          <Button type="dashed" icon={<PlusOutlined />} onClick={addOverheadRow} style={{ width: '100%', marginTop: 12 }}>
            Add Overhead
          </Button>
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
                valueStyle={{ fontSize: 16, color: '#0ea5e9' }}
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
      <div className="page-header">
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/costing/list')}
          />
          <h1>{isEdit ? 'Edit Cost Sheet' : 'Create Cost Sheet'}</h1>
          {costingId && (
            <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>
              {costingId}
            </Tag>
          )}
        </Space>
        <div className="header-actions">
          <Button
            icon={<ImportOutlined />}
            onClick={() => setTechpackModalOpen(true)}
          >
            Import from Techpack
          </Button>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          currency: 'INR',
          quoteCurrency: 'USD',
          date: dayjs(),
        }}
        onValuesChange={() => setIsDirty(true)}
      >
        <Collapse
          defaultActiveKey={['general', 'fabric', 'trims', 'manufacturing', 'overhead', 'summary']}
          items={collapseItems}
          style={{ marginBottom: 80 }}
        />
      </Form>

      {/* Sticky Footer */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 24px',
          background: isDarkMode ? '#1e293b' : '#fff',
          borderTop: `1px solid ${isDarkMode ? '#334155' : '#e2e8f0'}`,
          boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
        }}
      >
        <Button onClick={() => navigate('/costing/list')} disabled={savingDraft || submitting}>
          Cancel
        </Button>
        <Button
          icon={<PrinterOutlined />}
          onClick={handlePrint}
          loading={printing}
          disabled={savingDraft || submitting}
        >
          Print / PDF
        </Button>
        <Button
          icon={<SaveOutlined />}
          onClick={handleSaveDraft}
          loading={savingDraft}
          disabled={submitting}
        >
          Save as Draft
        </Button>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          loading={submitting}
          disabled={savingDraft}
        >
          Submit
        </Button>
      </div>

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
    </div>
  );
};

export default CostingForm;
