#!/usr/bin/env node
/**
 * Lockfile integrity check: run in CI after `npm ci`.
 *
 *   node scripts/check-lockfile.mjs [path]      (default: package-lock.json)
 *
 * Fails when any installed package in the lockfile is fetched from anywhere but the public npm
 * registry (https://registry.npmjs.org/), or carries no integrity hash. A tampered or hand-edited
 * lockfile that points a package at another host, a git URL or a local tarball, or drops its
 * hash so npm cannot verify the download, is caught before anything is built from it.
 * Workspace links and the root entry have no `resolved` and are skipped.
 */
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const file = resolve(root, process.argv[2] || 'package-lock.json');
const { packages = {} } = JSON.parse(readFileSync(file, 'utf8'));

const REGISTRY = 'https://registry.npmjs.org/';
const problems = [];
let checked = 0;

for (const [path, entry] of Object.entries(packages)) {
  if (path === '' || entry.link) continue;
  checked += 1;
  if (!entry.resolved) problems.push(`${path}: no "resolved" URL`);
  else if (!entry.resolved.startsWith(REGISTRY)) problems.push(`${path}: resolved from ${entry.resolved}`);
  if (!entry.integrity) problems.push(`${path}: no "integrity" hash`);
}

if (problems.length) {
  console.error(`Lockfile check failed: ${problems.length} problem(s) in ${checked} packages\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`Lockfile check passed: ${checked} packages, all from ${REGISTRY} with an integrity hash.`);
