import { useMemo } from 'react';
import { Form } from 'antd';
import { useGenieScreen } from '../../../../components/genie/genieContext';
import { useSheet } from '../CostingSheetContext';
import { sheetBlockers, sheetSnapshot } from './costingGenieContext';
import useCostingGenieActions from './useCostingGenieActions';

const STARTERS = [
  'How is wastage applied?',
  'Fill the rates from the last PO',
  'Add a fabric for me',
  'Why is the price above target?',
  'Profit eppadi calculate aagum?',
];

/** Puts the Help Genie on the costing sheet. Renders nothing; the Genie shell lives in the layout. */
export default function CostingGenieBridge() {
  const { form, sheet, totals, meta, masters, styles, instanceKey } = useSheet();
  const actions = useCostingGenieActions();
  const buyerId = Form.useWatch('buyerId', form);
  const styleNo = Form.useWatch('styleNo', form);
  const sizes = Form.useWatch('sizes', form);
  const actualRate = Form.useWatch('actualRate', form);

  const blockers = useMemo(
    () => sheetBlockers({ values: { buyerId, styleNo, sizes, actualRate }, sheet, totals }),
    [buyerId, styleNo, sizes, actualRate, sheet, totals],
  );
  const blockersKey = blockers.join('|');
  // The instance key survives the first save (new → edit), so the conversation does too.
  const storageKey = `costing:${instanceKey}`;
  const view = useMemo(() => ({
    id: 'costing-sheet',
    title: meta.costingId ? `Costing ${meta.costingId}` : 'New costing',
    storageKey,
    blockers: blockersKey ? blockersKey.split('|') : [],
    starters: STARTERS,
  }), [meta.costingId, storageKey, blockersKey]);

  useGenieScreen(view, {
    ...actions,
    getContext: () => {
      const values = form.getFieldsValue(true);
      return sheetSnapshot({
        values, meta, sheet, totals, problems: blockers,
        labels: {
          buyerName: masters.buyerOptions.find((b) => b.value === values.buyerId)?.label,
          styleNo: styles.options.find((s) => s.value === values.styleNo)?.label,
        },
      });
    },
  });

  return null;
}
