import { makeEvent } from '../eventCatalog.js';
import { formatQty } from '../util.js';

const firstHour = (frames, test) => {
  const i = frames.findIndex(test);
  return i < 0 ? null : i + 0.01;
};

/** The moments worth showing in a simulation run, each with the visual event it plays. */
export const simMilestones = (result, scenario) => {
  const f = result.frames;
  const title = scenario.label || 'Simulated order';
  const list = [
    [firstHour(f, (x) => x.material), makeEvent('MATERIAL_RECEIVED', { key: 'material', title, detail: 'Fabric in the store — cutting can start' })],
    [firstHour(f, (x) => x.cut > 0), makeEvent('CUTTING_PROGRESS', { key: 'cut', title, detail: 'Cutting started' })],
    [firstHour(f, (x) => x.sewn > 0), makeEvent('ORDER_PRODUCTION', { key: 'sew', title, detail: 'Sewing lines started' })],
    [firstHour(f, (x) => x.packed > 0), makeEvent('PACKING_STARTED', { key: 'pack', title, detail: 'First cartons being packed' })],
    [firstHour(f, (x) => x.packed >= result.total * 0.5), makeEvent('PACKING_COMPLETED', { key: 'half', title, detail: `${formatQty(result.total / 2)} pcs packed` })],
    [result.finished ? result.totalHours - 0.01 : null, makeEvent('DISPATCH_DEPARTED', {
      key: 'ship', title: `→ ${scenario.destination || 'Customer'}`, detail: `${title} · ${formatQty(result.total)} pcs shipped`, destination: scenario.destination || 'Customer',
    })],
  ];
  return list.filter(([hour]) => hour != null).map(([hour, event]) => ({ hour, event }));
};
