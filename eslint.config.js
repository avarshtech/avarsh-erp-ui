import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
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
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
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
