import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// ─── Skip Waiting (required for injectManifest strategy) ───
// When the user clicks "Restart Now", registerSW sends this message
// to the waiting SW so it activates and the page reloads.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ─── Update Notification (system notification bar) ───
// Fires when the NEW service worker activates (after install + skipWaiting or
// after the old SW is replaced). This is the most reliable point to show
// a system notification because:
//   1. `activate` is allowed to call showNotification() in all browsers
//   2. self.registration is fully set up at this point
//   3. We can reliably check if this is an update (not first install)
//
// For first-ever install there's no previous SW, so no notification needed.
// For updates when app is in foreground, the in-app UpdatePrompt handles it.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const hasVisibleClient = clients.some((c) => c.visibilityState === 'visible');

      // If app is in foreground, notify via postMessage so UpdatePrompt picks it up
      if (hasVisibleClient) {
        clients.forEach((client) => {
          if (client.visibilityState === 'visible') {
            client.postMessage({ type: 'SW_UPDATED' });
          }
        });
        return;
      }

      // App is backgrounded or closed AND notification permission is granted
      // → show system notification so user knows to come back
      if (self.Notification && self.Notification.permission === 'granted') {
        return self.registration.showNotification('Avarsh ERP Updated', {
          body: 'A new version has been installed. Tap to open the latest version.',
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-96x96.png',
          tag: 'pwa-update',
          renotify: true,
          data: { type: 'PWA_UPDATE' },
          actions: [
            { action: 'update', title: 'Open App' },
            { action: 'dismiss', title: 'Later' },
          ],
          vibrate: [200, 100, 200],
          requireInteraction: true,
        });
      }
    })
  );
});

// ─── Precache & Route (auto-injected by vite-plugin-pwa) ───
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ─── Runtime Caching: Master Data APIs ───
registerRoute(
  ({ url }) =>
    url.pathname.match(
      /\/api\/v1\/(categories|sub-categories|item-types|attributes|uoms|variants|suppliers|buyers|styles|terms-conditions|payment-terms|size-presets|users|roles)/
    ),
  new NetworkFirst({
    cacheName: 'erp-master-data',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
    networkTimeoutSeconds: 5,
  }),
  'GET'
);

// ─── Runtime Caching: Other API GET requests ───
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/v1/'),
  new NetworkFirst({
    cacheName: 'erp-api-data',
    plugins: [
      new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 60 * 30 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
    networkTimeoutSeconds: 10,
  }),
  'GET'
);

// ─── Navigation fallback ───
const navigationHandler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(navigationHandler, {
  denylist: [/^\/api/],
});
registerRoute(navigationRoute);

// ─── Push Notification Handling ───

// Notification type → action buttons (matches in-app NotificationPanel exactly)
const NOTIFICATION_ACTIONS = {
  PO_APPROVAL_REQUEST: [
    { action: 'approve', title: '\u2705 Approve', icon: '/icons/action-approve.png' },
    { action: 'refer_back', title: '\u21A9\uFE0F Refer Back', icon: '/icons/action-refer-back.png' },
  ],
  ORDER_REFER_BACK_REQUEST: [
    { action: 'approve', title: '\u2705 Approve', icon: '/icons/action-approve.png' },
    { action: 'reject', title: '\u274C Reject', icon: '/icons/action-reject.png' },
  ],
  ORDER_CANCEL_REQUEST: [
    { action: 'approve', title: '\u2705 Approve Cancel', icon: '/icons/action-approve.png' },
    { action: 'reject', title: '\u274C Reject Cancel', icon: '/icons/action-reject.png' },
  ],
  COSTING_APPROVAL_REQUEST: [
    { action: 'approve', title: '\u2705 Approve', icon: '/icons/action-approve.png' },
    { action: 'revise', title: '\u270F\uFE0F Revise', icon: '/icons/action-revise.png' },
  ],
  // Non-approval types: single "View" action
  ORDER_STATUS: [
    { action: 'view', title: '\uD83D\uDCC4 View Order', icon: '/icons/action-view.png' },
  ],
  PO_UPDATE: [
    { action: 'view', title: '\uD83D\uDCC4 View PO', icon: '/icons/action-view.png' },
  ],
  COSTING_UPDATE: [
    { action: 'view', title: '\uD83D\uDCC4 View Costing', icon: '/icons/action-view.png' },
  ],
  BOM_UPDATE: [
    { action: 'view', title: '\uD83D\uDCC4 View BOM', icon: '/icons/action-view.png' },
  ],
  GRN_UPDATE: [
    { action: 'view', title: '\uD83D\uDCC4 View GRN', icon: '/icons/action-view.png' },
  ],
  DEFAULT: [
    { action: 'view', title: '\uD83D\uDCC4 View', icon: '/icons/action-view.png' },
  ],
};

// Notification type → category label for grouped display
const NOTIFICATION_CATEGORY = {
  PO_APPROVAL_REQUEST: 'Purchase Order',
  PO_UPDATE: 'Purchase Order',
  ORDER_STATUS: 'Order',
  ORDER_REFER_BACK_REQUEST: 'Order',
  ORDER_CANCEL_REQUEST: 'Order',
  COSTING_APPROVAL_REQUEST: 'Costing',
  COSTING_UPDATE: 'Costing',
  BOM_UPDATE: 'BOM',
  GRN_UPDATE: 'GRN',
  GENERAL_ALERT: 'Alert',
};

// Vibration patterns by urgency
const VIBRATE_URGENT = [200, 100, 200, 100, 200]; // Approval requests
const VIBRATE_NORMAL = [200, 100, 200];            // Status updates
const VIBRATE_SILENT = [];                         // General alerts

function getVibrationPattern(type) {
  if (type?.includes('REQUEST')) return VIBRATE_URGENT;
  if (type?.includes('UPDATE') || type === 'ORDER_STATUS') return VIBRATE_NORMAL;
  return VIBRATE_SILENT;
}

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const notifType = data.type || 'GENERAL_ALERT';
  const actions = NOTIFICATION_ACTIONS[notifType] || NOTIFICATION_ACTIONS.DEFAULT;
  const isApprovalRequest = notifType.includes('REQUEST');
  const category = NOTIFICATION_CATEGORY[notifType] || 'Avarsh ERP';

  // Build a professional, structured title
  // Approval requests: "PO Approval Required" / Status updates: "Order Update"
  const title = data.title || `${category} Notification`;

  // Group notifications by entity type to avoid flooding the notification bar
  // e.g., multiple PO updates collapse into the latest one
  const tag = data.tag || `erp-${notifType}-${data.entityId || data.notificationId || 'general'}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const hasVisibleClient = clients.some((c) => c.visibilityState === 'visible');

      // If app is in foreground, forward to the client for in-app handling
      // and skip the system notification to avoid duplicates
      if (hasVisibleClient) {
        clients.forEach((client) => {
          if (client.visibilityState === 'visible') {
            client.postMessage({
              type: 'PUSH_RECEIVED',
              payload: data,
            });
          }
        });
        return;
      }

      // App is backgrounded or closed — show rich system notification
      return self.registration.showNotification(title, {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag,
        renotify: true,
        timestamp: data.timestamp ? new Date(data.timestamp).getTime() : Date.now(),
        data: {
          url: data.actionUrl || '/',
          notificationId: data.notificationId,
          entityType: data.entityType,
          entityId: data.entityId,
          type: notifType,
        },
        actions,
        requireInteraction: isApprovalRequest,
        vibrate: getVibrationPattern(notifType),
        silent: notifType === 'GENERAL_ALERT',
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, notificationId, type } = event.notification.data || {};
  const action = event.action;

  // PWA Update notification — skip waiting and open/focus the app
  if (type === 'PWA_UPDATE') {
    if (action === 'dismiss') return;
    event.waitUntil(
      self.skipWaiting().then(() => openOrFocusWindow('/'))
    );
    return;
  }

  // Mark as read when any action or body click happens
  if (notificationId) {
    fetch(`/api/v1/notifications/${notificationId}/read`, { method: 'PATCH' }).catch(() => {});
  }

  // No action button clicked (just tapped the notification body) — open/view
  if (!action || action === 'view') {
    event.waitUntil(openOrFocusWindow(url || '/'));
    return;
  }

  // Actionable buttons — open page with ?action= param (same as in-app panel)
  if (['approve', 'reject', 'refer_back', 'revise'].includes(action)) {
    const separator = url?.includes('?') ? '&' : '?';
    const targetUrl = `${url}${separator}action=${action}`;
    event.waitUntil(openOrFocusWindow(targetUrl));
    return;
  }

  // Fallback — open the action URL
  event.waitUntil(openOrFocusWindow(url || '/'));
});

function openOrFocusWindow(url) {
  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    });
}
