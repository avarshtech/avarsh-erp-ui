import { useEffect } from 'react';
import { Button, Space, App as AntdApp } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import useServiceWorker from '../hooks/useServiceWorker';
import useIsPwa from '../hooks/useIsPwa';

const UpdatePrompt = () => {
  const { needRefresh, offlineReady, updating, updateApp, dismissUpdate, dismissOfflineReady } = useServiceWorker();
  const { notification } = AntdApp.useApp();
  const { isPwa } = useIsPwa();

  // "Offline ready" shows on all platforms — useful for mobile/tablet web users
  // who see the PWA install prompt and need to know offline mode is available
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
                // Update the notification to show loading state before triggering reload
                notification.info({
                  key: 'pwa-update',
                  message: 'Updating...',
                  description: 'Applying update and restarting the app.',
                  duration: 0,
                  icon: <SyncOutlined spin style={{ color: '#1677ff' }} />,
                  btn: null,
                  closable: false,
                });
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
