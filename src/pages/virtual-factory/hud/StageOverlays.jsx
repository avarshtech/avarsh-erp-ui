import AttentionList from './AttentionList';
import DocumentRail from './DocumentRail';
import EventTicker from './EventTicker';
import EventToasts from './EventToasts';
import HealthCard from './HealthCard';
import MobilePanels from './MobilePanels';
import SimTransport from './sim/SimTransport';

/** Panels over the floor: toasts on top, health and attention on the left, documents or playback below. */
export default function StageOverlays({ mode, view, events, toasts, sim, focus, rules, onReplay, onRules }) {
  const pickEvent = (e) => focus.focus(e.ref || { type: 'zone', id: e.zone });
  return (
    <>
      <EventToasts toasts={toasts.toasts} onDismiss={toasts.dismiss} onShow={pickEvent} />
      {mode === 'live' && view.insights && (
        <div className="vf-left">
          <HealthCard health={view.insights.health} onRules={onRules} />
          <AttentionList items={view.insights.attention} onPick={(item) => focus.focus(item.target)} />
        </div>
      )}
      <div className={`vf-bottom${mode === 'simulation' ? ' vf-sim' : ''}`}>
        {mode === 'live' ? (
          <DocumentRail snapshot={view.snapshot} followed={focus.followed} selection={focus.selection} onFollow={focus.follow} onSelect={focus.focus} />
        ) : (
          sim.comparison && <SimTransport player={sim.player} comparison={sim.comparison} scenario={sim.scenario} capacities={sim.capacities} shiftStart={rules.shift.startHour} />
        )}
        <EventTicker events={events} onPick={pickEvent} onReplay={mode === 'live' ? onReplay : null} />
      </div>
      {mode === 'live' && <MobilePanels view={view} events={events} focus={focus} onRules={onRules} />}
    </>
  );
}
