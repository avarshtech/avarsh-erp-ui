/**
 * The browser half of the export-documents parity harness (README.md): runs recorded calls of a pure
 * src/utils module and writes what they return, for the API's Java port to replay and match.
 *
 * Fixture file: erp-purchase/src/test/resources/expdoc-parity/<moduleName>.json, an array of
 *   { id, fn, args, output }   or, for a call the browser rejects,   { id, fn, args, throws }
 * With PARITY_OUT=<dir> in the environment the files go to that directory instead (npm run parity:check writes
 * them to a temporary one and compares).
 *
 * What makes a fixture trustworthy:
 *  - The function runs on the args AS WRITTEN: they are encoded, serialised to JSON and decoded back before the
 *    call, so the browser computed `output` from exactly the input the Java test reads.
 *  - Args and output are JSON, and what JSON cannot hold is written as a SENTINEL, an object whose only key is "$js":
 *      undefined -> {"$js":"undefined"}   NaN -> {"$js":"NaN"}   Infinity -> {"$js":"Infinity"}
 *      -Infinity -> {"$js":"-Infinity"}
 *    so undefined, null, NaN and the two infinities stay five different values, inside objects and lists too (an
 *    object's undefined key stays visible). Nothing real reads as a sentinel: data with a "$js" key fails the dump.
 *    -0 becomes 0 (JSON.stringify(-0) is "0"), a Map becomes an object, a Set or a generator an array, a value with
 *    toJSON what it returns. A function, a bigint or a symbol fails the dump: it is not data.
 *  - Keys keep the order JavaScript gives them: array-index keys ("74", "104") first in numeric order, then the rest
 *    as inserted. Deterministic for a given source.
 *  - The file is ASCII: every other character is written as a \uXXXX escape.
 *  - A case may give `argsJson` (JSON text) instead of `args` when the KEY ORDER of the text matters: the browser
 *    re-orders keys on JSON.parse, the API's Jackson keeps the text's order, so only a text in a non-JavaScript order
 *    (as PostgreSQL jsonb returns sizes) proves the Java port re-orders. The text is written to the fixture verbatim.
 *  - A case that throws must say so (`throws: true`); any other throw fails the dump. The fixture records the error
 *    as "<name>: <message>".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const API_ROOT = path.resolve(UI_ROOT, '..', 'erp-purchase');
const API_TEST_RESOURCES = path.join(API_ROOT, 'src', 'test', 'resources');

/** Where the API's parity tests read the fixtures, in the erp-purchase checkout beside this repo. */
export const API_FIXTURE_DIR = path.join(API_TEST_RESOURCES, 'expdoc-parity');

const OUT_OVERRIDE = process.env.PARITY_OUT ? path.resolve(process.env.PARITY_OUT) : null;

/** Where this run writes the fixtures: PARITY_OUT when it is set, else the API's own directory. */
export const FIXTURE_DIR = OUT_OVERRIDE ?? API_FIXTURE_DIR;

/** The one key of a sentinel object. */
export const SENTINEL_KEY = '$js';

/** Each sentinel's name and the value it stands for. */
const SENTINELS = new Map([['undefined', undefined], ['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity]]);

const sentinel = (name) => ({ [SENTINEL_KEY]: name });

class NotJsonError extends Error {}

const isIterator = (v) => typeof v?.next === 'function' && typeof v[Symbol.iterator] === 'function';

/** A value as fixture JSON, by the rules at the top of this file. */
export const toFixtureJson = (value, where) => {
  if (value === undefined) return sentinel('undefined');
  if (value === null) return null;
  switch (typeof value) {
    case 'number':
      if (Number.isNaN(value)) return sentinel('NaN');
      if (!Number.isFinite(value)) return sentinel(value > 0 ? 'Infinity' : '-Infinity');
      return Object.is(value, -0) ? 0 : value;
    case 'string':
    case 'boolean':
      return value;
    case 'object':
      break;
    default:
      throw new NotJsonError(`${where}: a ${typeof value} is not JSON data`);
  }
  // Array.from visits a hole as undefined, which JSON.stringify would write as null
  if (Array.isArray(value)) return Array.from(value, (v, i) => toFixtureJson(v, `${where}[${i}]`));
  if (value instanceof Map) return objectOf([...value].map(([k, v]) => [String(k), v]), where);
  if (value instanceof Set || isIterator(value)) return [...value].map((v, i) => toFixtureJson(v, `${where}[${i}]`));
  if (typeof value.toJSON === 'function') return toFixtureJson(value.toJSON(), where);
  return objectOf(Object.keys(value).map((k) => [k, value[k]]), where);
};

/** An object of encoded values; fromEntries makes even a "__proto__" key an own property, as JSON.parse does. */
const objectOf = (entries, where) => Object.fromEntries(entries.map(([k, v]) => {
  if (k === SENTINEL_KEY) throw new NotJsonError(`${where}: the key "${SENTINEL_KEY}" is the fixtures' sentinel; data cannot use it`);
  return [k, toFixtureJson(v, `${where}.${k}`)];
}));

/** Fixture JSON as the browser's value: each sentinel the value it stands for, an undefined key kept as a key. */
export const fromFixtureJson = (json, where) => {
  if (Array.isArray(json)) return json.map((v, i) => fromFixtureJson(v, `${where}[${i}]`));
  if (json === null || typeof json !== 'object') return json;
  if (Object.hasOwn(json, SENTINEL_KEY)) {
    const name = json[SENTINEL_KEY];
    if (Object.keys(json).length !== 1 || !SENTINELS.has(name)) throw new Error(`${where}: ${JSON.stringify(json)} is not a sentinel`);
    return SENTINELS.get(name);
  }
  return Object.fromEntries(Object.keys(json).map((k) => [k, fromFixtureJson(json[k], `${where}.${k}`)]));
};

const argsTextOf = (c) => {
  if (c.argsJson != null) {
    if (c.args !== undefined) throw new Error(`${c.id}: give args or argsJson, not both`);
    return c.argsJson;
  }
  return JSON.stringify(toFixtureJson(c.args ?? [], `${c.id} args`));
};

const run = (c) => {
  const argsText = argsTextOf(c);
  let json;
  try {
    json = JSON.parse(argsText);
  } catch (e) {
    throw new Error(`${c.id}: argsJson is not JSON (${e.message})`);
  }
  if (!Array.isArray(json)) throw new Error(`${c.id}: args must be an array`);
  // The browser runs on the args the fixture holds, each sentinel made its value again
  const args = fromFixtureJson(json, `${c.id} args`);
  let output;
  try {
    // Materialised inside the try: a generator throws on its first step, not when it is called
    output = toFixtureJson(c.fn(...args), `${c.id} output`);
  } catch (e) {
    if (e instanceof NotJsonError) throw e;
    if (!c.throws) throw new Error(`${c.id}: ${c.fn.name} threw "${e}"; mark the case throws: true if the browser means to`);
    return { args: json, argsText, thrown: `${e.name}: ${e.message}` };
  }
  if (c.throws) throw new Error(`${c.id}: ${c.fn.name} was expected to throw and returned`);
  return { args: json, argsText, output };
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
  if (!OUT_OVERRIDE && !fs.existsSync(API_TEST_RESOURCES)) {
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
