import ScenarioForm from './ScenarioForm';
import SimResult from './SimResult';

/** Simulation mode: try an order and the what-ifs on today's floor and see when it would ship. */
export default function SimulationPanel({ snapshot, sim }) {
  if (!sim.scenario || !sim.capacities || !sim.comparison) return null;
  return (
    <section className="vf-panel" aria-label="Simulation">
      <h2 style={{ fontSize: 15 }}>Simulation</h2>
      <p style={{ margin: '-4px 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
        Starts from today&apos;s floor: the lines, their targets and the recent cutting and packing pace. Nothing is saved.
      </p>
      <SimResult scenario={sim.scenario} capacities={sim.capacities} comparison={sim.comparison} />
      <div style={{ borderTop: '1px solid var(--border-color)', margin: '10px 0' }} />
      <ScenarioForm snapshot={snapshot} capacities={sim.capacities} scenario={sim.scenario} onChange={sim.setScenario} onOrder={sim.forOrder} />
    </section>
  );
}
