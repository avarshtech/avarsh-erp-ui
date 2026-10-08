import {
  Col, Form, Input, InputNumber, Row, Segmented, Space,
} from 'antd';
import { FormSelect } from '../../../../../components/form';
import { STICKER_LINE_KIND } from '../../../../../utils/expDocConstants';
import { integerInputProps, numericInputProps } from '../../../../../utils/inputHelpers';
import { LabeledSwitch } from '../EditorParts';
import { OptionItem } from './StickerParts';
import StickerGridOptions from './StickerGridOptions';
import StickerBarcodeOptions from './StickerBarcodeOptions';
import { fieldTraits } from './stickerEditorModel';

const ALIGN_OPTIONS = [{ value: 'LEFT', label: 'Left' }, { value: 'CENTER', label: 'Centre' }, { value: 'RIGHT', label: 'Right' }];

// How a list prints (the sizes "4 / 8"); the renderer's own default is " / ".
const JOIN_OPTIONS = [
  { value: ' / ', label: '4 / 8' }, { value: '/', label: '4/8' }, { value: ', ', label: '4, 8' }, { value: ',', label: '4,8' },
];

/** A cleared setting is dropped, so a line keeps only what was set on it. */
const orUnset = (v) => (v === null || v === '' ? undefined : v);

/** A field line's font and the text around its value; decimals, a join and a pattern only where its field takes them. */
const FieldOptions = ({ line, idp, locked, onChange }) => {
  const traits = fieldTraits(line.binding);
  const id = (k) => `${idp}-${k}`;
  const text = (k, label, props = {}) => (
    <OptionItem id={id(k)} label={label} extra={props.extra}>
      <Input id={id(k)} maxLength={props.max || 20} placeholder={props.placeholder} value={line[k] ?? ''}
        onChange={(e) => onChange({ [k]: orUnset(e.target.value) })} />
    </OptionItem>
  );
  return (
    <Row gutter={8}>
      <Col span={10}>
        <OptionItem id={id('fontPt')} label="Font size">
          <InputNumber {...numericInputProps} id={id('fontPt')} min={6} max={36} suffix="pt" placeholder="auto" style={{ width: '100%' }}
            value={line.fontPt ?? null} onChange={(v) => onChange({ fontPt: orUnset(v) })} />
        </OptionItem>
      </Col>
      <Col span={14}>
        <OptionItem label="Align">
          <Segmented size="small" aria-label="Align" disabled={locked} options={ALIGN_OPTIONS}
            value={line.align || 'LEFT'} onChange={(v) => onChange({ align: v })} />
        </OptionItem>
      </Col>
      <Col span={24} style={{ marginBottom: 12 }}>
        <Space size={16} wrap>
          <LabeledSwitch label="Bold" checked={Boolean(line.bold)} onChange={(v) => onChange({ bold: v })} />
          <LabeledSwitch label="Capitals" checked={Boolean(line.caps)} onChange={(v) => onChange({ caps: v })} />
        </Space>
      </Col>
      <Col span={12}>{text('prefix', 'Prefix')}</Col>
      <Col span={12}>{text('suffix', 'Suffix', { placeholder: 'e.g. " KGS"' })}</Col>
      {traits.decimals && (
        <Col span={12}>
          <OptionItem id={id('decimals')} label="Decimals">
            <InputNumber {...integerInputProps} id={id('decimals')} min={0} max={4} placeholder="as the field" style={{ width: '100%' }}
              value={line.decimals ?? null} onChange={(v) => onChange({ decimals: orUnset(v) })} />
          </OptionItem>
        </Col>
      )}
      {traits.join && (
        <Col span={12}>
          <OptionItem id={id('join')} label="Between items">
            <FormSelect id={id('join')} variant="default" style={{ width: '100%' }} options={JOIN_OPTIONS} placeholder="4 / 8"
              value={line.join} onChange={(v) => onChange({ join: orUnset(v) })} />
          </OptionItem>
        </Col>
      )}
      {traits.pattern && <Col span={24}>{text('pattern', 'Pattern', { max: 60, extra: traits.pattern })}</Col>}
    </Row>
  );
};

/**
 * How one sticker line prints, by kind: a field's font and the text around its value, the
 * size grid's cells and totals, a barcode's type and size. The content of the line's
 * format popover; every control is off while the template is locked.
 */
const StickerLineOptions = ({ line, idp, locked, onChange }) => {
  const props = { line, idp, locked, onChange };
  return (
    <Form layout="vertical" component="div" size="small" disabled={locked} style={{ width: 340 }}>
      {line.kind === STICKER_LINE_KIND.SIZE_GRID && <StickerGridOptions {...props} />}
      {line.kind === STICKER_LINE_KIND.BARCODE && <StickerBarcodeOptions {...props} />}
      {(line.kind || STICKER_LINE_KIND.FIELD) === STICKER_LINE_KIND.FIELD && <FieldOptions {...props} />}
    </Form>
  );
};

export default StickerLineOptions;
