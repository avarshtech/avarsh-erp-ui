/**
 * Centralized input restriction helpers for Ant Design InputNumber fields.
 * Prevents typing of letters, special characters, and other non-numeric input.
 */

const NAVIGATION_KEYS = [
  'Backspace', 'Delete', 'Tab',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  'Home', 'End', 'Enter',
];

/**
 * onKeyDown handler for InputNumber that blocks non-numeric characters.
 * @param {KeyboardEvent} e
 * @param {{ allowDecimal?: boolean, allowNegative?: boolean }} [options]
 */
export function numericKeyDown(e, options = {}) {
  const { allowDecimal = true, allowNegative = false } = options;

  // Allow Ctrl/Cmd combos (copy, paste, cut, select all, undo)
  if (e.ctrlKey || e.metaKey) return;

  // Allow navigation keys
  if (NAVIGATION_KEYS.includes(e.key)) return;

  // Allow digits 0-9
  if (/^[0-9]$/.test(e.key)) return;

  // Allow decimal point
  if (e.key === '.' && allowDecimal) return;

  // Allow minus sign
  if (e.key === '-' && allowNegative) return;

  // Block everything else
  e.preventDefault();
}

/**
 * Parser function for InputNumber that strips non-numeric characters from pasted/entered text.
 * @param {string} value
 * @param {{ allowDecimal?: boolean, allowNegative?: boolean }} [options]
 * @returns {string}
 */
export function numericParser(value, options = {}) {
  const { allowDecimal = true, allowNegative = false } = options;

  if (value == null) return '';
  let str = String(value);

  // Strip commas (pasted formatted numbers like 1,000.50)
  str = str.replace(/,/g, '');

  if (allowDecimal) {
    // Keep digits and first decimal point only
    str = str.replace(/[^0-9.]/g, '');
    const parts = str.split('.');
    if (parts.length > 2) {
      str = parts[0] + '.' + parts.slice(1).join('');
    }
  } else {
    // Keep digits only
    str = str.replace(/[^0-9]/g, '');
  }

  if (allowNegative && String(value).startsWith('-')) {
    str = '-' + str;
  }

  return str;
}

/** Pre-built props for decimal InputNumber fields (most common) */
export const numericInputProps = {
  onKeyDown: (e) => numericKeyDown(e),
  parser: (v) => numericParser(v),
  inputMode: 'decimal',
};

/** Pre-built props for integer-only InputNumber fields */
export const integerInputProps = {
  onKeyDown: (e) => numericKeyDown(e, { allowDecimal: false }),
  parser: (v) => numericParser(v, { allowDecimal: false }),
  inputMode: 'numeric',
};

/**
 * Returns onFocus/onBlur handlers that clear 0 on focus and restore 0 on blur.
 * Only triggers when value is exactly 0 (strict equality).
 * @param {number|null} value - current value of the InputNumber
 * @param {function} onChange - the onChange handler to call
 * @returns {{ onFocus: function, onBlur: function }}
 */
export const getZeroClearHandlers = (value, onChange) => ({
  onFocus: () => { if (value === 0) onChange(null); },
  onBlur: () => { if (value === null || value === undefined || value === '') onChange(0); },
});

/**
 * onKeyDown handler for auto-formatted ID inputs (CostingId, Order No).
 * Only allows digits; blocks Delete key entirely; blocks Backspace into the prefix.
 * @param {KeyboardEvent} e
 * @param {string} prefix - the fixed prefix (e.g. 'CST/' or 'SG/')
 */
export function formattedIdKeyDown(e, prefix) {
  // Allow Ctrl/Cmd combos (copy, paste, select all, undo)
  if (e.ctrlKey || e.metaKey) return;
  // Allow digits 0-9
  if (/^[0-9]$/.test(e.key)) return;
  // Allow navigation keys (except Delete and Backspace — handled below)
  if (['Tab', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
  // Backspace: block if cursor is at or before the prefix
  if (e.key === 'Backspace') {
    const pos = e.target.selectionStart;
    if (pos <= prefix.length) e.preventDefault();
    return;
  }
  // Block Delete key and all other keys
  e.preventDefault();
}
