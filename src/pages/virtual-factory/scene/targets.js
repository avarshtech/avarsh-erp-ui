import { CUTTING_TABLE, PORTS, RECEIVING_DOORS, SHIPPING_DOORS, zoneCentre } from '../engine/layout';

/**
 * Where a selected thing is on the floor, and how big a ring marks it — so the camera can fly there
 * and the selection ring can sit under it. Null when the scene has no place for it.
 */
export const targetPosition = (select, model) => {
  if (!select) return null;
  const { type, id } = select;
  if (type === 'zone') {
    const [x, , z] = zoneCentre(id);
    return { x, z, radius: 6, distance: 52 };
  }
  if (type === 'line') {
    const line = model.sewingLines.find((l) => String(l.id) === String(id));
    return line ? { x: 7.5, z: line.z, radius: 4.5, distance: 30 } : null;
  }
  if (type === 'station') {
    const machine = model.machines.find((m) => m.select?.id === id);
    return machine ? { x: machine.x, z: machine.z, radius: 1, distance: 12 } : null;
  }
  if (type === 'cuttingTable') {
    const table = model.cuttingTables.find((t) => String(t.id) === String(id));
    return table ? { x: (CUTTING_TABLE.x0 + CUTTING_TABLE.x1) / 2, z: table.z, radius: 4, distance: 30 } : null;
  }
  if (type === 'lot') {
    const roll = model.rolls.find((r) => r.select?.id === id);
    return roll ? { x: roll.x, z: roll.z, radius: 1.2, distance: 16 } : null;
  }
  if (type === 'grn' || type === 'po') {
    const truck = model.trucks.find((t) => t.select?.id === id);
    if (truck?.state === 'parked') return { x: -67, z: RECEIVING_DOORS[truck.door % RECEIVING_DOORS.length], radius: 6, distance: 40 };
    return { x: PORTS.dock[0], z: PORTS.dock[1], radius: 5, distance: 45 };
  }
  if (type === 'shipment') {
    const truck = model.trucks.find((t) => t.select?.id === id);
    return truck ? { x: 67, z: SHIPPING_DOORS[truck.door % SHIPPING_DOORS.length], radius: 6, distance: 40 } : { x: 51, z: 30, radius: 5, distance: 45 };
  }
  return null;
};
