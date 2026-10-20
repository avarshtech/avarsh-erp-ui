import { InputNumber, Space, Typography } from 'antd';
import { FormSelect } from '../../../../../components/form';
import { BARCODE_SYMBOLOGY } from '../../../../../utils/expDocConstants';
import { integerInputProps } from '../../../../../utils/inputHelpers';
import { LabeledSwitch } from '../EditorParts';
import { OptionItem } from './StickerParts';
import { EAN_BINDING, SYMBOLOGY_OPTIONS } from './stickerEditorModel';

const { Text } = Typography;

/**
 * A barcode's type, whether its digits print under the bars, and its height.
 *
 * "One per size" follows what the barcode encodes: the EAN of each size prints a barcode
 * for every size in the carton (LIZANNE), anything else prints one. It is shown, not set,
 * because that is how the sticker prints it.
 */
const StickerBarcodeOptions = ({ line, idp, onChange }) => {
  const barcode = line.barcode || {};
  const setBarcode = (changes) => onChange({ barcode: { ...barcode, ...changes } });
  const symbology = barcode.symbology || 'EAN13';
  const printable = Object.hasOwn(BARCODE_SYMBOLOGY, symbology) && BARCODE_SYMBOLOGY[symbology].printable;
  return (
    <>
      <OptionItem
        id={`${idp}-symbology`} label="Barcode type"
        extra={printable ? null : <Text type="warning">Recorded only: the sticker prints a &quot;not printed yet&quot; notice in its place.</Text>}
      >
        <FormSelect id={`${idp}-symbology`} variant="default" allowClear={false} style={{ width: '100%' }} options={SYMBOLOGY_OPTIONS}
          value={symbology} onChange={(v) => setBarcode({ symbology: v })} />
      </OptionItem>
      <OptionItem id={`${idp}-height`} label="Height">
        <InputNumber {...integerInputProps} id={`${idp}-height`} min={8} max={30} suffix="mm" style={{ width: 120 }}
          value={barcode.heightMm ?? 12} onChange={(v) => setBarcode({ heightMm: v ?? 12 })} />
      </OptionItem>
      <Space size={16} wrap>
        <LabeledSwitch label="Show the digits" checked={barcode.showText !== false} onChange={(v) => setBarcode({ showText: v })} />
        <LabeledSwitch
          label="One per size" checked={line.binding === EAN_BINDING} disabled
          hint="Set by what the barcode encodes: the EAN of each size prints one barcode per size in the carton."
        />
      </Space>
    </>
  );
};

export default StickerBarcodeOptions;
