import { zoneCentre } from '../engine/layout';
import Inspector from './Inspector';
import JourneyPanel from './JourneyPanel';
import SimulationPanel from './sim/SimulationPanel';

/** The right-hand panel: the simulation in simulation mode, else what is selected, else the followed order. */
export default function RightPanel({ mode, view, model, sim, focus, onSimulate }) {
  let content = null;
  if (mode === 'simulation') {
    content = <SimulationPanel snapshot={view.snapshot} sim={sim} />;
  } else if (focus.selection) {
    content = (
      <Inspector selection={focus.selection} snapshot={view.snapshot} model={model} insights={view.insights}
        onClose={focus.clear} onFollow={focus.follow} />
    );
  } else if (view.journey) {
    const showOnFloor = () => {
      const [x, , z] = zoneCentre(view.journey.currentZone);
      focus.fly(x, z, 55);
    };
    content = <JourneyPanel journey={view.journey} onClose={focus.unfollow} onShow={showOnFloor} onSimulate={onSimulate} />;
  }
  if (!content) return null;
  return <div className={`vf-right ${mode === 'live' ? 'vf-with-rail' : ''}`}>{content}</div>;
}
