/**
 * The template register's shape: templates grouped by buyer, and each buyer's
 * revisions folded into template "families" (one card per template code).
 *
 * Packing-list and invoice templates belong to a real buyer (buyerId); carton-sticker
 * templates are still mock rows naming a buyer by its commercial-profile name, so they
 * join a buyer by name, and any that match no buyer are listed as demo data.
 */
import { DOC_TYPE, TEMPLATE_STATUS } from '../../../utils/expDocConstants';
import { SYSTEM_TEMPLATES, TEMPLATE_SOURCE } from '../../../utils/expDocSystemTemplates';
import { normBuyerName } from '../../../utils/expDocTemplateSchema';

export const RAIL_KEY = { STANDARD: 'standard', DEMO_STICKERS: 'demo-stickers' };

export const buyerKey = (id) => `buyer:${id}`;

const countsOf = (list) => {
  const active = (type) => list.filter((t) => !t.isSystem && t.docType === type && t.status === TEMPLATE_STATUS.ACTIVE).length;
  return {
    pl: active(DOC_TYPE.PACKING_LIST),
    inv: active(DOC_TYPE.INVOICE),
    stk: active(DOC_TYPE.STICKER),
    drafts: list.filter((t) => t.status === TEMPLATE_STATUS.DRAFT).length,
    total: list.filter((t) => !t.isSystem).length,
  };
};

export const groupTemplatesByBuyer = (templates, buyers) => {
  const groups = new Map();
  const ensure = (key, meta) => {
    if (!groups.has(key)) groups.set(key, { key, templates: [], ...meta });
    return groups.get(key);
  };
  ensure(RAIL_KEY.STANDARD, { title: 'Standard & any-buyer', standard: true });
  (buyers || []).forEach((b) => ensure(buyerKey(b.id), { buyerId: b.id, title: b.name, inactive: b.active === false }));
  const byName = new Map((buyers || []).map((b) => [normBuyerName(b.name), b]));

  (templates || []).forEach((t) => {
    if (t.source === TEMPLATE_SOURCE.API) {
      const group = t.buyerId == null
        ? groups.get(RAIL_KEY.STANDARD)
        : ensure(buyerKey(t.buyerId), { buyerId: t.buyerId, title: t.buyerName || `Buyer ${t.buyerId}` });
      group.templates.push(t);
      return;
    }
    if (!t.buyerCode) { groups.get(RAIL_KEY.STANDARD).templates.push(t); return; }
    const buyer = byName.get(normBuyerName(t.buyerName));
    if (buyer) ensure(buyerKey(buyer.id), { buyerId: buyer.id, title: buyer.name }).templates.push(t);
    else ensure(RAIL_KEY.DEMO_STICKERS, { title: 'Sticker templates (demo data)', demo: true }).templates.push(t);
  });

  groups.get(RAIL_KEY.STANDARD).templates.unshift(
    ...Object.values(SYSTEM_TEMPLATES).map((t) => ({ ...t, usage: { total: 0 } })),
  );
  return [...groups.values()].map((g) => ({ ...g, counts: countsOf(g.templates) }));
};

/**
 * One family per template code, newest revision first. The card leads with the ACTIVE
 * revision (what documents can use), then an open draft, then the latest.
 */
export const familiesOf = (templates) => {
  const map = new Map();
  (templates || []).forEach((t) => {
    const key = `${t.source}|${t.templateCode}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  });
  return [...map.entries()].map(([key, revs]) => {
    const revisions = [...revs].sort((a, b) => (b.version || 0) - (a.version || 0));
    const active = revisions.find((r) => r.status === TEMPLATE_STATUS.ACTIVE) || null;
    const draft = revisions.find((r) => r.status === TEMPLATE_STATUS.DRAFT) || null;
    const head = active || draft || revisions[0];
    return { key, head, active, draft, revisions, docType: head.docType, name: head.name };
  }).sort((a, b) => Number(Boolean(b.head.isSystem)) - Number(Boolean(a.head.isSystem))
    || String(a.name).localeCompare(String(b.name)));
};
