/**
 * Shared rules for showing strength figures, matching the server's Excel and PDF
 * (StrengthLayout): Absent % turns amber at 10 and red at 15.
 */
export const WARN_PCT = 10;
export const ALERT_PCT = 15;

/** Text colour per tone. Table cell tints are in strengthReport.css (index.css forces cell backgrounds). */
export const TONE = {
  none: { color: undefined },
  warn: { color: '#d48806' },
  alert: { color: '#cf1322' },
};

/** The grand-total fill; a table footer row is not covered by index.css's cell rule. */
export const GRAND_FILL = 'var(--primary-color)';

export const toneOf = (pct) => {
  if (pct === null || pct === undefined) return 'none';
  if (pct >= ALERT_PCT) return 'alert';
  return pct >= WARN_PCT ? 'warn' : 'none';
};

/** Half days arrive as 36.5; whole numbers as 36. */
export const num = (value) => (value === null || value === undefined ? '-' : Number(value).toLocaleString('en-IN'));

/** As the PDF prints it: one decimal, a plain 0% for nobody absent, a dash when nobody was marked. */
export const pct = (value) => {
  if (value === null || value === undefined) return '-';
  return Number(value) === 0 ? '0%' : `${Number(value).toFixed(1)}%`;
};

export const COUNTING_NOTE = 'Present = Present + On duty + ½ Half day.  Absent = Absent + Leave + ½ Half day.  '
  + 'Off = Weekly off / Holiday.  Absent % = Absent ÷ (Present + Absent).';

/** The figure columns, with Off and Not Marked only when the day has any. */
export const metricColumns = (report, { withNewJoiners = true } = {}) => [
  ...(withNewJoiners ? [{ key: 'newJoiners', title: 'New Joiners' }] : []),
  { key: 'strength', title: 'Strength' },
  { key: 'present', title: 'Present' },
  { key: 'absent', title: 'Absent' },
  ...(report?.hasOff ? [{ key: 'off', title: 'Off' }] : []),
  ...(report?.hasNotMarked ? [{ key: 'notMarked', title: 'Not Marked' }] : []),
  { key: 'absentPct', title: 'Absent %', percent: true },
];
