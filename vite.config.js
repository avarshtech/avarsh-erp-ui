import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { getHeapStatistics } from 'node:v8'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Identifies the build so the app can tell "this is a different deploy" apart
// from "same deploy, new page load" — independent of whether releases have been
// given real version numbers yet. Netlify sets COMMIT_REF on every build.
const resolveBuildId = () => {
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF.slice(0, 7)
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return String(Date.now())
  }
}
const buildId = resolveBuildId()

// Source maps exist only for Sentry (src/observability/sentry.js). A build that can upload them,
// because SENTRY_AUTH_TOKEN is set in its environment, builds them hidden (the bundle names no map),
// uploads them for this release, then deletes them, so no .map file is ever deployed. Without the
// token the build is what it always was: no source maps and no Sentry plugin.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN)
// Mapping this bundle for Sentry needs about 4 GB of heap. Node's default (about 2 GB) runs out two
// minutes into the build, so a heap that small fails here, at once, with the remedy.
if (uploadSourceMaps && getHeapStatistics().heap_size_limit < 3.5 * 1024 ** 3) {
  throw new Error('Uploading source maps to Sentry needs a larger Node heap: set NODE_OPTIONS=--max-old-space-size=4096 '
    + 'in this site\'s environment, next to SENTRY_AUTH_TOKEN (see RELEASING.md).')
}
const sentryPlugins = uploadSourceMaps
  ? [(await import('@sentry/vite-plugin')).sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // The release the app reports under: `${__APP_VERSION__}+${__BUILD_ID__}`
      release: { name: `${pkg.version}+${buildId}` },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      telemetry: false,
    })]
  : []

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_ID__: JSON.stringify(buildId),
  },
  ...(uploadSourceMaps ? { build: { sourcemap: 'hidden' } } : {}),
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      registerType: 'prompt',
      injectRegister: null,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // The Virtual Factory page carries three.js (only it imports it), so only the people who open
        // that screen download it.
        globIgnores: ['**/node_modules/**/*', '**/VirtualFactoryPage-*.{js,css}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // The service worker is built after the Sentry plugin has deleted the uploaded maps, so it
        // must never get one of its own (the default follows build.sourcemap, which is false today).
        sourcemap: false,
      },
      manifest: {
        name: 'Avarsh ERP Dashboard',
        short_name: 'Avarsh ERP',
        description: 'Garments Manufacturing ERP - Orders, BOM, Costing, Purchase Orders',
        id: '/',
        theme_color: '#ffffff',
        background_color: '#f8fafc',
        display: 'standalone',
        display_override: ['window-controls-overlay', 'standalone'],
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
          { src: '/icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
          { src: '/icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
          { src: '/icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
          { src: '/icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
          { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
          { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          {
            name: 'Orders',
            short_name: 'Orders',
            url: '/orders/list',
            icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'New Cost Sheet',
            short_name: 'Costing',
            url: '/costing/new',
            icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
          },
          {
            name: 'Supplier PO',
            short_name: 'Supplier PO',
            url: '/purchase-orders/supplier-po/list',
            icons: [{ src: '/icons/icon-96x96.png', sizes: '96x96' }],
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
    ...sentryPlugins,
  ],
  server: {
    port: 3000,
    // Test runs and tools write into the project while the dev server is up. Watching those folders
    // is wasted work, and on Windows a report the reporter still holds open (EBUSY) crashes the watcher.
    watch: {
      ignored: ['**/e2e-report/**', '**/test-results/**', '**/playwright-report/**', '**/blob-report/**',
        '**/coverage/**', '**/.playwright-mcp/**', '**/.kilo/**', '**/docs/**'],
    },
  },
})
