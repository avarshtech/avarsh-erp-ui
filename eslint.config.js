import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Build output, test reports, local tool state and the git-ignored docs folder. `.kilo` holds
  // another tool's worktrees — full copies of src — which `eslint .` would otherwise lint twice.
  globalIgnores(['dist', 'coverage', 'e2e-report', 'test-results', 'playwright-report', 'blob-report', '.kilo', '.playwright-mcp', 'docs']),
  {
    // Build/tooling config runs in Node, not the browser
    files: ['vite.config.js', 'eslint.config.js', 'playwright.config.js', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: globals.node,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },
  {
    // Playwright specs and fixtures run in Node, and read process.env for
    // the base URL and credentials.
    files: ['e2e/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
  },
  {
    // React's rules apply to the app only. In e2e/, Playwright fixtures receive a `use` callback,
    // which react-hooks' rules-of-hooks would read as a hook call.
    files: ['src/**/*.{js,jsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: {
        ...globals.browser,
        // Injected at build time by vite.config.js `define`
        __APP_VERSION__: 'readonly',
        __BUILD_ID__: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        // `(_, index) => ...` and other placeholders that exist only to reach a later argument
        argsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        // `const { id, createdAt, ...rest } = dto` is how payloads are stripped here;
        // the named keys are meant to be dropped, not read.
        ignoreRestSiblings: true,
      }],
    },
  },
])
