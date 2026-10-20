import dayjs from 'dayjs';
import { SECTION_CONFIG, SECTION_KEYS } from './sectionConfig';
import { hydrateRows } from './rowFactory';

const MASTER_ID = { fabric: 'variantId', localTrim: 'variantId', importedTrim: 'variantId', manufacturing: 'processId', overhead: 'overheadId' };
const FIGURES = ['consumption', 'fabricPrice', 'cost', 'costUsd'];

/** A row with no master picked and no figure typed — an "Add" click that was never used. */
export const isBlankRow = (sectionKey, row) =>
  !row[MASTER_ID[sectionKey]] && FIGURES.every((f) => row[f] === '' || row[f] == null || Number(row[f]) === 0);

/** Rows that carry figures but no master — Submit refuses these (a costing line is always a master record). */
export const unlinkedRows = (sections) => Object.entries(sections).flatMap(([key, rows]) =>
  rows.map((row, i) => ({ key, row, index: i })).filter(({ row }) => !row[MASTER_ID[key]] && !isBlankRow(key, row)));

const strip = (sectionKey, rows) => rows.filter((r) => !isBlankRow(sectionKey, r)).map(({ key: _k, ...rest }) => rest);

/** "SS26" → { seasonCode: 'SS', seasonYear: '2026' } */
const splitSeason = (season) =>
  (season && season.length >= 4 ? { seasonCode: season.slice(0, 2), seasonYear: `20${season.slice(2)}` } : {});

/** CostSheetRequest from the header form values, the sheet state and its computed totals. */
export function toPayload({ values, sheet, totals, meta, todaysRate, labels, status }) {
  const { commercial, notes } = sheet;
  const rows = Object.fromEntries(SECTION_KEYS.map((k) => [SECTION_CONFIG[k].payloadKey, strip(k, sheet.sections[k])]));
  return {
    version: meta.version,
    costingId: meta.costingId,
    status,
    date: dayjs().format('YYYY-MM-DD'),
    buyerId: values.buyerId,
    buyerName: labels.buyerName || '',
    styleId: values.styleNo,
    styleNo: labels.styleNo,
    garmentName: values.garmentName,
    season: values.seasonCode && values.seasonYear ? values.seasonCode + String(values.seasonYear).slice(-2) : '',
    currency: values.currency,
    quoteCurrency: values.quoteCurrency,
    actualRate: values.actualRate,
    todaysRate,
    sizes: values.sizes || [],
    costingType: values.costingType,
    pricingUnit: values.pricingUnit,
    scenarioName: values.scenarioName || '',
    scenarioGroupId: meta.scenarioGroupId ?? null,
    aiSourceFileIds: meta.aiSourceFileIds || [],
    ...rows,
    agentCommissionPct: totals.agentPct,
    profitPct: totals.profitPct,
    targetPrice: commercial.targetPrice,
    fabricNotes: notes.fabric,
    trimsNotes: notes.trims,
    manufacturingNotes: notes.manufacturing,
    overheadNotes: notes.overhead,
    sizeSummaries: totals.perSize.map((p) => ({
      sizes: p.size, agentCommissionPct: p.agentPct, profitPct: p.profitPct, targetPrice: p.targetPrice || null,
    })),
  };
}

/** A CostSheetResponse split into header form values, sheet state and save metadata. */
export function fromResponse(cs) {
  const summaries = cs.sizeSummaries || [];
  const first = summaries[0];
  const perSizeOverrides = Object.fromEntries(summaries.map((s) => [s.sizes, {
    agentCommissionPct: s.agentCommissionPct, profitPct: s.profitPct, targetPrice: s.targetPrice,
  }]));
  const synced = summaries.every((s) => s.agentCommissionPct === first?.agentCommissionPct && s.profitPct === first?.profitPct);
  return {
    values: {
      buyerId: cs.buyerId,
      styleNo: cs.styleId || null,
      garmentName: cs.garmentName,
      ...splitSeason(cs.season),
      currency: cs.currency,
      quoteCurrency: cs.quoteCurrency,
      actualRate: cs.actualRate,
      sizes: cs.sizes,
      costingType: cs.costingType || 'FOB',
      pricingUnit: cs.pricingUnit || 'PIECE',
      scenarioName: cs.scenarioName || '',
    },
    sheet: {
      sections: Object.fromEntries(SECTION_KEYS.map((k) => [k, hydrateRows(k, cs[SECTION_CONFIG[k].payloadKey])])),
      notes: {
        fabric: cs.fabricNotes || '', trims: cs.trimsNotes || '',
        manufacturing: cs.manufacturingNotes || '', overhead: cs.overheadNotes || '',
      },
      commercial: {
        agentCommissionPct: cs.agentCommissionPct || 0,
        profitPct: cs.profitPct || 0,
        targetPrice: cs.targetPrice || '',
        perSizeOverrides,
        syncPercentages: synced,
      },
    },
    meta: {
      id: cs.id, costingId: cs.costingId, version: cs.version, status: cs.status || null,
      date: cs.date ? dayjs(cs.date) : null, scenarioGroupId: cs.scenarioGroupId || null,
    },
  };
}
