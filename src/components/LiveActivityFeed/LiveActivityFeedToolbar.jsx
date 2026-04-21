import { Badge, Button, Popover, Space, Tooltip, Typography } from 'antd';
import {
  ClearOutlined,
  CloseOutlined,
  ExpandOutlined,
  CompressOutlined,
  FilterOutlined,
  MinusOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useLiveActivityFeed } from '../../context/LiveActivityFeedContext';
import { MODULE_CONFIG, ALL_MODULE_KEYS } from '../../utils/liveFeedModuleConfig';

const { Text } = Typography;

const LiveActivityFeedToolbar = () => {
  const {
    status,
    paused,
    pause,
    resume,
    clear,
    moduleFilters,
    toggleModuleFilter,
    clearModuleFilters,
    windowState,
    setWindowState,
  } = useLiveActivityFeed();

  const isExpanded = windowState === 'expanded';
  const hasActiveFilters = moduleFilters.length > 0;

  const filterPopover = (
    <div className="live-feed-filter-popover-wrap">
      <div className="live-feed-filter-popover-header">
        <Text type="secondary" style={{ fontSize: 12 }}>
          {hasActiveFilters
            ? `Showing ${moduleFilters.length} of ${ALL_MODULE_KEYS.length} modules`
            : 'Showing all modules — click to filter'}
        </Text>
        {hasActiveFilters && (
          <Button
            type="link"
            size="small"
            onClick={clearModuleFilters}
            style={{ padding: 0, height: 'auto', fontSize: 12 }}
          >
            Clear
          </Button>
        )}
      </div>
      <div className="live-feed-filter-popover">
        {ALL_MODULE_KEYS.map((key) => {
          const cfg = MODULE_CONFIG[key];
          const active = moduleFilters.includes(key);
          const Icon = cfg.icon;
          return (
            <button
              key={key}
              type="button"
              className={`live-feed-filter-chip ${active ? 'is-active' : ''}`}
              style={{
                color: active ? cfg.color : undefined,
                borderColor: active ? cfg.color : undefined,
                backgroundColor: active ? cfg.bg : undefined,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                toggleModuleFilter(key);
              }}
            >
              <Icon /> <span>{cfg.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const statusLabel = {
    idle: 'Idle',
    connected: 'Live',
    reconnecting: 'Reconnecting…',
    stale: 'Reconnecting…',
    disabled: 'Disabled',
    unauthorized: 'No access',
  }[status] || status;

  const statusDot = status === 'connected'
    ? 'live-feed-status-dot live-feed-status-dot--live'
    : status === 'disabled'
      ? 'live-feed-status-dot live-feed-status-dot--off'
      : 'live-feed-status-dot live-feed-status-dot--warn';

  return (
    <div className="live-feed-toolbar">
      <div className="live-feed-toolbar__left">
        <span className={statusDot} />
        <span className="live-feed-toolbar__status-label">Activity · {statusLabel}</span>
      </div>
      <Space size={2}>
        <Tooltip title="Filter modules">
          <Popover
            content={filterPopover}
            trigger="click"
            placement="bottomRight"
          >
            <Badge
              count={moduleFilters.length}
              size="small"
              offset={[-4, 4]}
              color="blue"
            >
              <Button type="text" size="small" icon={<FilterOutlined />} />
            </Badge>
          </Popover>
        </Tooltip>
        <Tooltip title={paused ? 'Resume' : 'Pause'}>
          <Button
            type="text"
            size="small"
            icon={paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
            onClick={() => (paused ? resume() : pause())}
          />
        </Tooltip>
        <Tooltip title="Clear">
          <Button type="text" size="small" icon={<ClearOutlined />} onClick={clear} />
        </Tooltip>
        <Tooltip title={isExpanded ? 'Collapse' : 'Expand'}>
          <Button
            type="text"
            size="small"
            icon={isExpanded ? <CompressOutlined /> : <ExpandOutlined />}
            onClick={() => setWindowState(isExpanded ? 'normal' : 'expanded')}
          />
        </Tooltip>
        <Tooltip title="Minimize">
          <Button
            type="text"
            size="small"
            icon={<MinusOutlined />}
            onClick={() => setWindowState('minimized')}
          />
        </Tooltip>
        <Tooltip title="Close">
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={() => setWindowState('closed')}
          />
        </Tooltip>
      </Space>
    </div>
  );
};

export default LiveActivityFeedToolbar;
