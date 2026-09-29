import { hasPermission } from '../../../utils/permissions';

/**
 * What Laya AI is told about the Master Data page with every question: which master is on show and
 * what the user may do there, the list as shown (a few fields per row), and the open form.
 */
const MAX_ROWS = 25;
const MAX_TEXT = 120;
const HIDDEN = /image|file|url|photo|logo|password/i;

const short = (v) => {
  if (v == null || v === '') return undefined;
  if (typeof v === 'string') return v.length > MAX_TEXT ? `${v.slice(0, MAX_TEXT)}…` : v;
  if (typeof v === 'number' || typeof v === 'boolean') return v;
  if (typeof v?.format === 'function') return v.format('YYYY-MM-DD'); // dayjs
  if (Array.isArray(v)) return v.slice(0, 20).map((x) => (typeof x === 'object' ? x?.name ?? x?.label ?? x?.id : x));
  return undefined;
};

const pick = (source, fields) => Object.fromEntries(fields
  .filter((f) => !HIDDEN.test(f))
  .map((f) => [f, short(source?.[f])])
  .filter(([, v]) => v !== undefined));

/** The list's fields: the table columns' dataIndex, plus the id. */
const listFields = (columns, rows) => {
  const fromColumns = (columns || []).map((c) => (typeof c.dataIndex === 'string' ? c.dataIndex : null)).filter(Boolean);
  if (fromColumns.length) return ['id', ...new Set(fromColumns)];
  return rows?.[0] ? Object.keys(rows[0]).slice(0, 12) : ['id'];
};

export function masterSnapshot({ item, items, adapter }) {
  const s = adapter;
  const fields = listFields(s?.columns, s?.rows);
  const form = s?.form;
  const errors = form ? form.getFieldsError().filter((e) => e.errors.length).map((e) => ({ field: e.name.join('.'), errors: e.errors })) : [];
  return {
    screen: {
      entity: item.key,
      label: item.label,
      canAdd: hasPermission(item.moduleId, 'add'),
      canUpdate: hasPermission(item.moduleId, 'update'),
      canFillForm: s ? s.fillable !== false : false,
    },
    masters: items.map((i) => ({ entity: i.key, label: i.label })),
    list: s?.rows ? {
      total: s.rows.length,
      search: s.searchText || '',
      rows: s.rows.slice(0, MAX_ROWS).map((r) => pick(r, fields)),
    } : null,
    form: form ? {
      open: !!s.isOpen,
      mode: s.recordId ? 'edit' : 'new',
      recordId: s.recordId ?? null,
      values: s.isOpen ? pick(form.getFieldsValue(true), Object.keys(form.getFieldsValue(true))) : {},
      errors,
    } : null,
  };
}

/** One fill_form field → the value the form gets: a number, a flag, a list (ids as numbers) or text. */
export function fieldValue({ number, flag, list, text }) {
  if (number != null) return number;
  if (flag != null) return flag;
  if (Array.isArray(list)) return list.map((v) => (/^\d+$/.test(String(v)) ? Number(v) : v));
  return text;
}
