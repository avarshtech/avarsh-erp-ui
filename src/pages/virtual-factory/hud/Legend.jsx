import { STATUS_COLOURS } from '../scene/machines/machineFrame';
import { UNIFORMS } from '../engine/scene/appearance';

const swatch = (colour) => (
  <span aria-hidden style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: colour, marginInlineEnd: 6 }} />
);

const UNIFORM_LABELS = [['cutting', 'Cutting'], ['sewing', 'Sewing'], ['qc', 'Quality (white coat)'], ['finishing', 'Finishing'], ['packing', 'Packing'], ['store', 'Stores (hi-vis)'], ['shipping', 'Dispatch']];

/** How to read and move around the factory. */
export default function Legend() {
  return (
    <div style={{ width: 300, fontSize: 12.5 }}>
      <p style={{ margin: '0 0 8px' }}>Drag to move, right-drag to turn, scroll to zoom. Click a machine, a person, a table, a sign or a truck to see its details.</p>
      <strong>Machine lamps</strong>
      <ul className="vf-plain-list" style={{ margin: '4px 0 8px' }}>
        <li>{swatch(STATUS_COLOURS.RUNNING)}Running: output entered in the last two hours</li>
        <li>{swatch(STATUS_COLOURS.IDLE)}Idle: no recent output, or no operator</li>
        <li>{swatch(STATUS_COLOURS.DOWN)}Down: shown in simulation; the ERP has no breakdown log yet</li>
        <li>{swatch(STATUS_COLOURS.MAINTENANCE)}Maintenance: shown in simulation; the ERP has no maintenance log yet</li>
      </ul>
      <strong>Uniforms</strong>
      <ul className="vf-plain-list" style={{ margin: '4px 0 8px', columns: 2 }}>
        {UNIFORM_LABELS.map(([k, label]) => <li key={k}>{swatch(UNIFORMS[k].shirt)}{label}</li>)}
      </ul>
      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
        Head-counts are real on sewing lines (operators present); elsewhere people show where work is happening.
        Zones marked “Demo data” read a module that still runs on sample data.
      </p>
    </div>
  );
}
