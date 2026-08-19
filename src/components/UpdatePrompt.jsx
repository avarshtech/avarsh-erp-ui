import { useEffect } from 'react';
import { Button, Modal, Space, Typography, theme, App as AntdApp } from 'antd';
import { CloudDownloadOutlined } from '@ant-design/icons';
import useServiceWorker from '../hooks/useServiceWorker';
import useIsPwa from '../hooks/useIsPwa';

const { Text } = Typography;

const UpdatePrompt = () => {
  const {
    needRefresh, offlineReady, updating, updateApp, dismissUpdate, dismissOfflineReady,
  } = useServiceWorker();
  const { notification } = AntdApp.useApp();
  const { isPwa } = useIsPwa();
  const { token } = theme.useToken();

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

  // Browser tabs are never interrupted — they pick up the new build at the auth
  // boundary instead (see logoutUser() and the Login page). The installed PWA has
  // no such boundary, because SessionContext keeps its session alive indefinitely,
  // so it is the one context that has to be told.
  if (!isPwa) return null;

  return (
    <Modal
      open={needRefresh}
      onCancel={dismissUpdate}
      // Dismissable right up until the user commits to updating, then not —
      // the reload is already on its way.
      closable={!updating}
      keyboard={!updating}
      maskClosable={false}
      centered
      width={430}
      title={null}
      footer={null}
    >
      <div style={{ textAlign: 'center', padding: '8px 4px 4px' }}>
        <div
          style={{
            width: 56,
            height: 56,
            margin: '0 auto 20px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: token.colorPrimaryBg,
            color: token.colorPrimary,
            fontSize: 26,
          }}
        >
          <CloudDownloadOutlined />
        </div>

        <Typography.Title level={4} style={{ marginTop: 0, marginBottom: 8 }}>
          Update Available
        </Typography.Title>

        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          A new version of Avarsh ERP is ready. Update now, or keep working —
          it installs automatically when you sign out or close the app.
        </Text>

        <Space size={12} style={{ width: '100%', justifyContent: 'center' }}>
          <Button size="large" disabled={updating} onClick={dismissUpdate}>
            Later
          </Button>
          <Button
            type="primary"
            size="large"
            loading={updating}
            onClick={updateApp}
            icon={!updating ? <CloudDownloadOutlined /> : undefined}
          >
            {updating ? 'Updating…' : 'Update Now'}
          </Button>
        </Space>
      </div>
    </Modal>
  );
};

export default UpdatePrompt;
