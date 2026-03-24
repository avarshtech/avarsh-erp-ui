import { useState, useEffect, useCallback } from 'react';
import { registerServiceWorker, applyUpdate } from '../utils/swRegistration';

const useServiceWorker = () => {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    registerServiceWorker(
      () => setNeedRefresh(true),
      () => setOfflineReady(true),
    );
  }, []);

  const updateApp = useCallback(() => {
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
    updateApp,
    dismissUpdate,
    dismissOfflineReady,
  };
};

export default useServiceWorker;
