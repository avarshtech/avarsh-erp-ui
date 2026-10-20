import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { initSentry, rootErrorOptions, sentryEnabled } from './observability/sentry'

// Error reporting is on only in a build with a Sentry DSN. Without one, `sentryEnabled` is false at
// build time, both branches that use it are dropped, and the root is created exactly as before.
if (sentryEnabled) initSentry()

const container = document.getElementById('root')
const root = sentryEnabled ? createRoot(container, rootErrorOptions()) : createRoot(container)

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
