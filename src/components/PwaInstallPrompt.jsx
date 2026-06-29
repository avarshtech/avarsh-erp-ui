import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Typography, Space } from 'antd';
import {
  MobileOutlined,
  RocketOutlined,
  WifiOutlined,
  BellOutlined,
  ThunderboltOutlined,
  CloseOutlined,
  AppleOutlined,
  PlusSquareOutlined,
} from '@ant-design/icons';
import useResponsive from '../hooks/useResponsive';

const { Title, Text } = Typography;

const DISMISS_KEY = 'avarsh-pwa-install-dismissed';
const DISMISS_DAYS = 14;

/**
 * PWA install prompt shown on login page for mobile/tablet users.
 * Explains the benefits in simple terms (no "PWA" jargon) and
 * provides install or iOS instructions.
 */
const PwaInstallPrompt = () => {
  const { isMobileOrTablet } = useResponsive();
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const deferredPromptRef = useRef(null);

  useEffect(() => {
    // Only show on mobile/tablet
    if (!isMobileOrTablet) return;

    // Don't show if already installed (standalone or WCO mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.matchMedia('(display-mode: window-controls-overlay)').matches) return;
    if (window.navigator.standalone === true) return;

    // Don't show if dismissed recently
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const daysSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) return;
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(isIOSDevice);

    // Listen for the install prompt (Android/Chrome/Edge)
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // For iOS, show after a short delay (no beforeinstallprompt event)
    let iosTimer;
    if (isIOSDevice) {
      iosTimer = setTimeout(() => setVisible(true), 1500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, [isMobileOrTablet]);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPromptRef.current) return;

    setInstalling(true);
    try {
      deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      if (outcome === 'accepted') {
        setVisible(false);
      }
    } catch (err) {
      console.error('Install prompt failed:', err);
    } finally {
      setInstalling(false);
      deferredPromptRef.current = null;
    }
  }, [isIOS]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="pwa-install-overlay">
      <div className="pwa-install-prompt">
        {/* Close button */}
        <button
          className="pwa-install-close"
          onClick={handleDismiss}
          aria-label="Close"
        >
          <CloseOutlined />
        </button>

        {/* Icon */}
        <div className="pwa-install-icon">
          <MobileOutlined style={{ fontSize: 32 }} />
        </div>

        {/* Title */}
        <Title level={4} style={{ margin: '16px 0 8px', color: 'var(--text-primary)' }}>
          Get the Best Experience
        </Title>

        {/* Description - no PWA jargon */}
        <Text style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'block', marginBottom: 20, lineHeight: 1.6 }}>
          Install Avarsh ERP on your device for a faster, smoother experience —
          just like a native app. It takes only a few seconds and no app store needed.
        </Text>

        {/* Benefits */}
        <div className="pwa-install-benefits">
          <div className="pwa-install-benefit">
            <ThunderboltOutlined style={{ color: '#f59e0b' }} />
            <span>Opens instantly — no browser loading</span>
          </div>
          <div className="pwa-install-benefit">
            <WifiOutlined style={{ color: '#3b82f6' }} />
            <span>Works even with poor network</span>
          </div>
          <div className="pwa-install-benefit">
            <BellOutlined style={{ color: '#8b5cf6' }} />
            <span>Get order & approval notifications</span>
          </div>
          <div className="pwa-install-benefit">
            <RocketOutlined style={{ color: '#22c55e' }} />
            <span>Full-screen, app-like experience</span>
          </div>
        </div>

        {/* iOS manual instructions */}
        {showIOSGuide && (
          <div className="pwa-install-ios-guide">
            <Text strong style={{ fontSize: 14, color: 'var(--text-primary)', display: 'block', marginBottom: 12 }}>
              To install on your {/iPad/.test(navigator.userAgent) ? 'iPad' : 'iPhone'}:
            </Text>
            <div className="pwa-install-ios-step">
              <span className="pwa-install-ios-step-num">1</span>
              <span>Tap the <strong>Share</strong> button <span style={{ fontSize: 18, verticalAlign: 'middle' }}>&#x2191;&#xFE0E;</span> at the bottom of Safari</span>
            </div>
            <div className="pwa-install-ios-step">
              <span className="pwa-install-ios-step-num">2</span>
              <span>Scroll down and tap <strong>"Add to Home Screen"</strong> <PlusSquareOutlined /></span>
            </div>
            <div className="pwa-install-ios-step">
              <span className="pwa-install-ios-step-num">3</span>
              <span>Tap <strong>"Add"</strong> — that's it!</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <Space direction="vertical" size={10} style={{ width: '100%', marginTop: 20 }}>
          <Button
            type="primary"
            size="large"
            block
            loading={installing}
            onClick={handleInstall}
            icon={isIOS ? <AppleOutlined /> : <MobileOutlined />}
            style={{ height: 48, borderRadius: 12, fontSize: 15, fontWeight: 600 }}
          >
            {showIOSGuide ? 'Got it!' : isIOS ? 'How to Install' : 'Install App'}
          </Button>
          <Button
            type="text"
            size="large"
            block
            onClick={handleDismiss}
            style={{
              height: 44,
              borderRadius: 12,
              fontSize: 14,
              color: 'var(--text-muted)',
            }}
          >
            Continue in browser
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
