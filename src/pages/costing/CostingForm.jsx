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
  message,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  SendOutlined,
  ArrowLeftOutlined,
  CalculatorOutlined,
  InboxOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  getCostSheetById,
  createCostSheet,
  updateCostSheet,
  getPastPOSuggestions,
  getTodaysRate,
} from '../../services/costingService';
import {
  COSTING_STATUS,
  FABRIC_CLASSIFICATIONS,
  CURRENCIES,
  FABRIC_UOMS,
  TRIM_UOMS,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE_MB,
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
import KnitsConsumptionModal from './KnitsConsumptionModal';

const { Text } = Typography;
const { Dragger } = Upload;

const CostingForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const { isDarkMode } = useTheme();
  const isEdit = Boolean(id);

  // State
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [costingId, setCostingId] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [quoteCurrency, setQuoteCurrency] = useState('USD');
  const [actualRate, setActualRate] = useState(83.80);
  const [todaysRate, setTodaysRate] = useState(83.80);
  const [fileList, setFileList] = useState([]);
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

  // Knits modal
  const [knitsModalOpen, setKnitsModalOpen] = useState(false);
  const [knitsRowKey, setKnitsRowKey] = useState(null);
  const [knitsParts, setKnitsParts] = useState([]);

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

        // Fetch items for each category
        if (fabricCat) {
          const fabRes = await searchItems({ categoryId: fabricCat.id, size: 200 });
          const fabItems = fabRes.data?.content || fabRes.data || [];
          setFabricItemsRaw(fabItems);
          setFabricItemOptions(fabItems.map((item) => ({ value: item.id, label: item.itemName })));
        }
        const effectiveLocalTrimCat = localTrimCat || generalTrimCat;
        if (effectiveLocalTrimCat) {
          const ltRes = await searchItems({ categoryId: effectiveLocalTrimCat.id, size: 200 });
          const ltItems = ltRes.data?.content || ltRes.data || [];
          setLocalTrimOptions(ltItems.map((item) => ({ value: item.id, label: item.itemName })));
        }
        const effectiveImportedTrimCat = importedTrimCat || generalTrimCat;
        if (effectiveImportedTrimCat) {
          const itRes = await searchItems({ categoryId: effectiveImportedTrimCat.id, size: 200 });
          const itItems = itRes.data?.content || itRes.data || [];
          setImportedTrimOptions(itItems.map((item) => ({ value: item.id, label: item.itemName })));
        }

        // Fetch Manufacturing items
        const mfgCat = categories.find((c) => c.name?.toLowerCase().includes('manufactur'));
        if (mfgCat) {
          const mfgRes = await searchItems({ categoryId: mfgCat.id, size: 200 });
          const mfgItems = mfgRes.data?.content || mfgRes.data || [];
          setManufacturingOptions(mfgItems.map((item) => ({ value: item.id, label: item.itemName })));
        }

        // Fetch Overhead items
        const ovhCat = categories.find((c) => c.name?.toLowerCase().includes('overhead'));
        if (ovhCat) {
          const ovhRes = await searchItems({ categoryId: ovhCat.id, size: 200 });
          const ovhItems = ovhRes.data?.content || ovhRes.data || [];
          setOverheadOptions(ovhItems.map((item) => ({ value: item.id, label: item.itemName })));
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
      setCostingId('Auto-generated');
      // Pre-populate manufacturing rows with common processes
      setManufacturingRows([]);
    }
  }, [id]);

  // Update today's rate when currencies change
  useEffect(() => {
    if (quoteCurrency && quoteCurrency !== currency) {
      getTodaysRate(quoteCurrency, currency).then((rate) => {
        setTodaysRate(rate);
      });
    } else {
      setTodaysRate(1);
    }
  }, [currency, quoteCurrency]);

  // Fetch USD-INR rate for USD Final Price display
  useEffect(() => {
    getTodaysRate('USD', 'INR').then((rate) => {
      setUsdToInrRate(rate);
    });
  }, []);

  const loadCostSheet = async () => {
    setLoading(true);
    try {
      const cs = await getCostSheetById(id);
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
      setFileList(cs.attachments || []);

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
      setLoading(false);
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
    form.setFieldsValue({ styleNo: undefined, garmentName: '' });
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
      form.setFieldsValue({ garmentName: option.style.garmentName || '' });
    }
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
      },
    ]);
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
  };

  const deleteFabricRow = (key) => {
    setFabricRows((prev) => prev.filter((r) => r.key !== key));
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
  };

  const addLocalTrim = () => {
    setLocalTrims((prev) => [
      ...prev,
      { key: `lt_${Date.now()}`, itemId: null, item: '', code: '', size: '', consumption: '', uom: 'pcs', cost: '', price: 0 },
    ]);
  };

  const deleteLocalTrim = (key) => {
    setLocalTrims((prev) => prev.filter((r) => r.key !== key));
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
  };

  const addImportedTrim = () => {
    setImportedTrims((prev) => [
      ...prev,
      { key: `it_${Date.now()}`, itemId: null, item: '', code: '', size: '', consumption: '', uom: 'pcs', costUsd: '', priceUsd: 0 },
    ]);
  };

  const deleteImportedTrim = (key) => {
    setImportedTrims((prev) => prev.filter((r) => r.key !== key));
  };

  const updateManufacturingRow = (key, field, value) => {
    setManufacturingRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  };

  const addManufacturingRow = () => {
    setManufacturingRows((prev) => [
      ...prev,
      { key: `m_${Date.now()}`, itemId: null, process: '', cost: '', comments: '' },
    ]);
  };

  const deleteManufacturingRow = (key) => {
    setManufacturingRows((prev) => prev.filter((r) => r.key !== key));
  };

  const updateOverheadRow = (key, field, value) => {
    setOverheadRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, [field]: value } : r))
    );
  };

  const addOverheadRow = () => {
    setOverheadRows((prev) => [
      ...prev,
      { key: `o_${Date.now()}`, itemId: null, description: '', cost: '', comments: '' },
    ]);
  };

  const deleteOverheadRow = (key) => {
    setOverheadRows((prev) => prev.filter((r) => r.key !== key));
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

    // Resolve styleNo label from styleOptions
    const selectedStyle = styleOptions.find((s) => s.value === formValues.styleNo);
    const resolvedStyleNo = selectedStyle ? selectedStyle.label : formValues.styleNo;

    // Strip `key` from row arrays and ensure itemId is included
    const cleanRows = (rows) => rows.map(({ key, ...rest }) => rest);

    return {
      costingId,
      status,
      date: formValues.date?.format('YYYY-MM-DD'),
      buyerId: formValues.buyerId,
      styleId,
      styleNo: resolvedStyleNo,
      garmentName: formValues.garmentName,
      season,
      currency,
      quoteCurrency,
      actualRate,
      todaysRate,
      sizes: formValues.sizes || [],
      attachments: fileList,
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
    };
  };

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields().catch(() => form.getFieldsValue());
      setSaving(true);
      const payload = buildPayload(values, COSTING_STATUS.DRAFT);
      if (isEdit) {
        await updateCostSheet(id, payload);
        message.success('Cost sheet saved as draft');
      } else {
        await createCostSheet(payload);
        message.success('Cost sheet created as draft');
      }
      navigate('/costing/list');
    } catch {
      message.error('Failed to save cost sheet');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = buildPayload(values, COSTING_STATUS.FINAL);
      if (isEdit) {
        await updateCostSheet(id, payload);
        message.success('Cost sheet submitted successfully');
      } else {
        await createCostSheet(payload);
        message.success('Cost sheet created and submitted');
      }
      navigate('/costing/list');
    } catch {
      message.error('Please fill all required fields');
    } finally {
      setSaving(false);
    }
  };

  // ==================== FILE UPLOAD ====================

  const uploadProps = {
    onRemove: (file) => {
      setFileList((prev) => prev.filter((f) => f.uid !== file.uid));
    },
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
      setFileList((prev) => [...prev, file]);
      return false; // Prevent auto-upload
    },
    fileList,
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
      width: 120,
      render: (val, record) => (
        <Space.Compact style={{ width: '100%' }}>
          <InputNumber
            value={val}
            min={0}
            step={0.01}
            placeholder="Qty"
            onChange={(v) => updateFabricRow(record.key, 'consumption', v)}
            size="small"
            style={{ width: record.classification === 'Knits' ? '70%' : '100%' }}
          />
          {record.classification === 'Knits' && (
            <Tooltip title="Calculate Knits Consumption">
              <Button
                icon={<CalculatorOutlined />}
                onClick={() => openKnitsModal(record.key)}
                size="small"
                type="primary"
                ghost
              />
            </Tooltip>
          )}
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
      width: 45,
      render: (_, record) => (
        <Popconfirm title="Remove this fabric row?" onConfirm={() => deleteFabricRow(record.key)}>
          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      ),
    },
  ];

  const localTrimColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
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
      width: 45,
      render: (_, record) => (
        <Popconfirm title="Remove this item?" onConfirm={() => deleteLocalTrim(record.key)}>
          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      ),
    },
  ];

  const importedTrimColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
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
      width: 45,
      render: (_, record) => (
        <Popconfirm title="Remove this item?" onConfirm={() => deleteImportedTrim(record.key)}>
          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
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
      width: 45,
      render: (_, record) => (
        <Popconfirm title="Remove this process?" onConfirm={() => deleteManufacturingRow(record.key)}>
          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      ),
    },
  ];

  const overheadColumns = [
    { title: 'S.No', width: 50, render: (_, __, i) => i + 1 },
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
      width: 45,
      render: (_, record) => (
        <Popconfirm title="Remove this item?" onConfirm={() => deleteOverheadRow(record.key)}>
          <Button type="text" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
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
                    style={{ width: '100%' }}
                    onChange={setActualRate}
                  />
                </Form.Item>
              </Col>
              <Col xs={12} md={6}>
                <Form.Item label={<Space>Today's Rate <Tooltip title="Auto-fetched exchange rate"><InfoCircleOutlined /></Tooltip></Space>}>
                  <InputNumber value={todaysRate} disabled style={{ width: '100%' }} />
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
              <Dragger {...uploadProps} style={{ padding: '16px 0' }}>
                <p className="ant-upload-drag-icon" style={{ marginBottom: 8 }}>
                  <InboxOutlined style={{ color: '#6366f1', fontSize: 36 }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: 13 }}>
                  Click or drag files to upload
                </p>
                <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                  JPG, PNG, PDF, DOC, XLS (max {MAX_FILE_SIZE_MB}MB)
                </p>
              </Dragger>
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
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong>Total Manufacturing Cost</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <Text strong style={{ color: 'var(--primary-color)', fontSize: 14 }}>
                        {formatCurrency(totalManufacturingCost, currency)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} colSpan={2} />
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
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <Text strong>Total Markup Cost</Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <Text strong style={{ color: 'var(--primary-color)', fontSize: 14 }}>
                        {formatCurrency(totalMarkupCost, currency)}
                      </Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} colSpan={2} />
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
                onChange={setAgentCommissionPct}
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
                onChange={(v) => { setProfitPct(v); setTargetPrice(''); }}
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
                onChange={setTargetPrice}
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
                  Total Price (INR)
                </Text>
                <Text style={{ color: '#6366f1', fontSize: 24, fontWeight: 800, display: 'block' }}>
                  {getCurrencySymbol('INR')} {totalPrice.toFixed(2)}
                </Text>
              </Card>
            </Col>
            {quoteCurrency !== 'INR' && quoteCurrency !== 'USD' && (
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
            <Col xs={12} md={quoteCurrency !== 'INR' && quoteCurrency !== 'USD' ? 6 : 9}>
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
        </Card>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <div className="page-header">
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/costing/list')}
            type="text"
          />
          <h1>{isEdit ? 'Edit Cost Sheet' : 'Create Cost Sheet'}</h1>
          {costingId && (
            <Tag color="blue" style={{ fontSize: 13, padding: '2px 10px' }}>
              {costingId}
            </Tag>
          )}
        </Space>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          currency: 'INR',
          quoteCurrency: 'USD',
          date: dayjs(),
        }}
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
        <Button onClick={() => navigate('/costing/list')} disabled={saving}>
          Cancel
        </Button>
        <Button
          icon={<SaveOutlined />}
          onClick={handleSaveDraft}
          loading={saving}
        >
          Save as Draft
        </Button>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleSubmit}
          loading={saving}
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
    </div>
  );
};

export default CostingForm;
