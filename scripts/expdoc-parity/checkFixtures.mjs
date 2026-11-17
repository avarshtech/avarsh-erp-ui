#!/usr/bin/env node
/**
 * Drift check for the export-documents parity fixtures (README.md):
 *
 *   npm run parity:check
 *
 * Runs every dump again, writing the fixtures to a temporary directory (PARITY_OUT), and compares each file with
 * the one the API's parity tests read: erp-purchase/src/test/resources/expdoc-parity/, in the checkout beside this
 * repo. Exits 0 when every file matches; otherwise names each file that differs, that no dump writes any more, or
 * that the API repo lacks, and exits 1. So a change to src/utils/expDoc*.js or to a dump that moves a browser answer
 * is caught, instead of the Java tests passing on fixtures the browser no longer agrees with. Line endings are not
 * compared: git on Windows (core.autocrlf) checks the API's fixtures out with CRLF, and JSON text holds no line
 * break of its own. A missing API repo, or a dump that fails, fails the check too, saying so.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_FIXTURE_DIR } from './writeFixtures.js';

const UI_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const VITEST = path.join(UI_ROOT, 'node_modules', 'vitest', 'vitest.mjs');
const CONFIG = path.join('scripts', 'expdoc-parity', 'vitest.config.js');

/** The check could not compare at all. */
class CannotCheck extends Error {}

const fixturesIn = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const textOf = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');

/** One line per file that is not what the dumps write today; none when the API's fixtures are current. */
const driftOf = (fresh) => {
  const written = fixturesIn(fresh);
  const committed = fixturesIn(API_FIXTURE_DIR);
  return [
    ...written.filter((f) => committed.includes(f) && textOf(fresh, f) !== textOf(API_FIXTURE_DIR, f))
      .map((f) => `${f}: differs from what the dumps write now`),
    ...written.filter((f) => !committed.includes(f)).map((f) => `${f}: written by a dump, missing from the API repo`),
    ...committed.filter((f) => !written.includes(f)).map((f) => `${f}: in the API repo, but no dump writes it`),
  ];
};

const check = () => {
  if (!fs.existsSync(API_FIXTURE_DIR)) {
    throw new CannotCheck(`the API repo is not beside this one: ${API_FIXTURE_DIR} does not exist. `
      + 'Clone erp-purchase next to avarsh-erp-ui.');
  }
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), 'expdoc-parity-'));
  try {
    const run = spawnSync(process.execPath, [VITEST, 'run', '--config', CONFIG], {
      cwd: UI_ROOT, env: { ...process.env, PARITY_OUT: fresh }, stdio: 'inherit',
    });
    if (run.status !== 0) {
      throw new CannotCheck(`the dumps did not run cleanly (${run.error?.message ?? `vitest exit ${run.status ?? run.signal}`}); see above`);
    }
    return driftOf(fresh);
  } finally {
    fs.rmSync(fresh, { recursive: true, force: true });
  }
};

try {
  const drift = check();
  if (drift.length) {
    console.error(`\nParity check failed: the API's fixtures are not what the dumps write today.\n  - ${drift.join('\n  - ')}`);
    console.error('\nIf the browser\'s answers changed on purpose: regenerate the fixtures with\n'
      + '  npx vitest run --config scripts/expdoc-parity/vitest.config.js\n'
      + 'run the API\'s parity tests (./gradlew test --rerun --tests "*ParityTest") and commit both repos together.');
    process.exitCode = 1;
  } else {
    console.log(`\nParity check passed: the API's ${fixturesIn(API_FIXTURE_DIR).length} fixtures are what the dumps write today.`);
  }
} catch (e) {
  if (!(e instanceof CannotCheck)) throw e;
  console.error(`\nParity check failed: ${e.message}`);
  process.exitCode = 1;
}
