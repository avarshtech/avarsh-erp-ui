import { useMemo, useState } from 'react';
import { Input } from 'antd';

/**
 * The shared machinery behind TimeInput and DateInput: a field that holds only
 * digits and lays them into a fixed template as you type.
 *
 * <p>The template is the whole trick. "HH:MM" is on screen from the moment the
 * field is empty, greyed out, and the typed digits replace it from the left. The
 * separator is never typed and never deleted - it belongs to the template - so
 * after two digits it simply turns from grey to black and the caret is already
 * past it. There is nowhere to put a fifth digit, which is what used to let
 * "12344" into a time field.</p>
 *
 * <p>Digits are the only state. Everything on screen is derived from them, so
 * the field cannot drift into a shape the parser then has to rescue.</p>
 */

/** Lay digits into the template, stopping where the digits run out. */
const layout = (digits, template) => {
  let out = '';
  let d = 0;
  for (const ch of template) {
    if (d >= digits.length) break;
    if (ch === '#') { out += digits[d]; d += 1; } else { out += ch; }
  }
  // A separator that the next digit sits behind is shown now, not later: it is
  // what moves the caret into the minutes without the user pressing anything.
  const next = template[out.length];
  return next && next !== '#' && digits.length > 0 ? out + next : out;
};

const MaskedInput = ({
  template,          // e.g. '##:##' or '##/##/####'
  placeholder,       // e.g. 'HH:MM' - also the greyed template shown while empty
  digits,            // the current digits, controlled by the caller
  onDigits,          // (nextDigits) => void
  onCommit,          // called on blur and Enter, after the digits settle
  suffix,
  prefix,
  disabled,
  status,
  style,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const max = useMemo(() => template.split('').filter((c) => c === '#').length, [template]);
  const shown = layout(digits, template);

  // What is left of the template, greyed, sitting exactly where the next digits
  // will land. Hidden from assistive tech: it is decoration, not content.
  const ghost = placeholder.slice(shown.length);

  const handleChange = (e) => {
    const raw = e.target.value;
    let next = raw.replace(/\D/g, '').slice(0, max);
    // Backspacing over a separator leaves the digits unchanged, so the keystroke
    // would do nothing at all. Take the digit before it instead.
    if (next === digits && raw.length < shown.length) next = next.slice(0, -1);
    onDigits(next);
  };

  return (
    <span className={`masked-input${disabled ? ' masked-input-disabled' : ''}`} style={style}>
      <Input
        {...rest}
        value={shown}
        disabled={disabled}
        status={status}
        prefix={prefix}
        suffix={suffix}
        placeholder={focused ? '' : placeholder}
        inputMode="numeric"
        autoComplete="off"
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); onCommit?.(); }}
        onPressEnter={onCommit}
      />
      {/* Only while there is something typed: an empty field shows the
          placeholder instead, which antd already greys for us. */}
      {shown && ghost && (
        <span className="masked-input-ghost" aria-hidden="true">
          <span className="masked-input-ghost-typed">{shown}</span>
          {ghost}
        </span>
      )}
    </span>
  );
};

export default MaskedInput;
