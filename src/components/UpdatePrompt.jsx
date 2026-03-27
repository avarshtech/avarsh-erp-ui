import { useEffect } from 'react';
import { Button, Space, App as AntdApp } from 'antd';
import useServiceWorker from '../hooks/useServiceWorker';
import useIsPwa from '../hooks/useIsPwa';

const UpdatePrompt = () => {
  const { needRefresh, offlineReady, updateApp, dismissUpdate, dismissOfflineReady } = useServiceWorker();
  const { notification } = AntdApp.useApp();
  const { isPwa } = useIsPwa();

  // "Offline ready" shows on all platforms
  useEffect(() => {
    if (offlineReady) {
      notification.success({
        message: 'App Ready',
        description: 'Avarsh ERP is ready to work offline.',
        duration: 5,
        onClose: dismissOfflineReady,
      });
    }
  }, [offlineReady, notification, dismissOfflineReady]);

  useEffect(() => {
    if (needRefresh && isPwa) {
      notification.info({
        key: 'pwa-update',
        message: 'Update Ready',
        description: 'A new version of Avarsh ERP is ready. Restart to apply the update.',
        duration: 0,
        btn: (
          <Space>
            <Button
              size="small"
              onClick={() => {
                dismissUpdate();
                notification.destroy('pwa-update');
              }}
            >
              Later
            </Button>
            <Button
              type="primary"
              size="small"
              onClick={() => {
                notification.destroy('pwa-update');
                // UpdateOverlay takes over from here — full-screen experience
                updateApp();
              }}
            >
              Restart Now
            </Button>
          </Space>
        ),
        onClose: dismissUpdate,
      });
    }
  }, [needRefresh, isPwa, notification, updateApp, dismissUpdate]);

  return null;
};

export default UpdatePrompt;
