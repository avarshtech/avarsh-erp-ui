import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spin } from 'antd';
import { useBranch } from '../../context/BranchContext';
import { useTheme } from '../../context/ThemeContext';
import { useHealthRules } from './data/useHealthRules';
import { ALL_TIERS, useTwinData } from './data/useTwinData';
import { useTwinRefresh } from './data/useTwinRefresh';
import { buildSceneModel } from './engine/scene/sceneModel';
import { useEventToasts } from './hooks/useEventToasts';
import { useFactoryView } from './hooks/useFactoryView';
import { useFocus } from './hooks/useFocus';
import { usePrefersReducedMotion } from './hooks/usePrefersReducedMotion';
import { useReplay } from './hooks/useReplay';
import { useSimulation } from './hooks/useSimulation';
import AchievementsDrawer from './hud/AchievementsDrawer';
import RightPanel from './hud/RightPanel';
import RulesDrawer from './hud/RulesDrawer';
import StageOverlays from './hud/StageOverlays';
import TopBar from './hud/TopBar';
import FactoryCanvas from './scene/FactoryCanvas';
import { defaultQuality } from './scene/quality';
import './virtualFactory.css';

/**
 * Virtual factory: the garment floor in 3D, driven by live ERP data, with a health score, what needs
 * attention, achievements, order following, "replay today" and a what-if simulation.
 */
export default function VirtualFactoryPage() {
  const health = useHealthRules();
  const data = useTwinData(health.rules);
  const { activeBranchId, activeBranch, loaded: branchesLoaded } = useBranch();
  const branchKey = activeBranchId ?? 'all';
  useTwinRefresh({ load: data.load, reset: data.reset, branchKey, ready: branchesLoaded });
  const { isDarkMode } = useTheme();
  const reducedMotion = usePrefersReducedMotion();
  const [quality, setQuality] = useState(defaultQuality);
  const [mode, setMode] = useState('live');
  const [drawer, setDrawer] = useState(null);
  const cameraApi = useRef(null);
  const labelsRef = useRef(null);
  const stageRef = useRef(null);
  const snapshotRef = useRef(null);
  const modelRef = useRef(null);

  const focus = useFocus({ snapshotRef, modelRef, cameraApi });
  const view = useFactoryView({ data, rules: health.rules, followed: focus.followed });
  const sim = useSimulation({ snapshot: view.snapshot, rules: health.rules, active: mode === 'simulation', branchKey });
  const replay = useReplay(view.story);
  const model = useMemo(() => (view.snapshot && view.insights
    ? buildSceneModel({ snapshot: view.snapshot, insights: view.insights, sim: sim.scene, journey: sim.scene ? null : view.journey })
    : null), [view.snapshot, view.insights, view.journey, sim.scene]);
  useEffect(() => {
    snapshotRef.current = view.snapshot;
    modelRef.current = model;
  }, [view.snapshot, model]);

  const events = useMemo(() => (mode === 'simulation' ? sim.player.events : [...data.events, ...replay.events]),
    [mode, sim.player.events, data.events, replay.events]);
  const toasts = useEventToasts(events);

  const simulateOrder = useCallback(() => {
    sim.forOrder(focus.followed);
    setMode('simulation');
  }, [sim, focus.followed]);
  const changeMode = useCallback((next) => {
    if (next === 'simulation') sim.freeze();
    else sim.unfreeze();
    setMode(next);
  }, [sim]);
  const fullscreen = () => (document.fullscreenElement ? document.exitFullscreen() : stageRef.current?.requestFullscreen?.());

  return (
    <div className="vf-page">
      <TopBar
        branchName={activeBranch?.branchName || 'All branches'} clock={data.clock} loading={data.loading} sources={data.sources}
        mode={mode} onMode={changeMode} replay={replay} earned={view.insights?.achievements.filter((a) => a.earned).length || 0}
        onAchievements={() => setDrawer('achievements')} onRules={() => setDrawer('rules')}
        quality={quality} onQuality={setQuality} onFullscreen={fullscreen} onRefresh={() => data.load(ALL_TIERS)}
      />
      <div className="vf-stage" ref={stageRef}>
        {model ? (
          <div className="vf-canvas" role="img" aria-label={`3D view of the factory floor. ${view.insights?.attention.length || 0} items need attention.`}>
            <FactoryCanvas
              model={model} events={events} night={isDarkMode} quality={quality} reducedMotion={reducedMotion} paused={drawer != null}
              selection={focus.selection} highlightZone={mode === 'live' ? view.journey?.currentZone : null}
              cameraApi={cameraApi} labelsRef={labelsRef} onSelect={focus.select}
            />
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><Spin size="large" tip="Opening the factory floor…"><div style={{ width: 200, height: 60 }} /></Spin></div>
        )}
        <div ref={labelsRef} className="vf-labels" />
        {model && (
          <StageOverlays
            mode={mode} view={view} events={events} toasts={toasts} sim={sim} focus={focus} rules={health.rules}
            onReplay={replay.total ? replay.start : null} onRules={() => setDrawer('rules')}
          />
        )}
        {model && <RightPanel mode={mode} view={view} model={model} sim={sim} focus={focus} onSimulate={simulateOrder} />}
      </div>
      <AchievementsDrawer open={drawer === 'achievements'} onClose={() => setDrawer(null)} achievements={view.insights?.achievements || []} leaderboard={view.insights?.leaderboard || []} />
      <RulesDrawer open={drawer === 'rules'} onClose={() => setDrawer(null)} rules={health.rules} onSave={health.save} updatedAt={health.updatedAt} />
    </div>
  );
}
