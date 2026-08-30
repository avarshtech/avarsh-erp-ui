import { useState, useEffect, useCallback } from 'react';
import {
  registerServiceWorker,
  subscribeToUpdates,
  applyUpdate,
  UPDATE_CANCELLED_EVENT,
} from '../utils/swRegistration';

const useServiceWorker = () => {
  const [updateReady, setUpdateReady] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    registerServiceWorker(() => setOfflineReady(true));
    return subscribeToUpdates(setUpdateReady);
  }, []);

  // The reload can be refused by an unsaved-changes prompt. When that happens
  // the user is still here, so drop out of the updating state and let them
  // choose again rather than leaving the overlay up forever.
  useEffect(() => {
    const onCancelled = () => setUpdating(false);
    window.addEventListener(UPDATE_CANCELLED_EVENT, onCancelled);
    return () => window.removeEventListener(UPDATE_CANCELLED_EVENT, onCancelled);
  }, []);

  const updateApp = useCallback(() => {
    setUpdating(true);
    // Notify UpdateOverlay (separate component with its own state)
    window.dispatchEvent(new Event('pwa-updating'));
    applyUpdate();
  }, []);

  // Dismissing only hides the prompt. The build stays installed and waiting;
  // signing out or closing the app applies it.
  const dismissUpdate = useCallback(() => {
    setDismissed(true);
  }, []);

  const dismissOfflineReady = useCallback(() => {
    setOfflineReady(false);
  }, []);

  return {
    needRefresh: updateReady && !dismissed,
    offlineReady,
    updating,
    updateApp,
    dismissUpdate,
    dismissOfflineReady,
  };
};

export default useServiceWorker;
