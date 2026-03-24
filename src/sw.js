import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

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

const NOTIFICATION_ACTIONS = {
  PO_APPROVAL_REQUEST: [
    { action: 'approve', title: 'Approve', icon: '/icons/action-approve.png' },
    { action: 'refer_back', title: 'Refer Back', icon: '/icons/action-refer-back.png' },
  ],
  ORDER_REFER_BACK_REQUEST: [
    { action: 'approve', title: 'Approve', icon: '/icons/action-approve.png' },
    { action: 'reject', title: 'Reject', icon: '/icons/action-reject.png' },
  ],
  ORDER_CANCEL_REQUEST: [
    { action: 'approve', title: 'Approve', icon: '/icons/action-approve.png' },
    { action: 'reject', title: 'Reject', icon: '/icons/action-reject.png' },
  ],
  COSTING_APPROVAL_REQUEST: [
    { action: 'approve', title: 'Approve', icon: '/icons/action-approve.png' },
    { action: 'revise', title: 'Revise', icon: '/icons/action-revise.png' },
  ],
  DEFAULT: [
    { action: 'view', title: 'View', icon: '/icons/action-view.png' },
    { action: 'dismiss', title: 'Dismiss', icon: '/icons/action-dismiss.png' },
  ],
};

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const actions = NOTIFICATION_ACTIONS[data.type] || NOTIFICATION_ACTIONS.DEFAULT;
  const isApprovalRequest = data.type?.includes('REQUEST');

  event.waitUntil(
    self.registration.showNotification(data.title || 'Avarsh ERP', {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-96x96.png',
      tag: data.tag || `erp-${data.notificationId || 'notification'}`,
      data: {
        url: data.actionUrl || '/',
        notificationId: data.notificationId,
        entityType: data.entityType,
        entityId: data.entityId,
        type: data.type,
      },
      actions,
      requireInteraction: isApprovalRequest,
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { url, notificationId } = event.notification.data || {};
  const action = event.action;

  // Dismiss — just mark as read
  if (action === 'dismiss') {
    if (notificationId) {
      fetch(`/api/v1/notifications/${notificationId}/read`, { method: 'PATCH' }).catch(() => {});
    }
    return;
  }

  // Actionable buttons — open page with ?action= param
  if (['approve', 'reject', 'refer_back', 'revise'].includes(action)) {
    const separator = url?.includes('?') ? '&' : '?';
    const targetUrl = `${url}${separator}action=${action}`;
    event.waitUntil(openOrFocusWindow(targetUrl));
    return;
  }

  // Default: view action or body click
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
