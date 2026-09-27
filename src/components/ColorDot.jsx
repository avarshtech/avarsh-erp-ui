import { memo } from 'react';

/** A small colour swatch for order colours (hex from the order context). */
const ColorDot = memo(function ColorDot({ hex, name, size = 12 }) {
  return (
    <span
      role="img"
      aria-label={name ? `${name} swatch` : 'colour swatch'}
      title={name}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: hex || 'var(--border-color)',
        border: '1px solid var(--border-color, #d9d9d9)',
        verticalAlign: 'middle',
        flexShrink: 0,
      }}
    />
  );
});

export default ColorDot;
