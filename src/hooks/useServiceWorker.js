import { useState, useEffect, useCallback } from 'react';
import { registerServiceWorker, applyUpdate } from '../utils/swRegistration';

const useServiceWorker = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    registerServiceWorker(
      () => setNeedRefresh(true),
      () => setOfflineReady(true),
    );
  }, []);

  const updateApp = useCallback(() => {
    setUpdating(true);
    // Notify UpdateOverlay (separate component with its own state)
    window.dispatchEvent(new Event('pwa-updating'));
    applyUpdate();
  }, []);

  const dismissUpdate = useCallback(() => {
    setNeedRefresh(false);
  }, []);

  const dismissOfflineReady = useCallback(() => {
    setOfflineReady(false);
  }, []);

  return {
    needRefresh,
    offlineReady,
    updating,
    updateApp,
    dismissUpdate,
    dismissOfflineReady,
  };
};

export default useServiceWorker;
