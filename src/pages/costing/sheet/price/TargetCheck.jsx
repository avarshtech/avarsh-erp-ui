import { Alert } from 'antd';
import { getCurrencySymbol } from '../../../../utils/orderConstants';
import { useSheet } from '../CostingSheetContext';

/**
 * The target price against the making price on show — the whole garment, or the size picked
 * in the live panel. For a size it says only whether the target clears that size's making price:
 * the profit a target implies is worked out once for the sheet, not per size.
 */
export default function TargetCheck({ view, size }) {
  const { sheet, header } = useSheet();
  const target = Number(sheet.commercial.targetPrice) || 0;
  if (!(target > 0) || !(view.making > 0)) return null;
  const sym = getCurrencySymbol(header.currency);
  const below = view.making >= target;
  const what = size ? `Size ${size} making price` : 'Making price';
  const title = below
    ? `${what} ${sym} ${view.making.toFixed(2)} is already at or above the target — no room for profit.`
    : size
      ? `Target ${sym} ${target.toFixed(2)} is above the size ${size} making price ${sym} ${view.making.toFixed(2)}.`
      : `Target ${sym} ${target.toFixed(2)} leaves ${view.profitPct.toFixed(2)}% profit.`;
  return <Alert style={{ marginTop: 12 }} type={below ? 'error' : 'success'} showIcon title={title} />;
}
