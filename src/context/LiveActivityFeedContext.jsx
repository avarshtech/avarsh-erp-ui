import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  createLiveFeedConnection,
  getFeedSettings,
  updateFeedSettings,
} from '../services/core/liveActivityFeedService';
import { getCurrentUser, isAdminRole } from '../utils/permissions';
import { initializeSession } from '../services/auth/authService';

const BUFFER_CAP = 200;
const STORAGE_KEY = 'liveFeed.window';

const LiveActivityFeedContext = createContext(null);

const readStoredWindow = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch { /* ignore */ }
  return null;
};

const writeStoredWindow = (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch { /* ignore */ }
};

export const LiveActivityFeedProvider = ({ children }) => {
  const location = useLocation();
  // Re-read on every location change so the provider picks up post-login state.
  const currentUser = useMemo(() => getCurrentUser(), [location.pathname]);
  const isAdmin = !!currentUser && isAdminRole(currentUser.role || currentUser.roleName);

  const [events, setEvents] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const [moduleFilters, setModuleFilters] = useState([]);
  const [status, setStatus] = useState('idle');
  const [settings, setSettings] = useState(null);
  const [windowState, setWindowStateRaw] = useState(() => {
    const stored = readStoredWindow();
    return stored?.state || 'closed';
  });

  const connectionRef = useRef(null);
  const bufferRef = useRef([]);

  const enabled = settings?.enabled !== false;

  const persistWindow = useCallback((next) => {
    const prev = readStoredWindow() || {};
    writeStoredWindow({ ...prev, ...next });
  }, []);

  const setWindowState = useCallback((next) => {
    setWindowStateRaw(next);
    persistWindow({ state: next });
    if (next === 'normal' || next === 'expanded') {
      setUnreadCount(0);
    }
  }, [persistWindow]);

  const addEvent = useCallback((event) => {
    if (!event || !event.eventId) return;
    bufferRef.current = [event, ...bufferRef.current].slice(0, BUFFER_CAP);
    if (!paused) {
      setEvents([...bufferRef.current]);
    }
    // Increment unread when window is not showing the list.
    setUnreadCount((n) => (windowState === 'minimized' || windowState === 'closed' ? n + 1 : 0));
  }, [paused, windowState]);

  const refreshSettings = useCallback(async () => {
    if (!isAdmin) return null;
    try {
      // The admin check above reads from the localStorage-cached user display,
      // which survives a full page reload — but the in-memory access token does
      // not. On a cold reload this provider mounts (and fires) before
      // ProtectedRoute's silent cookie-based refresh restores the token, so wait
      // for session init first or this request goes out with no Authorization
      // header and gets a bare 403 (not 401, so the axios retry never kicks in).
      await initializeSession();
      const data = await getFeedSettings();
      setSettings(data);
      return data;
    } catch {
      return null;
    }
  }, [isAdmin]);

  const setEnabled = useCallback(async (next) => {
    if (!isAdmin) return null;
    const data = await updateFeedSettings(next);
    setSettings(data);
    return data;
  }, [isAdmin]);

  // Load settings once on mount (admins only).
  useEffect(() => {
    if (!isAdmin) return;
    refreshSettings();
  }, [isAdmin, refreshSettings]);

  // Manage the SSE connection based on admin + enabled + window visibility.
  useEffect(() => {
    if (!isAdmin) return undefined;
    if (!enabled) {
      if (connectionRef.current) {
        connectionRef.current.disconnect();
        connectionRef.current = null;
      }
      setStatus('disabled');
      return undefined;
    }

    // Connect only when the window is actually showing something to the user
    // (normal / expanded / minimized). When closed, stay disconnected and
    // rely on server-side persistence + ring-buffer replay on reopen.
    if (windowState === 'closed') {
      if (connectionRef.current) {
        connectionRef.current.disconnect();
        connectionRef.current = null;
      }
      setStatus('idle');
      return undefined;
    }

    if (connectionRef.current) return undefined;

    const conn = createLiveFeedConnection({
      onEvent: addEvent,
      onStatus: (s) => setStatus(s),
      onDisabled: () => {
        setSettings((prev) => (prev ? { ...prev, enabled: false } : prev));
      },
    });
    conn.connect();
    connectionRef.current = conn;

    return () => {
      conn.disconnect();
      connectionRef.current = null;
    };
  }, [isAdmin, enabled, windowState, addEvent]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    setPaused(false);
    setEvents([...bufferRef.current]);
  }, []);

  const clear = useCallback(() => {
    bufferRef.current = [];
    setEvents([]);
    setUnreadCount(0);
  }, []);

  const toggleModuleFilter = useCallback((module) => {
    setModuleFilters((prev) =>
      prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module]
    );
  }, []);

  const clearModuleFilters = useCallback(() => setModuleFilters([]), []);

  const filteredEvents = useMemo(() => {
    if (!moduleFilters.length) return events;
    return events.filter((e) => moduleFilters.includes(e.module));
  }, [events, moduleFilters]);

  const value = useMemo(() => ({
    isAdmin,
    enabled,
    status,
    settings,
    events: filteredEvents,
    rawEventCount: events.length,
    unreadCount,
    paused,
    moduleFilters,
    windowState,
    setWindowState,
    pause,
    resume,
    clear,
    toggleModuleFilter,
    clearModuleFilters,
    setEnabled,
    refreshSettings,
  }), [
    isAdmin, enabled, status, settings, filteredEvents, events.length,
    unreadCount, paused, moduleFilters, windowState, setWindowState,
    pause, resume, clear, toggleModuleFilter, clearModuleFilters, setEnabled, refreshSettings,
  ]);

  return (
    <LiveActivityFeedContext.Provider value={value}>
      {children}
    </LiveActivityFeedContext.Provider>
  );
};

export const useLiveActivityFeed = () => {
  const ctx = useContext(LiveActivityFeedContext);
  if (!ctx) {
    // Return a no-op shape so non-admin consumers never crash.
    return {
      isAdmin: false,
      enabled: false,
      status: 'idle',
      settings: null,
      events: [],
      rawEventCount: 0,
      unreadCount: 0,
      paused: false,
      moduleFilters: [],
      windowState: 'closed',
      setWindowState: () => {},
      pause: () => {},
      resume: () => {},
      clear: () => {},
      toggleModuleFilter: () => {},
      clearModuleFilters: () => {},
      setEnabled: async () => {},
      refreshSettings: async () => null,
    };
  }
  return ctx;
};
