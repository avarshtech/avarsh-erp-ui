import axiosInstance from './axiosInstance';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');

const RECONNECT_MIN_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const WATCHDOG_MS = 45000;

export const getFeedSettings = () =>
  axiosInstance.get('/admin/activity-feed/settings').then((r) => r.data);

export const updateFeedSettings = (enabled) =>
  axiosInstance.put('/admin/activity-feed/settings', { enabled }).then((r) => r.data);

const mintTicket = () =>
  axiosInstance.post('/admin/activity-feed/ticket').then((r) => r.data);

/**
 * Creates a live-activity-feed SSE connection manager.
 *
 * Native EventSource cannot send an Authorization header, so we first
 * exchange the Bearer JWT for a short-lived single-use ticket, then open
 * the stream with ?ticket=<uuid>. The controller consumes the ticket and
 * upgrades the connection to SSE.
 *
 * Returns a handle with connect()/disconnect()/resume().
 */
export const createLiveFeedConnection = ({ onEvent, onStatus, onDisabled } = {}) => {
  let eventSource = null;
  let backoff = RECONNECT_MIN_MS;
  let reconnectTimer = null;
  let watchdogTimer = null;
  let disposed = false;
  let disabled = false;

  const status = (s, detail) => {
    if (typeof onStatus === 'function') onStatus(s, detail);
  };

  const clearWatchdog = () => {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  };

  const bumpWatchdog = () => {
    clearWatchdog();
    watchdogTimer = setTimeout(() => {
      if (disposed) return;
      status('stale');
      reopenSoon();
    }, WATCHDOG_MS);
  };

  const closeSource = () => {
    clearWatchdog();
    if (eventSource) {
      try { eventSource.close(); } catch { /* ignore */ }
      eventSource = null;
    }
  };

  const reopenSoon = () => {
    closeSource();
    if (disposed || disabled) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => open(), backoff);
    backoff = Math.min(backoff * 2, RECONNECT_MAX_MS);
  };

  const open = async () => {
    if (disposed) return;
    try {
      const { ticket } = await mintTicket();
      if (!ticket) throw new Error('no_ticket');

      const url = `${BASE_URL}/admin/activity-feed/stream?ticket=${encodeURIComponent(ticket)}`;
      eventSource = new EventSource(url, { withCredentials: true });

      eventSource.addEventListener('connected', () => {
        backoff = RECONNECT_MIN_MS;
        status('connected');
        bumpWatchdog();
      });

      eventSource.addEventListener('activity', (evt) => {
        bumpWatchdog();
        try {
          const data = JSON.parse(evt.data);
          if (typeof onEvent === 'function') onEvent(data);
        } catch {
          /* ignore malformed frame */
        }
      });

      eventSource.addEventListener('heartbeat', () => bumpWatchdog());

      eventSource.addEventListener('feed_disabled', () => {
        disabled = true;
        status('disabled');
        if (typeof onDisabled === 'function') onDisabled();
        closeSource();
      });

      eventSource.addEventListener('error', (evt) => {
        try {
          if (evt && evt.data) {
            const parsed = JSON.parse(evt.data);
            if (parsed.reason === 'disabled') {
              disabled = true;
              status('disabled');
              if (typeof onDisabled === 'function') onDisabled();
              closeSource();
              return;
            }
          }
        } catch { /* ignore */ }
        status('reconnecting');
        reopenSoon();
      });

      eventSource.onerror = () => {
        if (disposed) return;
        status('reconnecting');
        reopenSoon();
      };
    } catch (err) {
      const code = err?.response?.status;
      if (code === 423) {
        disabled = true;
        status('disabled');
        if (typeof onDisabled === 'function') onDisabled();
        return;
      }
      if (code === 401 || code === 403) {
        status('unauthorized');
        return;
      }
      status('reconnecting');
      reopenSoon();
    }
  };

  return {
    connect: () => {
      disabled = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      open();
    },
    disconnect: () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      closeSource();
    },
    resume: () => {
      disabled = false;
      disposed = false;
      backoff = RECONNECT_MIN_MS;
      open();
    },
  };
};
