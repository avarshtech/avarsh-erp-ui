import { useId } from 'react';

// Five rounded bars of a sound wave, tallest in the middle — Laya is rhythm.
const BARS = [
  { x: 17.5, h: 12 },
  { x: 24.75, h: 22 },
  { x: 32, h: 30 },
  { x: 39.25, h: 22 },
  { x: 46.5, h: 12 },
];

/**
 * Laya AI's mark: a glowing orb holding a sound wave whose bars pulse like an equaliser, a spark
 * orbiting its rim, and a colour aura turning and breathing behind it. `thinking` makes the bars
 * dance and the aura race. The aura reaches past the mark's box; all motion lives in genie.css and
 * stops for users who ask for reduced motion.
 */
export default function LayaMark({ size = 40, thinking = false, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const core = `laya-core-${uid}`;
  const bar = `laya-bar-${uid}`;
  return (
    <span
      className={`laya-mark${thinking ? ' is-thinking' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--laya-size': `${size}px` }} aria-hidden="true"
    >
      <span className="laya-aura" />
      <span className="laya-aura laya-aura-inner" />
      <svg viewBox="0 0 64 64" width={size} height={size} focusable="false" className="laya-orb">
        <defs>
          <radialGradient id={core} cx="0.32" cy="0.28" r="0.9">
            <stop offset="0" stopColor="#5eead4" />
            <stop offset="0.5" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#1e1b4b" />
          </radialGradient>
          <linearGradient id={bar} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffffff" />
            <stop offset="1" stopColor="#ccfbf1" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="30" fill={`url(#${core})`} />
        <circle cx="32" cy="32" r="29.4" fill="none" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1.2" />
        <ellipse cx="24" cy="15" rx="12" ry="5.5" fill="rgba(255, 255, 255, 0.16)" />
        {BARS.map((b, i) => (
          <rect key={b.x} className={`laya-bar b${i + 1}`} x={b.x - 2.6} y={32 - b.h / 2} width="5.2" height={b.h} rx="2.6"
            fill={`url(#${bar})`} />
        ))}
        <g className="laya-orbit">
          <circle cx="32" cy="3.6" r="2.6" fill="#fde68a" />
        </g>
      </svg>
    </span>
  );
}
