import { COLOR_HEX_MAP } from '../../../utils/colorConstants';

/** Select value standing for "the new sub-category / item type named in this form". */
export const NEW = '__new__';

/**
 * Reads what the user typed ("180 GSM single jersey black") into a starting point for the new
 * material: the item type it most likely is, and attribute values it already states. Guesses
 * only pre-fill the form — the user sees and confirms every one before anything is saved.
 */
export const tokens = (text) =>
  String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);

const overlap = (wanted, name) => {
  const have = new Set(tokens(name));
  return wanted.filter((w) => have.has(w)).length;
};

/** The item type (and so sub-category) whose names share the most words with the text. */
export function guessClassifiers(category, text) {
  const wanted = tokens(text);
  let best = null;
  (category?.subCategories || []).forEach((sub) => {
    (sub.itemTypes || []).forEach((type) => {
      const score = overlap(wanted, type.name) * 2 + overlap(wanted, sub.name);
      if (score > 0 && (!best || score > best.score)) best = { score, sub, type };
    });
    const subOnly = overlap(wanted, sub.name);
    if (subOnly > 0 && (!best || subOnly > best.score)) best = { score: subOnly, sub, type: null };
  });
  return best;
}

const titleCase = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());

const colourIn = (text) => {
  const lower = ` ${String(text || '').toLowerCase()} `;
  const hit = Object.keys(COLOR_HEX_MAP)
    .filter((name) => lower.includes(` ${name} `))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? titleCase(hit) : undefined;
};

const RULES = [
  { match: /gsm|weight/i, read: (t) => t.match(/(\d{2,4})\s*g(?:sm|pm)?\b/i)?.[1] },
  { match: /colou?r|shade/i, read: colourIn },
  { match: /width|dia/i, read: (t) => t.match(/(\d{2,3})\s*(?:"|''|inch(?:es)?\b|in\b|cm\b)/i)?.[1] },
  { match: /count|yarn/i, read: (t) => t.match(/\b(\d{2,3})\s*s\b/i)?.[1] },
  { match: /composition|content|blend/i, read: (t) => t.match(/(\d{1,3}\s*%\s*[a-z]+(?:\s*\/?\s*\d{1,3}\s*%\s*[a-z]+)*)/i)?.[1] },
];

/** { [attributeId]: value } for the attributes the text states outright. */
export function guessAttributes(attributes, text) {
  const values = {};
  (attributes || []).forEach((attr) => {
    const rule = RULES.find((r) => r.match.test(attr.attributeName || ''));
    const value = rule?.read(text);
    if (value) values[attr.id] = value;
  });
  return values;
}

/**
 * Item Master's attribute key rule (ItemMaster.jsx toCamelCase), which the server checks too:
 * "Fabric Type" → "fabricType", "GSM" → "gsm".
 */
export function attributeKey(name) {
  if (!name) return '';
  if (!name.includes(' ')) return name.toLowerCase();
  return name.split(' ')
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}
