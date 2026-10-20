#!/usr/bin/env node
/**
 * Bundle budget check: run after `npm run build`.
 *
 *   node scripts/check-bundle-size.mjs [distDir]      (default: dist)
 *
 * Measures the built app against budgets.json and exits 1 when any figure is over its budget.
 * - initialJsGzipKb:   the JS a first visit loads before any screen (index.html's module script and
 *                      its modulepreload links), gzipped.
 * - initialCssGzipKb:  index.html's stylesheets, gzipped.
 * - largestChunkGzipKb: the biggest other JS file (a screen or a library it pulls in), gzipped.
 * - precacheKb:        what the service worker downloads on install (its precache list), uncompressed.
 *
 * The budgets are a ratchet: they sit just above today's sizes, so growth fails the check and a
 * saving should be locked in by lowering the budget. The end targets (rule 17) are 450 KB initial JS,
 * 200 KB per chunk and 3 MB precache.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, process.argv[2] || 'dist');
const budgets = JSON.parse(readFileSync(join(root, 'budgets.json'), 'utf8'));

if (!existsSync(join(dist, 'index.html'))) {
  console.error(`No build at ${dist}. Run npm run build first.`);
  process.exit(2);
}

const kb = (bytes) => bytes / 1024;
const gzipKb = (file) => kb(gzipSync(readFileSync(join(dist, file)), { level: 9 }).length);
const strip = (url) => url.replace(/^\//, '');

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const attr = (re) => [...html.matchAll(re)].map((m) => strip(m[1]));
const initialJs = [
  ...attr(/<script[^>]*type="module"[^>]*src="([^"]+)"/g),
  ...attr(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g),
];
const initialCss = attr(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g);

const allJs = readdirSync(join(dist, 'assets')).filter((f) => f.endsWith('.js')).map((f) => `assets/${f}`);
const others = allJs.filter((f) => !initialJs.includes(f)).map((f) => ({ f, size: gzipKb(f) }));
const largest = others.reduce((a, b) => (b.size > a.size ? b : a), { f: '-', size: 0 });

// The injected precache manifest lists each file as {"revision":...,"url":"..."} (or unquoted keys).
const sw = readFileSync(join(dist, 'sw.js'), 'utf8');
const precached = [...new Set([...sw.matchAll(/"?url"?\s*:\s*"([^"]+)"/g)].map((m) => strip(m[1])))]
  .filter((f) => existsSync(join(dist, f)));

const sum = (files, size) => files.reduce((total, f) => total + size(f), 0);
const figures = {
  initialJsGzipKb: sum(initialJs, gzipKb),
  initialCssGzipKb: sum(initialCss, gzipKb),
  largestChunkGzipKb: largest.size,
  precacheKb: sum(precached, (f) => kb(statSync(join(dist, f)).size)),
};
const notes = {
  initialJsGzipKb: `${initialJs.length} files`,
  initialCssGzipKb: `${initialCss.length} files`,
  largestChunkGzipKb: largest.f,
  precacheKb: `${precached.length} files`,
};

let over = 0;
for (const [key, value] of Object.entries(figures)) {
  const budget = budgets[key];
  const status = value > budget ? 'OVER' : 'ok';
  if (status === 'OVER') over += 1;
  console.log(`${status.padEnd(4)} ${key.padEnd(20)} ${value.toFixed(1).padStart(8)} KB / ${String(budget).padStart(5)} KB  (${notes[key]})`);
}
if (over) {
  console.error(`\n${over} figure(s) over budget. Find what grew, or, if the growth is wanted, raise budgets.json in the same commit and say why.`);
  process.exit(1);
}
console.log('\nWithin budget. When a figure drops well below its budget, lower the budget to lock the saving in.');
