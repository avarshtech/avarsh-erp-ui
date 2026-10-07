import { Badge, Button, Popover, Segmented, Select, Space, Tooltip } from 'antd';
import {
  ExpandOutlined, PlayCircleOutlined, QuestionCircleOutlined, ReloadOutlined, SettingOutlined, StopOutlined, TrophyOutlined,
} from '@ant-design/icons';
import { QUALITY_OPTIONS } from '../scene/quality';
import DataStatus from './DataStatus';
import Legend from './Legend';

const MODES = [{ value: 'live', label: 'Live' }, { value: 'simulation', label: 'Simulation' }];
const timeOf = (iso) => (iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null);

/** Title, live/simulation switch, freshness, and the screen's few actions. */
export default function TopBar({ branchName, clock, loading, sources, mode, onMode, replay, earned, onAchievements, onRules, quality, onQuality, onFullscreen, onRefresh }) {
  const updated = timeOf(clock?.at);
  return (
    <div className="vf-topbar">
      <div>
        <h1>Virtual factory</h1>
        <div className="vf-sub">
          {branchName}, {updated ? `updated ${updated}` : 'loading the floor…'} <DataStatus sources={sources} />
        </div>
      </div>
      <Segmented value={mode} onChange={onMode} options={MODES} aria-label="View mode" />
      <div className="vf-spacer" />
      <Space wrap size={8}>
        {mode === 'live' && (
          <Button icon={replay.active ? <StopOutlined /> : <PlayCircleOutlined />} onClick={replay.active ? replay.stop : replay.start} disabled={!replay.total}>
            {replay.active ? `Stop replay ${replay.step}/${replay.total}` : 'Replay today'}
          </Button>
        )}
        <Badge count={earned} size="small" color="#6366f1">
          <Button icon={<TrophyOutlined />} onClick={onAchievements}>Achievements</Button>
        </Badge>
        <Tooltip title="Factory Health rules">
          <Button icon={<SettingOutlined />} onClick={onRules} aria-label="Factory Health rules" />
        </Tooltip>
        <Select value={quality} onChange={onQuality} options={QUALITY_OPTIONS} style={{ width: 138 }} aria-label="Graphics quality" />
        <Popover content={<Legend />} title="Reading the factory" trigger="click" placement="bottomRight">
          <Button icon={<QuestionCircleOutlined />} aria-label="How to read the factory" />
        </Popover>
        <Tooltip title="Full screen">
          <Button icon={<ExpandOutlined />} onClick={onFullscreen} aria-label="Full screen" />
        </Tooltip>
        <Tooltip title="Refresh now">
          <Button icon={<ReloadOutlined spin={loading} />} onClick={onRefresh} aria-label="Refresh now" />
        </Tooltip>
      </Space>
    </div>
  );
}
