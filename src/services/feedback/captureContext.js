/**
 * The context attached to every report: which screen, which browser, what size of window. Built from
 * what the browser already knows; no request is made for it.
 */
import { findScreenByPath, SECTIONS } from '../../utils/permissions';
import { redactText } from './redaction';
import { getDiagnostics } from './diagnostics';

export const APP_NAME = 'Garments ERP';

/** Browser and OS from a user-agent string. Order matters: Edge and Opera also claim to be Chrome. */
export function parseUserAgent(ua = '') {
  const match = (re) => ua.match(re)?.[1];
  let browserName = 'Unknown';
  let browserVersion;
  if (match(/Edg\/([\d.]+)/)) {
    browserName = 'Edge';
    browserVersion = match(/Edg\/([\d.]+)/);
  } else if (match(/OPR\/([\d.]+)/)) {
    browserName = 'Opera';
    browserVersion = match(/OPR\/([\d.]+)/);
  } else if (match(/Firefox\/([\d.]+)/)) {
    browserName = 'Firefox';
    browserVersion = match(/Firefox\/([\d.]+)/);
  } else if (match(/Chrome\/([\d.]+)/)) {
    browserName = 'Chrome';
    browserVersion = match(/Chrome\/([\d.]+)/);
  } else if (match(/Version\/([\d.]+).*Safari/)) {
    browserName = 'Safari';
    browserVersion = match(/Version\/([\d.]+)/);
  }

  let os = 'Unknown';
  let osVersion;
  if (/Windows NT/.test(ua)) {
    os = 'Windows';
    osVersion = match(/Windows NT ([\d.]+)/);
  } else if (/Android/.test(ua)) {
    os = 'Android';
    osVersion = match(/Android ([\d.]+)/);
  } else if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS';
    osVersion = match(/OS ([\d_]+)/)?.replace(/_/g, '.');
  } else if (/Mac OS X/.test(ua)) {
    os = 'macOS';
    osVersion = match(/Mac OS X ([\d_.]+)/)?.replace(/_/g, '.');
  } else if (/Linux/.test(ua)) {
    os = 'Linux';
  }
  return { browserName, browserVersion, os, osVersion };
}

/** The screen ('orders', 'purchase-orders', …) and its menu section for a route path. */
export function resolveModule(pathname) {
  const screen = findScreenByPath(pathname);
  if (!screen) {
    const first = pathname.split('/').filter(Boolean)[0];
    return { module: first || 'dashboard', moduleSection: undefined };
  }
  const section = SECTIONS.find((s) => s.key === screen.section);
  return { module: screen.id, moduleSection: section?.label };
}

export function collectBrowserContext(win = window) {
  const nav = win.navigator || {};
  let branchId;
  try {
    branchId = win.localStorage?.getItem('activeBranchId') || undefined;
  } catch {
    branchId = undefined;
  }
  const context = {
    appName: APP_NAME,
    environment: import.meta.env?.VITE_APP_ENV,
    ...parseUserAgent(nav.userAgent || ''),
    userAgent: nav.userAgent,
    language: nav.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: { width: win.screen?.width, height: win.screen?.height },
    viewport: { width: win.innerWidth, height: win.innerHeight },
    devicePixelRatio: win.devicePixelRatio,
    colorScheme: win.matchMedia?.('(prefers-color-scheme: dark)')?.matches ? 'dark' : 'light',
    online: nav.onLine,
    branchId,
    capturedAt: new Date().toISOString(),
  };
  return Object.fromEntries(Object.entries(context).filter(([, v]) => v !== undefined && v !== null));
}

/** The JSON part of the submission (the reporter's identity is not here: the ERP-signed token carries it). */
export function buildIssuePayload({ values, element, location = window.location, win = window }) {
  const { module, moduleSection } = resolveModule(location.pathname);
  const { consoleErrors, apiFailures } = getDiagnostics();
  return {
    type: values.type,
    title: values.title.trim(),
    description: values.description.trim(),
    priority: values.priority,
    module,
    moduleSection,
    pageUrl: redactText(location.href),
    context: {
      browser: collectBrowserContext(win),
      element: element || undefined,
      consoleErrors,
      apiFailures,
    },
  };
}
