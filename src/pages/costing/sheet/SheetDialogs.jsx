import { App, Form } from 'antd';
import { convertGramsTo, normaliseUomSymbol } from '../../../utils/uomConversions';
import KnitsConsumptionModal from '../KnitsConsumptionModal';
import WovenConsumptionModal from '../WovenConsumptionModal';
import ConsumptionCalcModal from '../ConsumptionCalcModal';
import BomImportModal from '../BomImportModal';
import CostingTemplateModal from '../CostingTemplateModal';
import BuyerPriceTrendModal from '../BuyerPriceTrendModal';
import { useSheet } from './CostingSheetContext';
import { SECTION_CONFIG, SECTION_KEYS } from './model/sectionConfig';
import { hydrateRows, nextKey, recalcRow } from './model/rowFactory';
import CopyCostingDrawer from './start/CopyCostingDrawer';
import useStartFrom from './start/useStartFrom';
import AiCaptureModal from './ai/AiCaptureModal';
import AiDraftReviewDrawer from './ai/AiDraftReviewDrawer';

const METRES = ['m', 'mtr', 'mtrs', 'meter', 'meters', 'metre', 'metres'];

/** Every modal and drawer the sheet opens. At most one is open; `dialog` says which. */
export default function SheetDialogs() {
  const { message } = App.useApp();
  const { form, sheet, dispatch, masters, dialog, openDialog, closeDialog } = useSheet();
  const { applyTemplate } = useStartFrom();
  const buyerId = Form.useWatch('buyerId', form);
  const type = dialog?.type;
  const rowKey = dialog?.payload?.rowKey;
  const row = rowKey ? sheet.sections.fabric.find((r) => r.key === rowKey) : null;
  const updateRow = (patch) => dispatch({ type: 'UPDATE_ROW', section: 'fabric', key: rowKey, patch });

  const onKnits = (totalGrams, parts) => {
    const grams = convertGramsTo(totalGrams, row?.uom) ?? 0;
    updateRow({ consumption: Math.round(grams * 10000) / 10000, knitsParts: parts });
    closeDialog();
  };
  const onWoven = (consumption) => {
    if (row?.uom && !METRES.includes(normaliseUomSymbol(row.uom))) {
      message.warning(`Calculated in METRES but this fabric is consumed in ${row.uom.toUpperCase()}. Check the value — it was applied as-is.`);
    }
    updateRow({ consumption });
    closeDialog();
  };
  const onAiConsumption = (result) => {
    if (row?.uom && result.uom && normaliseUomSymbol(row.uom) !== normaliseUomSymbol(result.uom)) {
      message.warning(`AI calculated in ${String(result.uom).toUpperCase()} but this fabric is consumed in ${row.uom.toUpperCase()}. Check the value — it was applied as-is.`);
    }
    if (result.splitBySizes && row) {
      const rows = (result.sizes || []).map((size) => recalcRow('fabric', {
        ...row, key: nextKey('f'), sizes: size, consumption: result.consumptionPerSize?.[size] || 0, uom: row.uom || result.uom,
      }));
      dispatch({ type: 'REPLACE_ROW', section: 'fabric', key: rowKey, rows });
    } else {
      updateRow({ consumption: result.consumption, uom: row?.uom || result.uom });
    }
    closeDialog();
    message.success('Consumption updated from the AI calculation.');
  };
  // "Verify in calculator": the AI's panels, in grams per garment, open in the knits calculator.
  const onOpenKnits = (aiParts, gsm, size) => openDialog('knits', {
    rowKey,
    parts: (aiParts || []).map((p, i) => ({
      key: `kp_ai_${i}`, partName: p.partName || `Part ${i + 1}`, length: '', width: '', nop: p.numberOfPieces || 1, gsm: gsm || '',
      gramsPerPart: p.contributionPerSize?.[size] != null ? Math.round(p.contributionPerSize[size] * 100000) / 100 : '',
    })),
  });
  const onBom = ({ fabricRows, localTrims, importedTrims }) => {
    dispatch({
      type: 'APPLY_ROWS', mode: 'append',
      rows: { fabric: hydrateRows('fabric', fabricRows), localTrim: hydrateRows('localTrim', localTrims), importedTrim: hydrateRows('importedTrim', importedTrims) },
    });
    message.success('BOM lines imported.');
  };

  const values = form.getFieldsValue(['costingType', 'pricingUnit', 'currency', 'quoteCurrency']);
  const templateData = {
    ...Object.fromEntries(SECTION_KEYS.map((k) => [SECTION_CONFIG[k].payloadKey, sheet.sections[k]])),
    header: { ...values, agentCommissionPct: sheet.commercial.agentCommissionPct, profitPct: sheet.commercial.profitPct },
  };

  return (
    <>
      <KnitsConsumptionModal open={type === 'knits'} onCancel={closeDialog} onApply={onKnits}
        initialParts={dialog?.payload?.parts || row?.knitsParts || []} targetUom={row?.uom || ''} />
      <WovenConsumptionModal open={type === 'woven'} onCancel={closeDialog} onApply={onWoven} />
      <ConsumptionCalcModal open={type === 'aiConsumption'} onClose={closeDialog} onApply={onAiConsumption}
        onOpenKnitsCalc={onOpenKnits} fabricRow={row} />
      <BomImportModal open={type === 'bom'} onClose={closeDialog} styleId={form.getFieldValue('styleNo')} onApply={onBom} />
      <CostingTemplateModal open={type === 'template' || type === 'saveTemplate'} mode={type === 'saveTemplate' ? 'save' : 'load'}
        onClose={closeDialog} currentData={templateData} onApply={applyTemplate} />
      <BuyerPriceTrendModal open={type === 'priceTrend'} onClose={closeDialog} buyerId={buyerId}
        buyerName={masters.buyerOptions.find((b) => b.value === buyerId)?.label} />
      {type === 'copy' && <CopyCostingDrawer open onClose={closeDialog} />}
      {type === 'capture' && (
        <AiCaptureModal initialMode={dialog.payload?.mode} onClose={closeDialog} onRead={(draft) => openDialog('aiReview', { draft })} />
      )}
      {type === 'aiReview' && <AiDraftReviewDrawer draft={dialog.payload.draft} onClose={closeDialog} />}
    </>
  );
}
