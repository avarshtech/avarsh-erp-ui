import dayjs from 'dayjs';

/**
 * Deadline colour-coding shared by the Sample Request list, form, detail,
 * dashboard widgets and alert strip (PRD v3 §8.1/§12.2 — one threshold
 * everywhere so a deadline never reads as two severities in two places).
 * Green > 7d · Amber 3–7d · Red < 3d or overdue.
 */

export const daysRemaining = (dateStr) => {
  if (!dateStr) return null;
  return dayjs(dateStr).startOf('day').diff(dayjs().startOf('day'), 'day');
};

export const deadlineRag = (days) => {
  if (days == null) return null;
  if (days < 3) return 'red';
  if (days <= 7) return 'amber';
  return 'green';
};

export const deadlineLabel = (days) => {
  if (days == null) return '—';
  if (days < 0) return `${-days}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d remaining`;
};

// AntD Tag colors per RAG state
export const RAG_TAG_COLOR = { green: 'green', amber: 'orange', red: 'red' };
