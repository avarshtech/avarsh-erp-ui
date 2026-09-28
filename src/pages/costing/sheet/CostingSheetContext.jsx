import { createContext, useCallback, useContext, useMemo, useReducer, useState } from 'react';
import { Form } from 'antd';
import useUnsavedChanges from '../../../hooks/useUnsavedChanges';
import { initialSheet, isDirty, sheetReducer } from './model/sheetReducer';
import { computeTotals } from './model/costCalculator';
import useSheetMasters from './hooks/useSheetMasters';
import useVariantOptions from './hooks/useVariantOptions';
import useBuyerStyles from './hooks/useBuyerStyles';
import useExchangeRate from './hooks/useExchangeRate';
import usePastPrices from './hooks/usePastPrices';
import useSheetLoader from './hooks/useSheetLoader';
import useSheetPersist from './hooks/useSheetPersist';
import useSheetSave from './hooks/useSheetSave';
import useDraftAutosave from './hooks/useDraftAutosave';
import useLocalDraft from './hooks/useLocalDraft';
import useAttachments from './hooks/useAttachments';
import useGarmentImage from './hooks/useGarmentImage';

const SheetContext = createContext(null);

const EMPTY_META = { id: null, costingId: null, version: null, status: null, date: null, scenarioGroupId: null };

/**
 * The costing sheet's state and wiring, shared by every part of the page (and later the Help
 * Genie): the header form, the row sections, totals, masters, save and autosave.
 */
export function CostingSheetProvider({ id, instanceKey, children }) {
  const [form] = Form.useForm();
  const [sheet, dispatch] = useReducer(sheetReducer, undefined, initialSheet);
  const [meta, setMeta] = useState(EMPTY_META);
  const [dialog, setDialog] = useState(null);

  const masters = useSheetMasters();
  const fabric = useVariantOptions(masters.categories.fabric);
  const localTrim = useVariantOptions(masters.categories.localTrim);
  const importedTrim = useVariantOptions(masters.categories.importedTrim);
  const variants = useMemo(() => ({ fabric, localTrim, importedTrim }), [fabric, localTrim, importedTrim]);

  const buyerId = Form.useWatch('buyerId', form);
  const currency = Form.useWatch('currency', form);
  const quoteCurrency = Form.useWatch('quoteCurrency', form);
  const actualRate = Form.useWatch('actualRate', form);
  const costingType = Form.useWatch('costingType', form);
  const pricingUnit = Form.useWatch('pricingUnit', form);
  const sizes = Form.useWatch('sizes', form);
  const header = useMemo(
    () => ({ currency, quoteCurrency, actualRate, costingType, pricingUnit, sizes: sizes || [] }),
    [currency, quoteCurrency, actualRate, costingType, pricingUnit, sizes],
  );

  const rates = useExchangeRate(currency, quoteCurrency);
  const totals = useMemo(() => computeTotals(sheet, header, rates.usdToInrRate), [sheet, header, rates.usdToInrRate]);
  const styles = useBuyerStyles(buyerId);
  const pastPrices = usePastPrices();
  const attachments = useAttachments(meta.id);
  const garmentImage = useGarmentImage();

  const { load: loadAttachments } = attachments;
  const { load: loadImage } = garmentImage;
  const onLoaded = useCallback((loaded) => { loadAttachments(loaded.id); loadImage(loaded.id); }, [loadAttachments, loadImage]);
  const loading = useSheetLoader(id, { form, dispatch, meta, setMeta, onLoaded });

  const dirty = isDirty(sheet);
  const { clearDirty } = useUnsavedChanges(dirty);
  const localDraft = useLocalDraft({ isNew: !id, form, sheet, dispatch });

  const labelsOf = useCallback((values) => ({
    buyerName: masters.buyerOptions.find((b) => b.value === values.buyerId)?.label,
    styleNo: styles.options.find((s) => s.value === values.styleNo)?.label,
  }), [masters.buyerOptions, styles.options]);
  const persist = useSheetPersist({ form, sheet, dispatch, totals, meta, setMeta, todaysRate: rates.todaysRate, labelsOf });

  const { uploadStaged: uploadAttachments } = attachments;
  const { uploadStaged: uploadImage } = garmentImage;
  const { clear: clearLocalDraft } = localDraft;
  const afterSave = useCallback(async (sheetId) => {
    await uploadAttachments(sheetId);
    await uploadImage(sheetId);
    clearLocalDraft();
  }, [uploadAttachments, uploadImage, clearLocalDraft]);

  const save = useSheetSave({ form, persist, meta, dirty, sections: sheet.sections, afterSave, clearDirty, instanceKey });
  const canAutosave = useCallback(() => {
    const v = form.getFieldsValue(['buyerId', 'styleNo', 'sizes', 'actualRate']);
    return !!(v.buyerId && v.styleNo && v.sizes?.length && Number(v.actualRate) > 0);
  }, [form]);
  const autosave = useDraftAutosave({ meta, dirty, rev: sheet.rev, busy: save.busy, persist, canSave: canAutosave });

  // The recording, photos or tech pack an AI draft was read from; attached to the sheet on save.
  const addAiSources = useCallback((fileIds) => setMeta((m) => ({
    ...m, aiSourceFileIds: [...new Set([...(m.aiSourceFileIds || []), ...fileIds])],
  })), []);

  const openDialog = useCallback((type, payload) => setDialog({ type, payload }), []);
  const closeDialog = useCallback(() => setDialog(null), []);

  const value = {
    form, sheet, dispatch, meta, header, totals, rates, masters, variants, styles, pastPrices,
    attachments, garmentImage, loading, dirty, save, autosave, localDraft, isNew: !id,
    dialog, openDialog, closeDialog, addAiSources, instanceKey,
  };
  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSheet = () => useContext(SheetContext);
