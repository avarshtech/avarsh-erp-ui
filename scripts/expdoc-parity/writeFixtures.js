/**
 * The browser half of the export-documents parity harness (README.md): runs recorded calls of a pure
 * src/utils module and writes what they return, for the API's Java port to replay and match.
 *
 * Fixture file: erp-purchase/src/test/resources/expdoc-parity/<moduleName>.json, an array of
 *   { id, fn, args, output }   or, for a call the browser rejects,   { id, fn, args, throws }
 *
 * What makes a fixture trustworthy:
 *  - The function runs on the args AS WRITTEN: they are serialised to JSON and parsed back before
 *    the call, so the browser computed `output` from exactly the input the Java test reads.
 *  - `output` is plain JSON. undefined becomes null (also inside objects, so the key stays visible),
 *    NaN and ±Infinity become null (JSON has neither), -0 becomes 0, a Map becomes an object, a Set
 *    or a generator becomes an array. A function in an output fails the dump: it is not data.
 *  - Keys keep the order JavaScript gives them: array-index keys ("74", "104") first in numeric
 *    order, then the rest as inserted. Deterministic for a given source.
 *  - The file is ASCII: every other character is written as a \uXXXX escape.
 *  - A case may give `argsJson` (JSON text) instead of `args` when the KEY ORDER of the text matters:
 *    the browser re-orders keys on JSON.parse, the API's Jackson keeps the text's order, so only a
 *    text in a non-JavaScript order (as PostgreSQL jsonb returns sizes) proves the Java port re-orders.
 *    The text is written to the fixture verbatim.
 *  - A case that throws must say so (`throws: true`); any other throw fails the dump.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const API_ROOT = path.resolve(UI_ROOT, '..', 'erp-purchase');
const API_TEST_RESOURCES = path.join(API_ROOT, 'src', 'test', 'resources');

export const FIXTURE_DIR = path.join(API_TEST_RESOURCES, 'expdoc-parity');

class NotJsonError extends Error {}

const isIterator = (v) => typeof v?.next === 'function' && typeof v[Symbol.iterator] === 'function';

/** A value as plain JSON data, by the rules at the top of this file. */
export const jsonSafe = (value, where) => {
  if (value === undefined || value === null) return null;
  switch (typeof value) {
    case 'number':
      if (!Number.isFinite(value)) return null;
      return Object.is(value, -0) ? 0 : value;
    case 'string':
    case 'boolean':
      return value;
    case 'object':
      break;
    default:
      throw new NotJsonError(`${where}: a ${typeof value} is not JSON data`);
  }
  if (Array.isArray(value)) return value.map((v, i) => jsonSafe(v, `${where}[${i}]`));
  if (value instanceof Map) {
    return Object.fromEntries([...value].map(([k, v]) => [String(k), jsonSafe(v, `${where}.${String(k)}`)]));
  }
  if (value instanceof Set || isIterator(value)) return [...value].map((v, i) => jsonSafe(v, `${where}[${i}]`));
  if (typeof value.toJSON === 'function') return jsonSafe(value.toJSON(), where);
  const out = {};
  Object.keys(value).forEach((k) => {
    out[k] = jsonSafe(value[k], `${where}.${k}`);
  });
  return out;
};

const argsTextOf = (c) => {
  if (c.argsJson != null) {
    if (c.args !== undefined) throw new Error(`${c.id}: give args or argsJson, not both`);
    return c.argsJson;
  }
  return JSON.stringify(jsonSafe(c.args ?? [], `${c.id} args`));
};

const run = (c) => {
  const argsText = argsTextOf(c);
  let args;
  try {
    args = JSON.parse(argsText);
  } catch (e) {
    throw new Error(`${c.id}: argsJson is not JSON (${e.message})`);
  }
  if (!Array.isArray(args)) throw new Error(`${c.id}: args must be an array`);
  let output;
  try {
    // Materialised inside the try: a generator throws on its first step, not when it is called
    output = jsonSafe(c.fn(...args), `${c.id} output`);
  } catch (e) {
    if (e instanceof NotJsonError) throw e;
    if (!c.throws) throw new Error(`${c.id}: ${c.fn.name} threw "${e}"; mark the case throws: true if the browser means to`);
    return { args, argsText, thrown: `${e.name}: ${e.message}` };
  }
  if (c.throws) throw new Error(`${c.id}: ${c.fn.name} was expected to throw and returned`);
  return { args, argsText, output };
};

/**
 * Run `cases` and write them as the fixture file `<moduleName>.json`.
 *
 * cases: [{ id, fn, args | argsJson, throws? }] — `fn` is the imported function itself; its name is
 * what the fixture records and the Java test dispatches on.
 * options.api: the module namespace (`import * as api`). Given, every function the module exports
 * must be exercised by a case or named in options.notPorted ({ name: why }), so a new export cannot
 * slip past the Java port unnoticed.
 *
 * Returns { file, count, fns } for the dump to check.
 */
export const writeFixtures = (moduleName, cases, { api, notPorted = {} } = {}) => {
  if (!fs.existsSync(API_TEST_RESOURCES)) {
    throw new Error(`The API repo is not beside this one: ${API_TEST_RESOURCES} does not exist. `
      + 'Clone erp-purchase next to avarsh-erp-ui.');
  }
  if (!/^[A-Za-z][\w-]*$/.test(moduleName)) throw new Error(`Not a fixture name: ${moduleName}`);

  const ids = new Set();
  const fns = new Set();
  const entries = cases.map((c) => {
    if (!c?.id || ids.has(c.id)) throw new Error(`Case id missing or repeated: ${c?.id}`);
    ids.add(c.id);
    if (typeof c.fn !== 'function' || !c.fn.name) throw new Error(`${c.id}: fn must be the imported function itself`);
    if (api && api[c.fn.name] !== c.fn) throw new Error(`${c.id}: ${c.fn.name} is not ${moduleName}'s export of that name`);
    fns.add(c.fn.name);
    return { id: c.id, fn: c.fn.name, raw: c.argsJson != null, ...run(c) };
  });

  if (api) {
    const exported = Object.keys(api).filter((k) => typeof api[k] === 'function');
    const missing = exported.filter((k) => !fns.has(k) && !(k in notPorted));
    if (missing.length) throw new Error(`${moduleName}: no case exercises ${missing.join(', ')}; add cases or list them in notPorted`);
    const stale = Object.keys(notPorted).filter((k) => !exported.includes(k) || fns.has(k));
    if (stale.length) throw new Error(`${moduleName}: notPorted names ${stale.join(', ')}, which is not exported or has cases`);
  }

  // Raw args are spliced in as written; everything else is pretty-printed
  const rawArgs = [];
  const shaped = entries.map((e) => {
    const args = e.raw ? `__RAW_ARGS_${rawArgs.push(e.argsText) - 1}__` : e.args;
    return 'thrown' in e ? { id: e.id, fn: e.fn, args, throws: e.thrown } : { id: e.id, fn: e.fn, args, output: e.output };
  });
  const json = JSON.stringify(shaped, null, 2).replace(/"__RAW_ARGS_(\d+)__"/g, (_, i) => rawArgs[Number(i)]);
  // ASCII only: non-ASCII can only sit inside strings, where \uXXXX reads back the same, and the
  // separator U+241F, no-break spaces and BOMs stay visible in a diff instead of invisible
  const text = `${json.replace(/[^\0-~]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, '0')}`)}\n`;
  JSON.parse(text); // the file must read back

  fs.mkdirSync(FIXTURE_DIR, { recursive: true });
  const file = path.join(FIXTURE_DIR, `${moduleName}.json`);
  fs.writeFileSync(file, text);
  return { file, count: entries.length, fns: [...fns] };
};
