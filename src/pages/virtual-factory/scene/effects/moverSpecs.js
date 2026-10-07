import { fabricColour } from '../../engine/colours';
import { inboundRoute, outboundRoute, PORTS, routeBetween, vanRoute, zoneCentre } from '../../engine/layout';

const OFFICE_BOARD = [-50, 3.6, 23.4];
const flatTo3d = (points, y = 0) => points.map(([x, z, flag]) => [x, y, z, flag]);
const back = (points) => [...points].reverse().map(([x, z]) => [x, z]);

const activeLine = (model, lineId) => model.sewingLines.find((l) => l.id === lineId)
  || model.sewingLines.find((l) => l.active && !l.down) || model.sewingLines[0];

const cart = (id, from, to, payload, label) => ({ id, kind: 'cart', path: flatTo3d(routeBetween(from, to)), speed: 2.4, payload, label });

/** The visual an ERP event plays, as a mover along a route (null when the event only pulses or is listed). */
export const moverFromEvent = (event, model, n) => {
  if (event.priority === 'low' && !event.replay) return null;
  const id = `ev-${event.id}`;
  const label = {
    title: `${event.icon} ${event.label}`,
    text: [event.demo && 'Demo data', event.title, event.detail].filter(Boolean).join(' · '),
    tone: event.priority === 'high' ? 'primary' : 'neutral',
  };
  const colour = fabricColour(event.colour);
  const line = activeLine(model, event.lineId);
  switch (event.visual) {
    case 'ticket': return { id, kind: 'doc', path: [[OFFICE_BOARD[0] + 4, 16, 34], OFFICE_BOARD], speed: 6, hold: 4, label, doc: event };
    case 'envelope': return { id, kind: 'doc', path: [OFFICE_BOARD, [-70, 14, 40], [-250, 12, 50]], speed: 14, label, doc: event };
    case 'supplier-truck': {
      const route = inboundRoute(n % 2);
      return { id, kind: 'truck', livery: 'supplier', path: flatTo3d([...route, ...back(route).slice(1)]), waits: { [route.length - 1]: 14 }, speed: 9, label };
    }
    case 'rolls-to-store': return { ...cart(id, PORTS.dock, PORTS.store, { kind: 'rolls', colour: '#e6dcc4' }, label), kind: 'forklift' };
    case 'roll-trolley': return cart(id, PORTS.store, PORTS.cuttingTable(n), { kind: 'rolls', colour }, label);
    case 'trims-cart': return line ? cart(id, PORTS.trims, PORTS.lineHead(line.z), { kind: 'cartons' }, label) : null;
    case 'bundles': return cart(id, PORTS.bundling, PORTS.staging, { kind: 'bundles', colour }, label);
    case 'bundle-trolley': return line ? cart(id, PORTS.staging, PORTS.lineHead(line.z), { kind: 'bundles', colour }, label) : null;
    case 'garments-to-qc': return line ? cart(id, PORTS.lineEnd(line.z), PORTS.qc, { kind: 'garments', colour }, label) : null;
    case 'garment-cart': return cart(id, PORTS.qc, PORTS.finishingIn, { kind: 'garments', colour }, label);
    case 'van': return { id, kind: 'van', path: flatTo3d(vanRoute()), speed: 8, label: { ...label, title: `🚐 → ${event.destination || 'Process vendor'}` } };
    case 'cartons-to-fg': return { ...cart(id, PORTS.packing, PORTS.fg, { kind: 'cartons' }, label), kind: 'forklift' };
    case 'truck-dock': {
      const route = outboundRoute(n % 2);
      return { id, kind: 'truck', livery: 'dispatch', path: flatTo3d([...back(route).map((p, i, arr) => (i === arr.length - 1 ? [...p, 'reverse'] : p))]), speed: 9, hold: 8, label };
    }
    case 'truck-depart': return { id, kind: 'truck', livery: 'dispatch', path: flatTo3d(outboundRoute(n % 2)), speed: 7, label: { ...label, title: `🚚 → ${event.destination || 'Customer'}` } };
    case 'line-start': case 'beacon': case 'cut': case 'pulse': {
      const [x, , z] = event.visual === 'line-start' && line ? [-1, 0, line.z] : zoneCentre(event.zone);
      return { id, kind: 'pulse', path: [[x, 0.05, z]], hold: 3.2, colour: event.priority === 'high' ? '#ef4444' : '#6366f1' };
    }
    default: return null;
  }
};

/** Everyday traffic between events, chosen from what the floor is doing right now. */
export const ambientMover = (model, n) => {
  const running = model.sewingLines.filter((l) => l.active && !l.down);
  const roll = n % 10;
  const id = `amb-${n}`;
  if (running.length && roll < 4) {
    const line = running[n % running.length];
    const thread = model.machines.find((m) => m.key.startsWith(`m-${line.id}-`))?.thread || '#9aa3b5';
    return cart(id, PORTS.staging, PORTS.lineHead(line.z), { kind: 'bundles', colour: thread });
  }
  if (running.length && roll < 7) {
    const line = running[(n + 1) % running.length];
    return cart(id, PORTS.lineEnd(line.z), PORTS.qc, { kind: 'garments', colour: '#d7dce3' });
  }
  if (roll < 9 && model.zones.packing?.tone === 'busy') return { ...cart(id, PORTS.packing, PORTS.fg, { kind: 'cartons' }), kind: 'forklift' };
  if (model.zones.finishing?.tone === 'busy') return cart(id, PORTS.qc, PORTS.finishingIn, { kind: 'garments', colour: '#d7dce3' });
  return null;
};
