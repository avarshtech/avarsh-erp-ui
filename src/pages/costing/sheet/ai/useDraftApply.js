import { useCallback, useState } from 'react';
import { App } from 'antd';
import { findOrCreateItems } from '../../../../services/master/quickItemService';
import { getStyleById } from '../../../../services/master/styleService';
import { createProcess } from '../../../../services/master/processService';
import { createOverhead } from '../../../../services/master/overheadService';
import { useSheet } from '../CostingSheetContext';
import { SECTION_OF, canInclude, quickItemRequest, sectionRate, toSheetRow } from './draftModel';

const serverMessage = (err, fallback) => err?.response?.data?.message || fallback;

/**
 * Applies a reviewed AI draft. The ticked new materials — with any new sub-category or item type
 * — are created in one all-or-nothing batch first; if the server refuses any, nothing reaches the
 * sheet and the refusals are shown on their rows. New processes and overheads are created at the
 * rate that was heard. Then the ticked rows are appended (highlighted, one Undo away) and the
 * ticked header values set. Resolves true when the drawer can close.
 */
export default function useDraftApply() {
  const { form, dispatch, variants, masters, addAiSources } = useSheet();
  const { message } = App.useApp();
  const [busy, setBusy] = useState(false);
  const [rowErrors, setRowErrors] = useState({});

  const applyHeader = useCallback(async (header, picks) => {
    if (!header) return false;
    const patch = {};
    if (picks.buyer && header.matchedBuyerId && header.matchedBuyerId !== form.getFieldValue('buyerId')) {
      Object.assign(patch, { buyerId: header.matchedBuyerId, styleNo: undefined, garmentName: '', seasonCode: undefined, seasonYear: undefined });
    }
    if (picks.style && header.matchedStyleId) {
      const style = await getStyleById(header.matchedStyleId).catch(() => null);
      if (style) {
        Object.assign(patch, {
          ...(style.buyerId ? { buyerId: style.buyerId } : {}),
          styleNo: style.id, garmentName: style.garmentName || '', seasonCode: style.seasonCode || undefined, seasonYear: style.seasonYear || undefined,
        });
      }
    }
    if (picks.sizes && header.sizes?.length) patch.sizes = header.sizes;
    if (Object.keys(patch).length) form.setFieldsValue(patch);

    const commercial = {};
    if (picks.agentCommissionPct) commercial.agentCommissionPct = Number(header.agentCommissionPct);
    if (picks.profitPct) Object.assign(commercial, { profitPct: Number(header.profitPct), targetPrice: '' });
    if (picks.targetPrice) commercial.targetPrice = Number(header.targetPrice);
    if (Object.keys(commercial).length) dispatch({ type: 'SET_COMMERCIAL', patch: commercial });
    else if (Object.keys(patch).length) dispatch({ type: 'MARK_DIRTY' });
    return Object.keys(patch).length + Object.keys(commercial).length > 0;
  }, [form, dispatch]);

  const createMaterials = useCallback(async (rows) => {
    if (!rows.length) return {};
    try {
      const results = await findOrCreateItems(rows.map(quickItemRequest), { silent: true });
      return Object.fromEntries(results.map((r) => [r.clientRef, r.variant]));
    } catch (err) {
      const errors = err?.response?.data?.rowErrors;
      if (errors) setRowErrors(errors);
      message.error(errors ? 'Some new materials could not be created — see the marked lines.'
        : serverMessage(err, 'The new materials could not be created. Try again.'));
      return null;
    }
  }, [message]);

  /** A process or overhead the master lacks, named as heard and costed at the heard rate. */
  const createCostMaster = useCallback(async (row, costingCurrency) => {
    const defaultCost = sectionRate(row, costingCurrency) ?? 0;
    if (row.section === 'MANUFACTURING') {
      const created = await createProcess({ processName: row.name, defaultCost, category: 'Manufacturing', isActive: true });
      const option = { value: created.id, label: created.processName, defaultCost: created.defaultCost || 0 };
      masters.addProcess(option);
      return option;
    }
    const created = await createOverhead({ overheadName: row.name, defaultCost, isActive: true });
    const option = { value: created.id, label: created.overheadName, defaultCost: created.defaultCost || 0 };
    masters.addOverhead(option);
    return option;
  }, [masters]);

  const apply = useCallback(async (draft, choices, picks) => {
    const rows = (draft.rows || []).filter((r) => choices[r.ref]?.include && canInclude(r, choices[r.ref]));
    setBusy(true);
    setRowErrors({});
    try {
      const created = await createMaterials(rows.filter((r) => choices[r.ref].create && !choices[r.ref].variant));
      if (!created) return false;

      const costingCurrency = form.getFieldValue('currency');
      const bySection = {};
      const notes = [];
      let newMasters = 0;
      for (const r of rows) {
        const choice = { ...choices[r.ref], variant: choices[r.ref].variant || created[r.ref] };
        if (choice.createMaster && !choice.masterId) {
          try {
            const option = await createCostMaster(r, costingCurrency);
            Object.assign(choice, { masterId: option.value, masterName: option.label, masterCost: option.defaultCost });
            newMasters += 1;
          } catch (err) {
            notes.push(`${r.name} could not be created (${serverMessage(err, 'server error')}) and was left out`);
            continue;
          }
        }
        if (choice.variant) variants[SECTION_OF[r.section]]?.register(choice.variant);
        const out = toSheetRow(r, choice, costingCurrency);
        bySection[out.section] = [...(bySection[out.section] || []), out.row];
        notes.push(...out.notes);
      }

      const headerChanged = await applyHeader(draft.header, picks);
      const added = Object.values(bySection).flat().length;
      if (added) dispatch({ type: 'APPLY_ROWS', rows: bySection, mode: 'append' });
      if (draft.sourceFileIds?.length) addAiSources(draft.sourceFileIds);

      const newCount = Object.keys(created).length + newMasters;
      const summary = added
        ? `Added ${added} line${added === 1 ? '' : 's'}${newCount ? ` (${newCount} new master record${newCount === 1 ? '' : 's'} created)` : ''}. Check the quantities and prices.`
        : headerChanged ? 'Header updated from the AI reading.' : 'Nothing was ticked, so nothing changed.';
      message.success(summary);
      if (notes.length) message.warning({ content: `Held back: ${notes.join('; ')}`, duration: 8 });
      return true;
    } finally {
      setBusy(false);
    }
  }, [createMaterials, createCostMaster, form, variants, applyHeader, dispatch, addAiSources, message]);

  return { apply, busy, rowErrors };
}
