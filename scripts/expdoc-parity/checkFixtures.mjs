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
 *
 * A FROZEN fixture is one whose browser module is gone, its rules now the server's (README.md): no dump writes it
 * any more, the API repo keeps it for its parity test as it was last written, and the check only requires it to be
 * there. A dump that writes it again is drift too: a frozen fixture is never regenerated.
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

/**
 * Fixtures kept as they were last written, for the API's parity tests: the browser modules that wrote them are gone
 * (Export Docs Phase 1 moved the packing-list assembly to the server).
 */
const FROZEN = ['expDocPlBlocks.json'];

const fixturesIn = (dir) => fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const textOf = (dir, file) => fs.readFileSync(path.join(dir, file), 'utf8').replace(/\r\n/g, '\n');

/** One line per file that is not what the dumps write today; none when the API's fixtures are current. */
const driftOf = (fresh) => {
  const written = fixturesIn(fresh);
  const committed = fixturesIn(API_FIXTURE_DIR);
  const live = written.filter((f) => !FROZEN.includes(f));
  return [
    ...live.filter((f) => committed.includes(f) && textOf(fresh, f) !== textOf(API_FIXTURE_DIR, f))
      .map((f) => `${f}: differs from what the dumps write now`),
    ...live.filter((f) => !committed.includes(f)).map((f) => `${f}: written by a dump, missing from the API repo`),
    ...committed.filter((f) => !written.includes(f) && !FROZEN.includes(f))
      .map((f) => `${f}: in the API repo, but no dump writes it`),
    ...FROZEN.filter((f) => written.includes(f)).map((f) => `${f}: frozen, but a dump writes it again`),
    ...FROZEN.filter((f) => !committed.includes(f)).map((f) => `${f}: frozen, but missing from the API repo`),
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
    const current = fixturesIn(API_FIXTURE_DIR).length - FROZEN.length;
    console.log(`\nParity check passed: the API's ${current} live fixtures are what the dumps write today`
      + ` (${FROZEN.length} frozen: ${FROZEN.join(', ')}).`);
  }
} catch (e) {
  if (!(e instanceof CannotCheck)) throw e;
  console.error(`\nParity check failed: ${e.message}`);
  process.exitCode = 1;
}
