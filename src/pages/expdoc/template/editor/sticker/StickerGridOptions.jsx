import { Input, InputNumber, Segmented } from 'antd';
import { FormSelect } from '../../../../../components/form';
import { numericInputProps } from '../../../../../utils/inputHelpers';
import { LabeledSwitch } from '../EditorParts';
import { OptionItem } from './StickerParts';

const CELLS = [{ value: 'QTY', label: 'Quantities' }, { value: 'RATIO', label: 'Assortment ratio' }];

const SIZES = [
  { value: 'ALL', label: 'All sizes of the packing list' },
  { value: 'CARTON', label: 'Only the carton\'s sizes' },
];

/**
 * The carton's colour × size grid: quantities or a ratio pack's assortment ratio, every
 * size of the packing list (a buyer's fixed columns) or only the carton's own, a TOTAL row
 * and column, the text in its top-left corner, and its font size (9 pt when not set).
 */
const StickerGridOptions = ({ line, idp, locked, onChange }) => {
  const grid = line.grid || {};
  const setGrid = (changes) => onChange({ grid: { ...grid, ...changes } });
  return (
    <>
      <OptionItem label="Cells">
        <Segmented size="small" aria-label="Cells" disabled={locked} options={CELLS}
          value={grid.cells || 'QTY'} onChange={(v) => setGrid({ cells: v })} />
      </OptionItem>
      <OptionItem id={`${idp}-sizes`} label="Sizes">
        <FormSelect id={`${idp}-sizes`} variant="default" allowClear={false} style={{ width: '100%' }} options={SIZES}
          value={grid.sizes || 'ALL'} onChange={(v) => setGrid({ sizes: v })} />
      </OptionItem>
      <OptionItem id={`${idp}-corner`} label="Corner text">
        <Input id={`${idp}-corner`} maxLength={20} placeholder="e.g. COLOUR /" value={grid.corner ?? ''}
          onChange={(e) => setGrid({ corner: e.target.value })} />
      </OptionItem>
      <OptionItem id={`${idp}-fontPt`} label="Font size">
        <InputNumber {...numericInputProps} id={`${idp}-fontPt`} min={6} max={36} suffix="pt" placeholder="9" style={{ width: 120 }}
          value={line.fontPt ?? null} onChange={(v) => onChange({ fontPt: v ?? undefined })} />
      </OptionItem>
      <LabeledSwitch label="TOTAL row and column" checked={grid.totals === true} onChange={(v) => setGrid({ totals: v })} />
    </>
  );
};

export default StickerGridOptions;
