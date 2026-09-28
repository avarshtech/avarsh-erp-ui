import { useCallback } from 'react';
import { App } from 'antd';
import { getCostSheetById } from '../../../../services/costing/costingService';
import { getLastPrices } from '../../../../services/costing/costingPriceService';
import { useSheet } from '../CostingSheetContext';
import { SECTION_CONFIG, SECTION_KEYS } from '../model/sectionConfig';
import { hydrateRows } from '../model/rowFactory';
import { fromResponse } from '../model/payloadMapper';
import { applyLastPrices, variantIdsOf } from '../model/priceRefresh';

const HEADER_DEFAULTS = ['costingType', 'pricingUnit', 'currency', 'quoteCurrency'];
const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => obj?.[k] != null).map((k) => [k, obj[k]]));

/**
 * The ways into a sheet other than typing: a saved template or a previous costing. Both bring
 * their rows, re-priced from what the materials were last bought or costed at, so an old
 * template does not quietly carry old prices. Both are one undo away.
 */
export default function useStartFrom() {
  const { form, dispatch } = useSheet();
  const { message } = App.useApp();

  const refreshed = useCallback(async (sections) => {
    try {
      return applyLastPrices(sections, await getLastPrices(variantIdsOf(sections)), form.getFieldValue('currency'));
    } catch {
      return { sections, updated: 0 };
    }
  }, [form]);

  const applyTemplate = useCallback(async (templateData) => {
    const headerDefaults = pick(templateData.header, HEADER_DEFAULTS);
    if (Object.keys(headerDefaults).length) form.setFieldsValue(headerDefaults);
    const rows = Object.fromEntries(SECTION_KEYS.map((k) => [k, hydrateRows(k, templateData[SECTION_CONFIG[k].payloadKey])]));
    const { sections, updated } = await refreshed(rows);
    dispatch({ type: 'APPLY_ROWS', rows: sections, mode: 'replace' });
    if (templateData.header?.agentCommissionPct != null || templateData.header?.profitPct != null) {
      dispatch({ type: 'SET_COMMERCIAL', patch: pick(templateData.header, ['agentCommissionPct', 'profitPct']) });
    }
    message.success(updated ? `Template applied — ${updated} rate(s) updated from recent prices.` : 'Template applied.');
  }, [form, dispatch, refreshed, message]);

  const copyCosting = useCallback(async (costSheetId) => {
    const source = fromResponse(await getCostSheetById(costSheetId));
    const { sections, updated } = await refreshed(source.sheet.sections);
    // One costing per style: the copy keeps the buyer and currencies but never the style.
    form.setFieldsValue({ ...pick(source.values, ['buyerId', ...HEADER_DEFAULTS, 'sizes']), styleNo: undefined, garmentName: '' });
    dispatch({ type: 'APPLY_SHEET', sheet: { ...source.sheet, sections } });
    message.success(`Copied ${source.meta.costingId}${updated ? ` — ${updated} rate(s) updated` : ''}. Now pick the new style.`);
    form.scrollToField('styleNo');
  }, [form, dispatch, refreshed, message]);

  return { applyTemplate, copyCosting };
}
