/**
 * Walking along a path: two points are walked back and forth with a pause at each end (fetch,
 * then deliver); three or more are walked as a loop. Pure functions of time, so a forklift and its
 * driver, or a cutter and the knife, computed separately stay together.
 */
const DWELL = 1.8;
const cache = new WeakMap();

const measure = (path, loop) => {
  const points = loop ? [...path, path[0]] : path;
  const lengths = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const len = Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
    lengths.push(len);
    total += len;
  }
  return { points, lengths, total };
};

const along = ({ points, lengths }, distance) => {
  let left = distance;
  for (let i = 0; i < lengths.length; i += 1) {
    if (left <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] ? Math.min(1, left / lengths[i]) : 0;
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      return { x: ax + (bx - ax) * f, z: az + (bz - az) * f, dx: bx - ax, dz: bz - az };
    }
    left -= lengths[i];
  }
  return { x: points[0][0], z: points[0][1], dx: 0, dz: 1 };
};

/** Where a walking worker (or vehicle) is at time `t`, which way it faces, and whether it is moving. */
export const walkerAt = (worker, t) => {
  const loop = worker.path.length > 2;
  let geo = cache.get(worker.path);
  if (!geo) {
    geo = measure(worker.path, loop);
    cache.set(worker.path, geo);
  }
  const speed = worker.speed || 0.9;
  const leg = geo.total / speed;
  if (loop) {
    const p = along(geo, ((t + worker.phase * 4) * speed) % geo.total);
    return { x: p.x, z: p.z, heading: Math.atan2(p.dx, p.dz), moving: true };
  }
  const cycle = 2 * (leg + DWELL);
  const u = (t + worker.phase * 4) % cycle;
  if (u < leg) {
    const p = along(geo, u * speed);
    return { x: p.x, z: p.z, heading: Math.atan2(p.dx, p.dz), moving: true };
  }
  if (u < leg + DWELL) {
    const p = along(geo, geo.total);
    return { x: p.x, z: p.z, heading: Math.atan2(p.dx, p.dz), moving: false };
  }
  if (u < 2 * leg + DWELL) {
    const p = along(geo, geo.total - (u - leg - DWELL) * speed);
    return { x: p.x, z: p.z, heading: Math.atan2(-p.dx, -p.dz), moving: true };
  }
  const p = along(geo, 0);
  return { x: p.x, z: p.z, heading: Math.atan2(-p.dx, -p.dz), moving: false };
};
