import { hashString, text } from './util.js';

/**
 * Fabric colour names as the ERP stores them (free text such as "Navy", "Bottle Green",
 * "Off White / Ecru") mapped to a dye-like swatch. Longer, more specific names come first so
 * "sky blue" wins over "blue" and "off white" over "white".
 */
const NAMED = [
  ['off white', '#efe9dc'], ['ecru', '#e8dfc9'], ['cream', '#f1e7cf'], ['ivory', '#f4eedd'],
  ['optic white', '#fbfbf8'], ['white', '#f6f6f2'],
  ['grey melange', '#a7aaae'], ['melange', '#a7aaae'], ['charcoal', '#3d4148'], ['anthra', '#3a3d42'],
  ['silver', '#c3c6cb'], ['grey', '#8f949b'], ['gray', '#8f949b'], ['black', '#232427'],
  ['navy', '#1f2a48'], ['indigo', '#2e3a6e'], ['denim', '#3b5378'], ['royal', '#2f4fb0'],
  ['sky', '#8cb8e0'], ['powder', '#b4cfe8'], ['turquoise', '#3bb3b0'], ['teal', '#1f7f7a'],
  ['aqua', '#69c6c2'], ['blue', '#3f64a8'],
  ['bottle green', '#1f4d3a'], ['olive', '#6b6f3a'], ['khaki', '#a89a6e'], ['mint', '#a6d8c0'],
  ['sage', '#9fb39a'], ['lime', '#a8c94a'], ['green', '#3e8a55'],
  ['mustard', '#c99a2e'], ['lemon', '#efe07a'], ['yellow', '#e9c74a'], ['gold', '#c9a24a'],
  ['peach', '#efb99a'], ['coral', '#e2785f'], ['orange', '#e0803a'], ['rust', '#a6532c'],
  ['maroon', '#6e2230'], ['wine', '#6b2238'], ['burgundy', '#6a1f33'], ['red', '#c23b3b'],
  ['fuchsia', '#c23b8a'], ['magenta', '#b23a8d'], ['pink', '#e7a3b6'], ['rose', '#d98a9a'],
  ['lilac', '#c3a8d6'], ['lavender', '#b8a9d9'], ['purple', '#6e4a99'], ['violet', '#6a4c9c'],
  ['beige', '#d9c7a7'], ['sand', '#d6c39d'], ['tan', '#b48a5a'], ['camel', '#b88b57'],
  ['brown', '#6e4b31'], ['chocolate', '#4e3424'], ['coffee', '#5a4030'],
];

/** Calm fallback swatches for names the table does not know. */
const FALLBACK = ['#5b7db1', '#4f9a8f', '#b07c4f', '#8a6fb0', '#c08a3e', '#6b8f5a', '#b5646b', '#5f6b7a'];

const cache = new Map();

export const fabricColour = (name) => {
  const key = text(name).toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const named = key ? NAMED.find(([word]) => key.includes(word)) : null;
  const hex = named ? named[1] : FALLBACK[hashString(key || 'fabric') % FALLBACK.length];
  cache.set(key, hex);
  return hex;
};

/** The first colour of a comma/slash separated list ("Navy, Black" → "Navy"). */
export const firstColourName = (value) => text(value).split(/[,/;|]/)[0].trim();
