import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  FloatButton,
  Grid,
  Typography,
} from 'antd';
import {
  CloseOutlined,
  ExpandOutlined,
  MessageOutlined,
  PauseOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { useLiveActivityFeed } from '../../context/LiveActivityFeedContext';
import LiveActivityFeedItem from './LiveActivityFeedItem';
import LiveActivityFeedToolbar from './LiveActivityFeedToolbar';

const { Text } = Typography;
const { useBreakpoint } = Grid;

const POSE_KEY = 'liveFeed.pose';

const DEFAULT_POSES = {
  lg: { right: 24, bottom: 24, width: 380, height: 560, expandedWidth: 520, expandedHeight: 780 },
  md: { right: 16, bottom: 16, width: 360, height: 520, expandedWidth: 520, expandedHeight: 680 },
};

const readPose = (key) => {
  try {
    const raw = localStorage.getItem(`${POSE_KEY}.${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch { /* ignore */ }
  return null;
};

const writePose = (key, pose) => {
  try {
    localStorage.setItem(`${POSE_KEY}.${key}`, JSON.stringify(pose));
  } catch { /* ignore */ }
};

const VIEWPORT_MARGIN_TOP = 16;
const VIEWPORT_MARGIN_SIDE = 16;
const MIN_VISIBLE_WIDTH = 320;
const MIN_VISIBLE_HEIGHT = 320;

const clampToViewport = (pose) => {
  if (typeof window === 'undefined') return pose;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const effectiveMinW = Math.min(MIN_VISIBLE_WIDTH, Math.max(240, vw - 2 * VIEWPORT_MARGIN_SIDE));
  const effectiveMinH = Math.min(MIN_VISIBLE_HEIGHT, Math.max(240, vh - VIEWPORT_MARGIN_TOP - VIEWPORT_MARGIN_SIDE));
  const maxRight = Math.max(VIEWPORT_MARGIN_SIDE, vw - effectiveMinW - VIEWPORT_MARGIN_SIDE);
  const maxBottom = Math.max(VIEWPORT_MARGIN_SIDE, vh - effectiveMinH - VIEWPORT_MARGIN_TOP);
  const right = Math.max(VIEWPORT_MARGIN_SIDE, Math.min(pose.right, maxRight));
  const bottom = Math.max(VIEWPORT_MARGIN_SIDE, Math.min(pose.bottom, maxBottom));
  const maxW = Math.max(effectiveMinW, vw - right - VIEWPORT_MARGIN_SIDE);
  const maxH = Math.max(effectiveMinH, vh - bottom - VIEWPORT_MARGIN_TOP);
  const w = Math.min(pose.width, maxW);
  const h = Math.min(pose.height, maxH);
  return { ...pose, width: w, height: h, right, bottom };
};

const clampSize = (size, right, bottom) => {
  if (typeof window === 'undefined') return size;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const effectiveMinW = Math.min(MIN_VISIBLE_WIDTH, Math.max(240, vw - 2 * VIEWPORT_MARGIN_SIDE));
  const effectiveMinH = Math.min(MIN_VISIBLE_HEIGHT, Math.max(240, vh - VIEWPORT_MARGIN_TOP - VIEWPORT_MARGIN_SIDE));
  const maxW = Math.max(effectiveMinW, vw - right - VIEWPORT_MARGIN_SIDE);
  const maxH = Math.max(effectiveMinH, vh - bottom - VIEWPORT_MARGIN_TOP);
  return {
    width: Math.max(effectiveMinW, Math.min(size.width, maxW)),
    height: Math.max(effectiveMinH, Math.min(size.height, maxH)),
  };
};

const LiveActivityFeedWindow = () => {
  const screens = useBreakpoint();
  const location = useLocation();
  const {
    isAdmin,
    enabled,
    events,
    rawEventCount,
    unreadCount,
    paused,
    windowState,
    setWindowState,
  } = useLiveActivityFeed();

  const listRef = useRef(null);
  const autoFollow = useRef(true);
  const [poseVersion, setPoseVersion] = useState(0);

  const isMobile = !screens.md;
  const isTablet = screens.md && !screens.lg;
  const poseKey = screens.lg ? 'lg' : screens.md ? 'md' : 'xs';

  const isAdminRoute = location.pathname.startsWith('/admin');
  const shouldRender = isAdmin && isAdminRoute;

  // Force re-render on browser resize so the window re-clamps.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => setPoseVersion((v) => v + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const basePose = readPose(poseKey) || DEFAULT_POSES[poseKey === 'xs' ? 'md' : poseKey];
  const pose = clampToViewport(basePose);

  const currentSize = useMemo(() => {
    const desired = windowState === 'expanded'
      ? { width: pose.expandedWidth || pose.width, height: pose.expandedHeight || pose.height }
      : { width: pose.width, height: pose.height };
    return clampSize(desired, pose.right, pose.bottom);
    // poseVersion is read indirectly via window.innerWidth/Height in clampSize; include it so the memo refreshes on resize.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose, windowState, poseVersion]);

  // Keep the list scrolled to top (newest first) when user is following.
  useEffect(() => {
    if (!listRef.current) return;
    if (!autoFollow.current) return;
    listRef.current.scrollTop = 0;
  }, [events.length]);

  const onListScroll = useCallback(() => {
    if (!listRef.current) return;
    autoFollow.current = listRef.current.scrollTop <= 8;
  }, []);

  /* ----------------------------------------------------------------- */
  /* Drag (desktop + tablet only)                                        */
  /* ----------------------------------------------------------------- */
  const dragState = useRef(null);

  const onHeaderPointerDown = useCallback((e) => {
    if (isMobile) return;
    if (e.button !== undefined && e.button !== 0) return;
    dragState.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: pose.right,
      startBottom: pose.bottom,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, [pose.right, pose.bottom, isMobile]);

  const onHeaderPointerMove = useCallback((e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    const next = clampToViewport({
      ...pose,
      right: dragState.current.startRight - dx,
      bottom: dragState.current.startBottom - dy,
    });
    writePose(poseKey, next);
    setPoseVersion((v) => v + 1);
  }, [pose, poseKey]);

  const onHeaderPointerUp = useCallback((e) => {
    dragState.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  /* ----------------------------------------------------------------- */
  /* Rendering                                                           */
  /* ----------------------------------------------------------------- */

  if (!shouldRender) return null;

  // FloatButton to open when closed (admin-only, admin-route-only)
  if (windowState === 'closed') {
    return (
      <FloatButton
        icon={<MessageOutlined />}
        type="primary"
        tooltip={enabled ? 'Open live activity feed' : 'Live feed is disabled'}
        style={{ right: 24, bottom: 24 }}
        onClick={() => setWindowState(isMobile ? 'expanded' : 'normal')}
        badge={unreadCount > 0 ? { count: unreadCount, overflowCount: 99 } : undefined}
      />
    );
  }

  // Minimized pill
  if (windowState === 'minimized') {
    return (
      <button
        type="button"
        className="live-feed-minimized-pill"
        onClick={() => setWindowState('normal')}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
        }}
      >
        <span className="live-feed-status-dot live-feed-status-dot--live" />
        <span>Live feed</span>
        {unreadCount > 0 && (
          <Badge count={unreadCount} overflowCount={99} style={{ backgroundColor: '#dc2626' }} />
        )}
      </button>
    );
  }

  // Body content shared by mobile drawer and desktop/tablet floating card
  const body = (
    <>
      <LiveActivityFeedToolbar />
      {paused && (
        <div className="live-feed-paused-banner">
          <PauseOutlined /> Live updates paused — {rawEventCount} buffered
        </div>
      )}
      {!enabled && (
        <div className="live-feed-disabled-banner">
          Live feed is disabled. Re-enable from Admin Dashboard.
        </div>
      )}
      <div
        ref={listRef}
        className="live-feed-list"
        onScroll={onListScroll}
      >
        {events.length === 0 ? (
          <div className="live-feed-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">Waiting for the next action…</Text>}
            />
          </div>
        ) : (
          events.map((evt) => (
            <LiveActivityFeedItem
              key={evt.eventId}
              event={evt}
              density={windowState === 'expanded' ? 'expanded' : 'compact'}
            />
          ))
        )}
      </div>
    </>
  );

  // Mobile: use bottom drawer
  if (isMobile) {
    return (
      <Drawer
        open
        placement="bottom"
        height="100%"
        closable={false}
        onClose={() => setWindowState('closed')}
        styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
        className="live-feed-drawer"
      >
        <div className="live-feed-header live-feed-header--mobile">
          <div className="live-feed-header__title">
            <MessageOutlined /> <span>Live Activity</span>
          </div>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => setWindowState('closed')}
          />
        </div>
        {body}
      </Drawer>
    );
  }

  // Desktop + tablet: floating card
  const positionStyle = {
    position: 'fixed',
    right: pose.right,
    bottom: pose.bottom,
    width: currentSize.width,
    height: currentSize.height,
    zIndex: 1050,
  };

  return (
    <Card
      className="live-feed-window"
      size="small"
      styles={{
        header: { padding: '6px 8px 6px 12px', minHeight: 'auto' },
        body: { padding: 0, height: 'calc(100% - 40px)', display: 'flex', flexDirection: 'column' },
      }}
      title={
        <div
          className="live-feed-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <div className="live-feed-header__title">
            <MessageOutlined />
            <span>Live Activity Feed</span>
          </div>
        </div>
      }
      style={positionStyle}
      data-pose-version={poseVersion}
    >
      {body}
      {isTablet && windowState !== 'expanded' && (
        <Button
          className="live-feed-expand-corner"
          size="small"
          type="text"
          icon={<ExpandOutlined />}
          onClick={() => setWindowState('expanded')}
        />
      )}
    </Card>
  );
};

export default LiveActivityFeedWindow;
