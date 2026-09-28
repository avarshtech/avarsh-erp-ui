import { Select } from 'antd';
import { useSheet } from '../CostingSheetContext';
import { rowSizes } from '../model/costCalculator';

/** Which of the sheet's sizes the row applies to. Blank means every size. */
export default function SizesCell({ sectionKey, record }) {
  const { dispatch, header } = useSheet();
  return (
    <Select
      mode="multiple" size="small" style={{ width: '100%' }} maxTagCount={1} placeholder="All sizes" aria-label="Sizes"
      value={rowSizes(record)}
      options={header.sizes.map((s) => ({ value: s, label: s }))}
      onChange={(list) => dispatch({ type: 'UPDATE_ROW', section: sectionKey, key: record.key, patch: { sizes: list.join(', ') } })}
    />
  );
}
