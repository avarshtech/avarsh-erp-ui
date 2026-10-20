import { sameUom } from '../../../../utils/uomConversions';
import { canCreateClassifiers, canQuickCreate } from '../../../../components/quickcreate/quickCreateTypes';
import { blankRow, variantPatch } from '../model/rowFactory';

/**
 * Turning an AI draft (POST /cost-sheets/ai-draft) into sheet rows. The reviewer's decision for
 * each draft row is a "choice", keyed by the row's ref:
 *   { include, variant }                          a fabric or trim linked to a variant
 *   { include, create }                           a complete proposal, created on apply
 *   { include, masterId, masterName, masterCost } a process or overhead in the master
 *   { include, createMaster }                     a process or overhead created on apply, at the heard rate
 */
export const SECTION_OF = {
  FABRIC: 'fabric', LOCAL_TRIM: 'localTrim', IMPORTED_TRIM: 'importedTrim', MANUFACTURING: 'manufacturing', OVERHEAD: 'overhead',
};
export const MATERIAL_SECTIONS = ['fabric', 'localTrim', 'importedTrim'];
const RATE_FIELD = { fabric: 'fabricPrice', localTrim: 'cost', importedTrim: 'costUsd' };

export const isMaterial = (row) => MATERIAL_SECTIONS.includes(SECTION_OF[row.section]);
export const isComplete = (proposal) => !!proposal && !proposal.missing?.length;
/** process | overhead — the quick-create type of a non-material row. */
export const costMasterType = (row) => (row.section === 'MANUFACTURING' ? 'process' : 'overhead');
export const needsNewClassifiers = (p) => !!(p?.newSubCategoryName || p?.newItemTypeName);

/** Why a complete proposal still cannot be created by this user, or null when it can. */
export function proposalBlocker(proposal) {
  if (!canQuickCreate('item')) return 'You need "Items → Add" permission to create materials.';
  if (needsNewClassifiers(proposal) && !canCreateClassifiers()) {
    return 'The new sub-category or item type needs "Master Data → Add" permission.';
  }
  return null;
}

const creatable = (proposal) => isComplete(proposal) && !proposalBlocker(proposal);

/** Pre-ticked: anything linkable or creatable that the AI was not unsure about. */
export function initialChoices(draft) {
  return Object.fromEntries((draft?.rows || []).map((row) => {
    const sure = row.confidence !== 'LOW';
    if (!isMaterial(row)) {
      const linked = !!row.matchedMasterId;
      const createMaster = !linked && canQuickCreate(costMasterType(row));
      return [row.ref, {
        include: (linked || createMaster) && sure, createMaster,
        masterId: row.matchedMasterId, masterName: row.matchedMasterName, masterCost: row.matchedMasterCost,
      }];
    }
    const variant = row.suggestions?.find((s) => s.variant.id === row.matchedVariantId)?.variant || null;
    const create = !variant && creatable(row.proposedItem);
    return [row.ref, { include: (!!variant || create) && sure, variant, create }];
  }));
}

/** linked | create | incomplete | unlinked — what applying the row would do now. */
export function rowState(row, choice) {
  if (!isMaterial(row)) {
    if (choice?.masterId) return 'linked';
    return choice?.createMaster ? 'create' : 'unlinked';
  }
  if (choice?.variant) return 'linked';
  if (choice?.create) return 'create';
  return row.proposedItem ? 'incomplete' : 'unlinked';
}

export const canInclude = (row, choice) => ['linked', 'create'].includes(rowState(row, choice));

/** The find-or-create request for a complete proposal — new classifiers travel with it. */
export const quickItemRequest = (row) => {
  const p = row.proposedItem;
  return {
    clientRef: row.ref,
    categoryId: p.categoryId,
    subCategoryId: p.subCategoryId ?? null,
    newSubCategoryName: p.subCategoryId ? null : p.newSubCategoryName,
    itemTypeId: p.itemTypeId ?? null,
    newItemType: p.itemTypeId ? null : { name: p.newItemTypeName, attributeIds: p.newItemTypeAttributeIds || [], uomIds: [] },
    uomId: p.uomId,
    secondaryUomId: p.secondaryUomId ?? null,
    uomConversionFactor: p.uomConversionFactor ?? null,
    defaultAllowance: 0,
    variant: { variantName: p.variantName, attributes: p.attributes || {} },
  };
};

/** "Fabric › Labels (new) › Main Label (new) · labelType Woven · PCS" */
export const proposalLabel = (p) => [
  [
    p.categoryName,
    p.subCategoryName && `${p.subCategoryName}${p.subCategoryId ? '' : ' (new)'}`,
    p.itemTypeName && `${p.itemTypeName}${p.itemTypeId ? '' : ' (new)'}`,
  ].filter(Boolean).join(' › '),
  ...Object.entries(p.attributes || {}).map(([k, v]) => `${k} ${v}`),
  p.uomSymbol,
].filter(Boolean).join(' · ');

/** The rate a row states, when it is in the currency its section is priced in. */
export const sectionRate = (row, costingCurrency) => {
  const currency = SECTION_OF[row.section] === 'importedTrim' ? 'USD' : (costingCurrency || 'INR');
  return row.rate != null && (!row.rateCurrency || row.rateCurrency === currency) ? Number(row.rate) : null;
};

/**
 * One sheet row from a draft row. A quantity is applied only in the unit the row is consumed in,
 * and a rate only in the currency its section is priced in; anything held back is named in
 * `notes` so nothing is dropped silently.
 */
export function toSheetRow(row, choice, costingCurrency) {
  const section = SECTION_OF[row.section];
  const notes = [];
  const rate = sectionRate(row, costingCurrency);
  if (row.rate != null && rate == null) {
    notes.push(`${row.name}: rate ${row.rate} ${row.rateCurrency} left out — this section is priced in ${section === 'importedTrim' ? 'USD' : costingCurrency}`);
  }

  if (!isMaterial(row)) {
    const cost = rate ?? (Number(choice.masterCost) || '');
    const fields = section === 'manufacturing'
      ? { processId: choice.masterId, process: choice.masterName, cost, comments: row.details || '' }
      : { overheadId: choice.masterId, description: choice.masterName, cost, comments: row.details || '' };
    return { section, row: blankRow(section, fields), notes };
  }

  const patch = variantPatch(section, choice.variant);
  const qtyFits = row.quantity != null && (!row.uom || !patch.uom || sameUom(row.uom, patch.uom));
  if (row.quantity != null && !qtyFits) notes.push(`${row.name}: ${row.quantity} ${row.uom} left out — it is consumed in ${patch.uom}`);
  const fields = {
    ...patch,
    ...(section === 'fabric' && row.classification && !patch.classification ? { classification: row.classification } : {}),
    consumption: qtyFits ? Number(row.quantity) : '',
    ...(rate != null ? { [RATE_FIELD[section]]: rate } : {}),
    ...(section === 'fabric' && row.allowancePct != null ? { allowancePct: Number(row.allowancePct) } : {}),
    ...(section === 'fabric' && row.wastagePct != null ? { wastagePct: Number(row.wastagePct) } : {}),
  };
  return { section, row: blankRow(section, fields), notes };
}

/**
 * The header values the draft offers, each ticked by default only when the sheet's own field is
 * still empty — an AI reading never silently overwrites what the user already chose.
 */
export function headerOffers(header, { values, commercial, costingCurrency }) {
  if (!header) return [];
  const offers = [];
  if (header.matchedBuyerId) {
    offers.push({ key: 'buyer', label: 'Buyer', text: header.matchedBuyerName, on: !values.buyerId });
  } else if (header.buyerName) {
    offers.push({ key: 'buyer', label: 'Buyer', text: header.buyerName, missing: 'buyer' });
  }
  if (header.matchedStyleId) {
    offers.push({ key: 'style', label: 'Style', text: header.styleNo, on: !values.styleNo });
  } else if (header.styleNo) {
    offers.push({ key: 'style', label: 'Style', text: header.styleNo, missing: 'style' });
  }
  if (header.sizes?.length) offers.push({ key: 'sizes', label: 'Sizes', text: header.sizes.join(', '), on: !values.sizes?.length });
  if (header.agentCommissionPct != null) {
    offers.push({ key: 'agentCommissionPct', label: 'Agent commission', text: `${header.agentCommissionPct}%`, on: !Number(commercial.agentCommissionPct) });
  }
  if (header.profitPct != null) offers.push({ key: 'profitPct', label: 'Profit', text: `${header.profitPct}%`, on: !Number(commercial.profitPct) });
  if (header.targetPrice != null) {
    const fits = !header.quoteCurrency || header.quoteCurrency === costingCurrency;
    offers.push({
      key: 'targetPrice', label: 'Target price', text: `${header.targetPrice} ${header.quoteCurrency || ''}`.trim(),
      on: fits && !commercial.targetPrice, disabled: !fits, hint: fits ? undefined : `The sheet's target is in ${costingCurrency}`,
    });
  }
  return offers;
}
