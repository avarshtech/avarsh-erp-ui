import { WifiOutlined } from '@ant-design/icons';
import useNetworkStatus from '../hooks/useNetworkStatus';

const OfflineBanner = () => {
  const { isOffline } = useNetworkStatus();

  if (!isOffline) return null;

  return (
    <div className="offline-banner">
      <WifiOutlined style={{ fontSize: 16 }} />
      <span>
        <strong>You are offline</strong> — Some features may be unavailable. Data shown may not be current.
      </span>
    </div>
  );
};

export default OfflineBanner;
