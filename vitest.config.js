import { defineConfig } from 'vitest/config'

// Unit tests for the app's pure logic: calculators, formatters, permission checks and the
// document-model rules. They run in Node, with no browser and no DOM; a test that reads a
// browser global stubs that one global itself.
//
// Kept apart from vite.config.js so the React and PWA plugins stay out of test runs. The include
// is explicit because the default pattern would also collect the Playwright specs under e2e/.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: 'coverage',
      // Every source file counts, tested or not, so the figure is the app's and not the tests'.
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}'],
    },
  },
})
