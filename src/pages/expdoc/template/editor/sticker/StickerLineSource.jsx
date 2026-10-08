import { Input, Space, Typography } from 'antd';
import { FormSelect } from '../../../../../components/form';
import { STICKER_LINE_KIND } from '../../../../../utils/expDocConstants';
import FieldBindingPicker from '../../FieldBindingPicker';
import {
  BARCODE_SOURCES, STICKER_FIELD_CATEGORIES, barcodeSourceChanges, fieldBindingChanges,
} from './stickerEditorModel';

const { Text } = Typography;

const FIXED = 'fixed:';

/** What a barcode encodes: the EAN of each size in the carton, the carton number, or fixed text. */
const BarcodeSource = ({ line, idp, locked, onChange }) => {
  const fixed = String(line.binding ?? '').startsWith(FIXED);
  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
      <FormSelect
        id={`${idp}-barcode-source`} aria-label="What the barcode encodes" variant="default" allowClear={false} size="small"
        style={{ width: '100%' }} disabled={locked} options={BARCODE_SOURCES}
        value={fixed ? FIXED : line.binding ?? undefined} onChange={(v) => onChange(barcodeSourceChanges(line, v))}
      />
      {fixed && (
        <Input
          size="small" name={`${idp}-barcode-text`} aria-label="Text the barcode encodes" maxLength={200} disabled={locked}
          placeholder="The digits or text to encode" value={line.binding.slice(FIXED.length)}
          onChange={(e) => onChange({ binding: `${FIXED}${e.target.value}` })}
        />
      )}
    </Space>
  );
};

/**
 * Where one sticker line's value comes from. A field line: an ERP field, fixed text, or
 * a value asked once per print run — or nothing, which leaves space for hand-writing. A
 * size grid always prints the carton's own quantities, and a barcode encodes one of three things.
 */
const StickerLineSource = ({ line, takenAskKeys, idp, locked, onChange }) => {
  if (line.kind === STICKER_LINE_KIND.SIZE_GRID) return <Text type="secondary">Size grid of the carton</Text>;
  if (line.kind === STICKER_LINE_KIND.BARCODE) return <BarcodeSource line={line} idp={idp} locked={locked} onChange={onChange} />;
  return (
    <FieldBindingPicker
      id={`${idp}-binding`} value={line.binding} disabled={locked} categories={STICKER_FIELD_CATEGORIES}
      placeholder="Blank — left for hand-writing" ask={{ label: line.label, taken: takenAskKeys }}
      onChange={(binding) => onChange(fieldBindingChanges(line, binding ?? null))}
    />
  );
};

export default StickerLineSource;
