import { useRef } from 'react';
import { useQuickCreate } from '../../../components/quickcreate/QuickCreateProvider';
import { canQuickCreate } from '../../../components/quickcreate/quickCreateTypes';
import { fieldValue } from './masterGenieSnapshot';

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });
async function waitFor(check, timeout = 2500) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const found = check();
    if (found) return found;
    await wait(50);
  }
  return check();
}

const esc = (s) => (window.CSS?.escape ? window.CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'));
const fieldItem = (name) => document.querySelector(`#${esc(name)}, [id$="_${esc(name)}"]`)?.closest('.ant-form-item');
const pulse = (el) => {
  if (!el) return;
  el.classList.remove('laya-pulse');
  void el.offsetWidth; // restart the animation when pointed at twice
  el.classList.add('laya-pulse');
  setTimeout(() => el.classList.remove('laya-pulse'), 2600);
};
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const recordLabel = (r) => r?.name || r?.itemName || r?.styleNo || r?.branchName || r?.processName || r?.overheadName
  || r?.partName || r?.attributeName || r?.code || `record ${r?.id}`;

/**
 * Carries out Laya AI's screen changes on the Master Data page — switch master, search, open a
 * record, fill the form (never save), point at something — and its new-item cards, which open the
 * find-or-create drawer. `screen.current` is { ref, entity } of the master that registered last.
 */
export default function useMasterGenieActions({ items, select, screen }) {
  const { open } = useQuickCreate();
  const undoRef = useRef(null);
  const current = () => screen.current?.ref?.current || null;

  const tools = {
    open_master: async ({ entity }) => {
      const target = items.find((i) => i.key === entity);
      if (!target) throw new Error(`There is no master "${entity}" you can open`);
      select(entity);
      if (!(await waitFor(() => screen.current?.entity === entity && current(), 3000))) {
        throw new Error(`The form here has unsaved changes — choose Leave or Stay, then ask again to open ${target.label}`);
      }
      return `Opened ${target.label}`;
    },
    search_list: async ({ text }) => {
      const s = current();
      if (!s?.search) throw new Error('This screen has no list search');
      s.search(text || '');
      return text ? `Searched "${text}"` : 'Cleared the search';
    },
    open_record: async ({ id }) => {
      const s = current();
      const record = s?.rows?.find((r) => sameId(r.id, id));
      if (!record) throw new Error('That record is not in this list');
      s.openRecord(record);
      return `Opened ${recordLabel(record)}`;
    },
    fill_form: async ({ fields = [], recordId }) => {
      let s = current();
      if (!s?.form) throw new Error('This screen has no form to fill');
      if (s.fillable === false) throw new Error('New items are added with the New material card, not this form');
      const before = { entity: screen.current?.entity, wasOpen: s.isOpen, recordId: s.recordId, values: s.isOpen ? s.form.getFieldsValue(true) : null };
      if (recordId != null) {
        if (!sameId(s.recordId, recordId)) {
          const record = s.rows?.find((r) => sameId(r.id, recordId));
          if (!record) throw new Error('That record is not in this list');
          s.openRecord(record);
        }
      } else if (!s.isOpen || s.recordId) {
        if (!s.openNew) throw new Error('You do not have the right to add here');
        s.openNew();
      }
      s = await waitFor(() => {
        const a = current();
        return a?.isOpen && (recordId == null ? !a.recordId : sameId(a.recordId, recordId)) ? a : null;
      });
      if (!s) throw new Error('The form did not open');
      await wait(150); // the screen resets or loads the form as it opens; fill after that
      const values = Object.fromEntries(fields.filter((f) => f?.field).map((f) => [f.field, fieldValue(f)]));
      s.form.setFieldsValue(values);
      s.markDirty?.();
      undoRef.current = before;
      Object.keys(values).forEach((f, i) => {
        const el = fieldItem(f);
        if (el && i === 0) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        pulse(el);
      });
      const n = Object.keys(values).length;
      return `Filled ${n} field${n === 1 ? '' : 's'} — check them and save`;
    },
    focus_field: async ({ target }) => {
      const area = ['add', 'search', 'list'].includes(target);
      const el = area
        ? document.querySelector(`[data-laya="${target}"]`)
          || (target === 'add' ? [...document.querySelectorAll('button')].find((b) => /^\s*(Add|New)\b/i.test(b.textContent || '')) : null)
        : fieldItem(target);
      if (!el) throw new Error(`Could not find ${target} on the screen`);
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      pulse(el.closest?.('.ant-form-item') || el);
      return `Showing ${target}`;
    },
  };

  const applyActions = async (actions) => {
    const results = [];
    for (const action of actions) {
      const run = tools[action.tool];
      try {
        if (!run) throw new Error(`This screen cannot do ${action.tool}`);
        results.push({ ok: true, changed: action.tool === 'fill_form', text: await run(action.args || {}) });
      } catch (err) {
        results.push({ ok: false, text: err.message || 'That did not work' });
        if (action.tool === 'open_master') break; // the rest was meant for the other master
      }
    }
    return results;
  };

  const undo = () => {
    const u = undoRef.current;
    const s = current();
    undoRef.current = null;
    if (!u || !s || screen.current?.entity !== u.entity) return;
    if (!u.wasOpen) s.close?.();
    else if (u.values) { s.form.resetFields(); s.form.setFieldsValue(u.values); }
  };

  const openMaterial = (p, onDone) => open('item', {
    prefill: { text: p.data.proposal?.variantName, category: p.data.category, proposal: p.data.proposal },
    onCreated: (variant, result) => {
      current()?.refresh?.();
      onDone(result?.variantCreated === false
        ? `${variant.variantName} already exists — used it, nothing new was created`
        : `Created ${variant.variantName} (${variant.variantCode})`);
    },
  });

  const editProposal = (p, onDone) => { if (p.kind === 'material') openMaterial(p, onDone); };
  const confirmProposal = async (p, onDone) => {
    if (p.kind !== 'material') return { ok: false, text: 'That card cannot be used here' };
    if (!canQuickCreate('item')) return { ok: false, text: 'You need "Items → Add" permission. Ask an admin.' };
    openMaterial(p, onDone);
    return { opened: true };
  };

  return { applyActions, undo, confirmProposal, editProposal };
}
