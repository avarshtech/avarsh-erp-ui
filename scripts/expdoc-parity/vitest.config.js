import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The export-documents parity dumps (README.md). They WRITE fixtures into the API repo, so they are
// kept out of the unit-test run — the root vitest.config.js includes src/** only — and run on their own:
//   npx vitest run --config scripts/expdoc-parity/vitest.config.js
// vitest rather than plain node because the src/utils modules import each other without extensions,
// which vitest resolves and node does not.
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: {
    environment: 'node',
    include: ['scripts/expdoc-parity/**/*.dump.js'],
  },
});
