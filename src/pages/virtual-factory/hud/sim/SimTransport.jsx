import { Button, Segmented, Slider, Space, Tooltip } from 'antd';
import { PauseOutlined, CaretRightOutlined, ReloadOutlined, BorderOutlined } from '@ant-design/icons';
import { workingDayDate } from '../../engine/simulation/calendar';
import { SPEEDS } from '../../hooks/useSimPlayer';

const pad = (n) => String(n).padStart(2, '0');

/** Play the simulated days: play or pause, stop, restart, speed, and a scrubber over the whole run. */
export default function SimTransport({ player, comparison, scenario, capacities, shiftStart }) {
  const { result } = comparison;
  const frame = player.frame;
  const day = frame ? workingDayDate(scenario.startDay, frame.day, capacities.sundayOff) : scenario.startDay;
  const clock = frame ? `${new Date(`${day}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, ${pad(shiftStart + frame.hour)}:00` : '—';
  return (
    <section className="vf-panel vf-rail" aria-label="Simulation playback" style={{ padding: '10px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Space size={6}>
          <Tooltip title={player.playing ? 'Pause' : 'Play'}>
            <Button type="primary" shape="circle" icon={player.playing ? <PauseOutlined /> : <CaretRightOutlined />} onClick={player.playing ? player.pause : player.play} aria-label={player.playing ? 'Pause' : 'Play'} />
          </Tooltip>
          <Tooltip title="Stop"><Button shape="circle" icon={<BorderOutlined />} onClick={player.stop} aria-label="Stop" /></Tooltip>
          <Tooltip title="Restart"><Button shape="circle" icon={<ReloadOutlined />} onClick={player.restart} aria-label="Restart" /></Tooltip>
        </Space>
        <Segmented size="small" value={player.speed} onChange={player.setSpeed} options={SPEEDS.map((s) => ({ value: s, label: `${s}×` }))} aria-label="Speed" />
        <div style={{ minWidth: 150 }}>
          <div className="vf-ticket-kind">Simulated time</div>
          <strong>{clock}</strong>
          <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}> · day {frame ? frame.day + 1 : 1}</span>
        </div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Slider min={0} max={result.totalHours} step={1} value={player.hour} onChange={player.seek} tooltip={{ formatter: (h) => `Working hour ${Math.round(h)}` }} aria-label="Simulation progress" />
        </div>
      </div>
    </section>
  );
}
