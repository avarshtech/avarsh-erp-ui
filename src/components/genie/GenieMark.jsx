import { useId } from 'react';

/** A four-point sparkle centred on (x, y), reaching r in each direction. */
const sparkle = (x, y, r) => {
  const k = r / 3.2;
  return `M${x} ${y - r} L${x + k} ${y - k} L${x + r} ${y} L${x + k} ${y + k} L${x} ${y + r} L${x - k} ${y + k} L${x - r} ${y} L${x - k} ${y - k} Z`;
};

/**
 * The Help Genie: a small blue genie in a jewelled turban, rising on a curl of smoke, with
 * twinkling sparkles. It floats, blinks and sways its tail; `thinking` makes the sparkles busy.
 * All motion lives in genie.css and stops for users who ask for reduced motion.
 */
export default function GenieMark({ size = 40, thinking = false, className = '' }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const skin = `genie-skin-${uid}`;
  const gold = `genie-gold-${uid}`;
  const gem = `genie-gem-${uid}`;
  return (
    <svg
      viewBox="8 6 48 54" width={size} height={size} aria-hidden="true" focusable="false"
      className={`genie-mark${thinking ? ' is-thinking' : ''}${className ? ` ${className}` : ''}`}
    >
      <defs>
        <linearGradient id={skin} x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#ecfeff" />
          <stop offset="0.5" stopColor="#a5f3fc" />
          <stop offset="1" stopColor="#60a5fa" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fef08a" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
        <radialGradient id={gem} cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fce7f3" />
          <stop offset="1" stopColor="#db2777" />
        </radialGradient>
      </defs>

      <g className="genie-mark-figure">
        {/* the curl of smoke the genie rises from */}
        <path className="genie-mark-tail" d="M29.5 43 C 23.5 50, 28.5 58, 36 56 C 41.5 54.5, 40.5 48.5, 35.5 49.5 C 32.8 50.1, 33.2 53.4, 35.8 53"
          fill="none" stroke={`url(#${skin})`} strokeWidth="4.6" strokeLinecap="round" />
        {/* torso, tucked under the head so the two read as one figure */}
        <path d="M21 31.5 C 21 40.5, 26 45.5, 32 45.5 C 38 45.5, 43 40.5, 43 31.5 Z" fill={`url(#${skin})`} />
        {/* sash */}
        <path d="M23.4 39 Q 32 43, 40.6 39" fill="none" stroke={`url(#${gold})`} strokeWidth="2.6" strokeLinecap="round" />
        {/* head */}
        <circle cx="32" cy="23" r="11" fill={`url(#${skin})`} />
        {/* turban, top-knot and jewel */}
        <path d="M20.6 21 C 20 11.5, 44 11.5, 43.4 21 C 39.2 17.6, 24.8 17.6, 20.6 21 Z" fill={`url(#${gold})`} />
        <circle cx="32" cy="10.8" r="2.2" fill={`url(#${gold})`} />
        <circle cx="32" cy="16.4" r="2.5" fill={`url(#${gem})`} />
        {/* face */}
        <g className="genie-mark-eyes">
          <ellipse cx="27.8" cy="24" rx="1.9" ry="2.5" fill="#1e1b4b" />
          <ellipse cx="36.2" cy="24" rx="1.9" ry="2.5" fill="#1e1b4b" />
          <circle cx="28.4" cy="23.2" r="0.65" fill="#ffffff" />
          <circle cx="36.8" cy="23.2" r="0.65" fill="#ffffff" />
        </g>
        <circle cx="25.2" cy="27.6" r="1.6" fill="#f9a8d4" opacity="0.75" />
        <circle cx="38.8" cy="27.6" r="1.6" fill="#f9a8d4" opacity="0.75" />
        <path d="M28.8 28.4 Q 32 31.4, 35.2 28.4" fill="none" stroke="#1e1b4b" strokeWidth="1.6" strokeLinecap="round" />
      </g>

      {/* sparkles */}
      <path className="genie-mark-spark s1" d={sparkle(49.5, 12.5, 4.6)} fill={`url(#${gold})`} />
      <path className="genie-mark-spark s2" d={sparkle(14, 17, 3.2)} fill="#fde68a" />
      <path className="genie-mark-spark s3" d={sparkle(49.5, 37, 2.8)} fill="#ffffff" />
    </svg>
  );
}
