import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { initSentry, rootErrorOptions, sentryEnabled } from './observability/sentry'
import { installDiagnostics } from './services/feedback/installDiagnostics'

// Error reporting is on only in a build with a Sentry DSN. Without one, `sentryEnabled` is false at
// build time, both branches that use it are dropped, and the root is created exactly as before.
if (sentryEnabled) initSentry()

// The feedback widget attaches the last frontend errors and failed API calls to a bug report, so start
// keeping them before anything can fail. Only where an issue service is configured.
if (import.meta.env.VITE_FEEDBACK_API_URL) installDiagnostics()

const container = document.getElementById('root')
const root = sentryEnabled ? createRoot(container, rootErrorOptions()) : createRoot(container)

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
)
