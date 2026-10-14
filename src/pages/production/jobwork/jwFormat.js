/** Display helpers shared by the Job Work screens. */
import { formatAmount, formatDate } from '../../../utils/formatters';

export const fmtQty = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : Number(n).toLocaleString('en-IN'));

export const fmtDate = (d) => (d ? formatDate(d) : '—');

/** `₹1,23,456.5`: up to two decimals, none added; no value reads ₹0. */
export const fmtMoney = (n) => formatAmount(n, { prefix: '₹', maxDecimals: 2 });

export const pct = (a, b) => (b ? Math.min(100, Math.round((Number(a) / Number(b)) * 100)) : 0);

/** "1,655 kg · 4,124 pcs" from [{ uom, qty }]. */
export const fmtByUom = (rows = []) => (rows.length ? rows.map((r) => `${fmtQty(r.qty)} ${r.uom}`).join(' · ') : '—');

/** Stable key for a colour × stage cell's DOM id (error summary scrolls to it). */
export const cellId = (jobId, colour, stage) => `jw-cell-${jobId}-${String(colour).replace(/\W+/g, '_')}-${stage}`;

/** Key of a pull-back request line: colour × stage reached. */
export const lineKey = (colour, stage) => `${colour}|${stage}`;

/** Key of a colour × size cell in the return grids. */
export const sizeKey = (colour, size) => `${colour}|${size}`;
