import { useMemo } from 'react';
import { Input, Segmented, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { FIELD_CATALOGUE, FIELD_CATEGORIES, askKeyFor, getFieldMeta, isAskBinding } from '../../../utils/expDocTemplateSchema';
import AskBindingOption, { ASK_MODE } from './AskBindingOption';

const { Text } = Typography;

const MODE = { FIELD: 'ERP field', FIXED: 'Fixed text', ASK: ASK_MODE };

/**
 * Choose what a template field is bound to (§10.3).
 *
 * An admin may pick an ERP field from the catalogue, or type a fixed literal — and
 * nothing else. That restriction is the point: a template that could name an unbound
 * field would push manual entry onto every document built from it, which is exactly
 * what this module exists to remove. A carton-sticker line may also be asked once per
 * print run: `ask` (its label, and the keys the template's other questions use) offers it.
 * `id` goes to the field select; `exclude` hides the catalogue paths a caller never prints.
 *
 * A `fixed:` prefix is how a literal travels through the same single string the
 * renderer already resolves, so no caller needs to know which kind it got.
 */
const FieldBindingPicker = ({ value, onChange, disabled, categories, exclude, placeholder, ask, id }) => {
  const isFixed = typeof value === 'string' && value.startsWith('fixed:');
  const isAsk = isAskBinding(value);
  /*
   * The mode is DERIVED from the value, never held.
   *
   * These pickers sit in ordered lists keyed by position, so reordering or deleting
   * a row hands the same component instance a different value. Local mode state
   * survived that: the picker kept showing "Fixed text" for a row bound to a field,
   * and the next keystroke overwrote a binding with a literal. Switching mode writes
   * the value, and the value is what the mode reads back.
   */
  const mode = (isAsk && MODE.ASK) || (isFixed && MODE.FIXED) || MODE.FIELD;

  const options = useMemo(() => {
    const allowed = categories?.length ? new Set(categories) : null;
    return FIELD_CATEGORIES
      .filter((c) => !allowed || allowed.has(c.key))
      .map((c) => ({
        label: c.label,
        options: FIELD_CATALOGUE
          .filter((f) => f.category === c.key && !exclude?.includes(f.path))
          .map((f) => ({ value: f.path, label: f.label, path: f.path, sample: f.sample })),
      }))
      .filter((g) => g.options.length);
  }, [categories, exclude]);

  const meta = mode === MODE.FIELD && value ? getFieldMeta(value) : null;

  return (
    <Space orientation="vertical" size={4} style={{ width: '100%' }}>
      <Segmented
        size="small" disabled={disabled} value={mode} aria-label="Where the value comes from"
        options={ask || isAsk ? [MODE.FIELD, MODE.FIXED, MODE.ASK] : [MODE.FIELD, MODE.FIXED]}
        onChange={(m) => {
          // Switching kind clears the old value rather than carrying a path into a
          // literal (or the reverse), which would print the wrong thing silently.
          // The written value is also what puts the segmented control on the new
          // mode, so there is nothing else to keep in step.
          if (m === MODE.ASK) onChange(`ask:${askKeyFor(ask?.label, ask?.taken)}`);
          else onChange(m === MODE.FIXED ? 'fixed:' : undefined);
        }}
      />
      {mode === MODE.ASK && <AskBindingOption value={value} label={ask?.label} />}
      {mode === MODE.FIXED && (
        <Input
          size="small" name="bindingFixedText" aria-label="Fixed text" disabled={disabled} placeholder="Text printed verbatim, e.g. a licence number"
          value={value.slice('fixed:'.length)} onChange={(e) => onChange(`fixed:${e.target.value}`)}
        />
      )}
      {mode === MODE.FIELD && (
        <Select
          id={id} aria-label="ERP field" size="small" showSearch allowClear style={{ width: '100%' }} disabled={disabled}
          placeholder={placeholder || 'Pick a field from the catalogue'} optionFilterProp="label"
          value={value ?? undefined} onChange={onChange} options={options}
          optionRender={(opt) => (
            <Space orientation="vertical" size={0}>
              <Text>{opt.data.label}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>{opt.data.path}</Text>
            </Space>
          )}
        />
      )}
      {meta && (
        <Tooltip title={`Sample: ${meta.sample ?? '—'}`}>
          <Tag style={{ marginInlineEnd: 0 }}>{meta.path}</Tag>
        </Tooltip>
      )}
      {mode === MODE.FIELD && value && !meta && (
        <Text type="warning" style={{ fontSize: 11 }}>
          {`"${value}" is not in the field catalogue — it will render blank.`}
        </Text>
      )}
    </Space>
  );
};

export default FieldBindingPicker;
