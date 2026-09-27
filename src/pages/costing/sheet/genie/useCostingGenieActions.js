import { useCallback, useEffect, useRef } from 'react';
import { useQuickCreate } from '../../../../components/quickcreate/QuickCreateProvider';
import { canQuickCreate } from '../../../../components/quickcreate/quickCreateTypes';
import { getVariantsByIds } from '../../../../services/master/variantService';
import { getStyleById } from '../../../../services/master/styleService';
import { findOrCreateItem } from '../../../../services/master/quickItemService';
import { createProcess } from '../../../../services/master/processService';
import { createOverhead } from '../../../../services/master/overheadService';
import { getTemplateById } from '../../../../services/costing/costingService';
import { useSheet } from '../CostingSheetContext';
import { unwrapList } from '../model/masterOptions';
import { proposalBlocker, quickItemRequest, toSheetRow } from '../ai/draftModel';
import useStartFrom from '../start/useStartFrom';
import { GENIE_SECTIONS } from './costingGenieContext';

const LABEL = { fabric: 'Fabric', localTrim: 'Local trims', importedTrim: 'Imported trims', manufacturing: 'Manufacturing', overhead: 'Overheads' };
const FIELDS = {
  fabric: { quantity: 'consumption', rate: 'fabricPrice', allowancePct: 'allowancePct', wastagePct: 'wastagePct' },
  localTrim: { quantity: 'consumption', rate: 'cost' },
  importedTrim: { quantity: 'consumption', rate: 'costUsd' },
  manufacturing: { rate: 'cost' },
  overhead: { rate: 'cost' },
};
const FORM_FIELDS = { buyer: 'buyerId', style: 'styleNo', sizes: 'sizes', currency: 'currency', 'actual-rate': 'actualRate' };
const CHANGES_SHEET = ['add_rows', 'update_row', 'remove_row', 'set_header', 'set_commercials'];

const sectionKey = (api) => {
  const key = GENIE_SECTIONS[String(api || '').toUpperCase()];
  if (!key) throw new Error(`Unknown section ${api}`);
  return key;
};

const pulse = (el) => {
  if (!el) return;
  el.classList.remove('sheet-anchor-pulse');
  // Restart the animation when the same field is pointed at twice.
  void el.offsetWidth;
  el.classList.add('sheet-anchor-pulse');
  setTimeout(() => el.classList.remove('sheet-anchor-pulse'), 2600);
};

/**
 * Carries out what the Help Genie decided, on the sheet: rows, header, commercials, templates,
 * pointing at a field — as one undoable batch — and the proposal cards, which create masters only
 * when the user clicks, through the same create endpoints and permissions as the pickers.
 */
export default function useCostingGenieActions() {
  const { form, sheet, dispatch, variants, masters, styles, openDialog } = useSheet();
  const { open } = useQuickCreate();
  const { applyTemplate } = useStartFrom();
  const sheetRef = useRef(sheet);
  useEffect(() => { sheetRef.current = sheet; }, [sheet]);

  /** One draft-shaped row → a sheet row, reusing the AI capture's rules for units and currencies. */
  const buildRow = useCallback((api, spec, choice) => toSheetRow({
    section: api, name: spec.name || '', quantity: spec.quantity ?? null, uom: spec.unit || null,
    rate: spec.rate ?? null, rateCurrency: null, allowancePct: spec.allowancePct ?? null, wastagePct: spec.wastagePct ?? null,
    details: spec.note || '',
  }, choice, form.getFieldValue('currency') || 'INR'), [form]);

  const addRows = useCallback(async ({ rows = [] }, skipUndo) => {
    const ids = rows.map((r) => r.variantId).filter(Boolean);
    const fetched = ids.length ? unwrapList(await getVariantsByIds(ids)) : [];
    const byId = new Map(fetched.map((v) => [v.id, v]));
    const bySection = {};
    const notes = [];
    rows.forEach((spec) => {
      const api = String(spec.section).toUpperCase();
      const key = sectionKey(api);
      let choice;
      if (key === 'manufacturing' || key === 'overhead') {
        const options = key === 'manufacturing' ? masters.processOptions : masters.overheadOptions;
        const option = options.find((o) => o.value === (key === 'manufacturing' ? spec.processId : spec.overheadId));
        if (!option) throw new Error(`${LABEL[key]}: that ${key === 'manufacturing' ? 'process' : 'overhead'} was not found`);
        choice = { masterId: option.value, masterName: option.label, masterCost: option.defaultCost };
      } else {
        const variant = byId.get(spec.variantId);
        if (!variant) throw new Error(`${LABEL[key]}: material ${spec.variantId} was not found`);
        variants[key]?.register(variant);
        choice = { variant };
      }
      const out = buildRow(api, spec, choice);
      bySection[key] = [...(bySection[key] || []), out.row];
      notes.push(...out.notes);
    });
    dispatch({ type: 'APPLY_ROWS', rows: bySection, mode: 'append', skipUndo });
    const where = Object.entries(bySection).map(([k, list]) => `${list.length} to ${LABEL[k]}`).join(', ');
    return `Added ${where}${notes.length ? ` (${notes.join('; ')})` : ''}`;
  }, [masters, variants, buildRow, dispatch]);

  const rowAt = (api, number) => {
    const key = sectionKey(api);
    const row = sheetRef.current.sections[key][Number(number) - 1];
    if (!row) throw new Error(`${LABEL[key]} has no row ${number}`);
    return { key, row };
  };

  const pickStyle = useCallback((style) => form.setFieldsValue({
    ...(style.buyerId ? { buyerId: style.buyerId } : {}),
    styleNo: style.id, garmentName: style.garmentName || '', seasonCode: style.seasonCode || undefined, seasonYear: style.seasonYear || undefined,
  }), [form]);

  const tools = {
    add_rows: (args) => addRows(args, true),
    update_row: ({ section, row, ...figures }) => {
      const { key, row: target } = rowAt(section, row);
      const patch = Object.fromEntries(Object.entries(FIELDS[key])
        .filter(([from]) => figures[from] != null).map(([from, to]) => [to, Number(figures[from])]));
      if (!Object.keys(patch).length) throw new Error('Nothing to change on that row');
      dispatch({ type: 'UPDATE_ROW', section: key, key: target.key, patch });
      return `Updated ${LABEL[key]} row ${row}`;
    },
    remove_row: ({ section, row }) => {
      const { key, row: target } = rowAt(section, row);
      dispatch({ type: 'REMOVE_ROW', section: key, key: target.key, skipUndo: true });
      return `Removed ${LABEL[key]} row ${row}`;
    },
    set_header: async ({ buyerId, styleId, sizes, currency, quoteCurrency, costingType, actualRate }) => {
      const done = [];
      if (buyerId && buyerId !== form.getFieldValue('buyerId')) {
        form.setFieldsValue({ buyerId, styleNo: undefined, garmentName: '', seasonCode: undefined, seasonYear: undefined });
        done.push(`buyer ${masters.buyerOptions.find((b) => b.value === buyerId)?.label || buyerId}`);
      }
      if (styleId) {
        const style = await getStyleById(styleId);
        pickStyle(style);
        done.push(`style ${style.styleNo}`);
      }
      const rest = Object.fromEntries(Object.entries({
        sizes: sizes?.length ? sizes.map((s) => String(s).trim().toUpperCase()) : undefined,
        currency, quoteCurrency, costingType, actualRate,
      }).filter(([, v]) => v != null));
      if (Object.keys(rest).length) {
        form.setFieldsValue(rest);
        done.push(...Object.keys(rest).map((k) => ({ sizes: 'sizes', currency: 'currency', quoteCurrency: 'quote currency', costingType: 'costing type', actualRate: 'actual rate' }[k])));
      }
      dispatch({ type: 'MARK_DIRTY' });
      return done.length ? `Set ${done.join(', ')}` : 'Header unchanged';
    },
    set_commercials: ({ agentCommissionPct, profitPct, targetPrice }) => {
      const patch = {};
      if (agentCommissionPct != null) patch.agentCommissionPct = Number(agentCommissionPct);
      if (profitPct != null) Object.assign(patch, { profitPct: Number(profitPct), targetPrice: '' });
      if (targetPrice != null) patch.targetPrice = Number(targetPrice);
      dispatch({ type: 'SET_COMMERCIAL', patch });
      return `Set ${Object.keys(patch).filter((k) => patch[k] !== '').map((k) => ({ agentCommissionPct: 'agent commission', profitPct: 'profit', targetPrice: 'target price' }[k])).join(', ')}`;
    },
    apply_template: async ({ templateId }) => {
      const template = await getTemplateById(templateId);
      await applyTemplate(template.templateData || {});
      return `Applied the template ${template.templateName}`;
    },
    focus_field: ({ target }) => {
      const field = FORM_FIELDS[target];
      if (field) {
        form.scrollToField(field, { behavior: 'smooth', block: 'center' });
        const input = document.getElementById(field);
        pulse(input?.closest('.ant-form-item'));
        input?.focus({ preventScroll: true });
      } else {
        const el = document.querySelector(`[data-genie-anchor="${target}"]`);
        if (!el) throw new Error(`Could not find ${target} on the screen`);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        pulse(el);
      }
      return `Showing ${String(target).replace(/-/g, ' ')}`;
    },
    open_capture: ({ mode }) => {
      openDialog('capture', { mode: ['speak', 'upload', 'text'].includes(mode) ? mode : 'speak' });
      return 'Opened AI capture';
    },
  };

  const applyActions = async (actions) => {
    if (actions.some((a) => CHANGES_SHEET.includes(a.tool))) dispatch({ type: 'CHECKPOINT' });
    const results = [];
    for (const action of actions) {
      const run = tools[action.tool];
      try {
        if (!run) throw new Error(`The sheet cannot do ${action.tool}`);
        results.push({ ok: true, changed: CHANGES_SHEET.includes(action.tool), text: await run(action.args || {}) });
      } catch (err) {
        results.push({ ok: false, text: err?.response?.data?.message || err.message || 'That did not work' });
      }
    }
    return results;
  };

  // ── proposal cards ──

  const addMaterial = (data, variant) => {
    const key = sectionKey(data.section);
    variants[key]?.register(variant);
    const out = buildRow(data.section, { name: variant.variantName, quantity: data.quantity, unit: data.unit, rate: data.rate }, { variant });
    dispatch({ type: 'APPLY_ROWS', rows: { [key]: [out.row] }, mode: 'append' });
  };

  const addCostMaster = (kind, option, cost) => {
    (kind === 'process' ? masters.addProcess : masters.addOverhead)(option);
    const api = kind === 'process' ? 'MANUFACTURING' : 'OVERHEAD';
    const out = buildRow(api, { name: option.label, rate: cost ?? null }, { masterId: option.value, masterName: option.label, masterCost: option.defaultCost });
    dispatch({ type: 'APPLY_ROWS', rows: { [sectionKey(api)]: [out.row] }, mode: 'append' });
  };

  const editProposal = (p, onDone) => {
    const { data } = p;
    if (p.kind === 'material') {
      const key = sectionKey(data.section);
      open('item', {
        prefill: { text: data.proposal.variantName, category: variants[key]?.category, proposal: data.proposal },
        onCreated: (variant) => { addMaterial(data, variant); onDone(`Created ${variant.variantName} and added it to ${LABEL[key]}`); },
      });
    } else if (p.kind === 'process' || p.kind === 'overhead') {
      open(p.kind, {
        prefill: { text: data.name },
        onCreated: (option) => { addCostMaster(p.kind, option, data.defaultCost); onDone(`Created ${option.label} and added it`); },
      });
    } else if (p.kind === 'buyer') {
      open('buyer', {
        prefill: { text: data.name },
        onCreated: (buyer) => {
          masters.addBuyer(buyer);
          form.setFieldsValue({ buyerId: buyer.id, styleNo: undefined, garmentName: '', seasonCode: undefined, seasonYear: undefined });
          dispatch({ type: 'MARK_DIRTY' });
          onDone(`Created ${buyer.name} and set it as the buyer`);
        },
      });
    } else if (p.kind === 'style') {
      const buyerId = form.getFieldValue('buyerId');
      if (!buyerId) return false;
      open('style', {
        prefill: { text: data.styleNo, buyerId, buyerName: masters.buyerOptions.find((b) => b.value === buyerId)?.label },
        onCreated: (style) => { styles.addStyle(style); pickStyle(style); dispatch({ type: 'MARK_DIRTY' }); onDone(`Created ${style.styleNo} and picked it`); },
      });
    }
    return true;
  };

  const confirmProposal = async (p, onDone) => {
    const { data } = p;
    if (p.kind === 'material') {
      const blocker = proposalBlocker(data.proposal);
      if (data.proposal.missing?.length || blocker) {
        if (blocker) return { ok: false, text: blocker };
        editProposal(p, onDone);
        return { opened: true };
      }
      const result = await findOrCreateItem(quickItemRequest({ ref: p.id, proposedItem: data.proposal }));
      addMaterial(data, result.variant);
      return {
        ok: true,
        text: result.variantCreated ? `Created ${result.variant.variantName} (${result.variant.variantCode}) and added it`
          : `${result.variant.variantName} already existed — added it`,
      };
    }
    if (p.kind === 'process' || p.kind === 'overhead') {
      if (!canQuickCreate(p.kind)) return { ok: false, text: `You need "${p.kind === 'process' ? 'Process' : 'Overhead'} Master → Add" permission.` };
      const created = p.kind === 'process'
        ? await createProcess({ processName: data.name, defaultCost: data.defaultCost ?? 0, category: 'Manufacturing', isActive: true })
        : await createOverhead({ overheadName: data.name, defaultCost: data.defaultCost ?? 0, isActive: true });
      const option = { value: created.id, label: created.processName || created.overheadName, defaultCost: created.defaultCost || 0 };
      addCostMaster(p.kind, option, data.defaultCost);
      return { ok: true, text: `Created ${option.label} and added it` };
    }
    if (p.kind === 'style' && !form.getFieldValue('buyerId')) return { ok: false, text: 'Pick the buyer first — a style belongs to a buyer.' };
    editProposal(p, onDone);
    return { opened: true };
  };

  return {
    applyActions,
    undo: () => dispatch({ type: 'UNDO' }),
    confirmProposal,
    editProposal,
    openCapture: (mode) => openDialog('capture', { mode }),
  };
}
