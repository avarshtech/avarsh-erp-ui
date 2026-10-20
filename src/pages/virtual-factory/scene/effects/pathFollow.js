const cache = new WeakMap();

const lengthsOf = (path) => {
  let lengths = cache.get(path);
  if (!lengths) {
    lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1], p[2] - path[i][2]));
    cache.set(path, lengths);
  }
  return lengths;
};

const headingOf = (a, b) => Math.atan2(b[0] - a[0], b[2] - a[2]) + (b[3] === 'reverse' ? Math.PI : 0);

/**
 * Where a mover is `t` seconds after it set off along `spec.path` ([x, y, z, flag] points) at
 * `spec.speed` m/s: it may wait at a point (`spec.waits[index]` seconds), back into the last point of a
 * segment flagged 'reverse', and hold at the end for `spec.hold` seconds before it is done.
 */
export const followPath = (spec, t) => {
  const { path } = spec;
  const lengths = lengthsOf(path);
  let time = t;
  let heading = path.length > 1 ? headingOf(path[0], path[1]) : 0;
  for (let i = 0; i < lengths.length; i += 1) {
    const wait = spec.waits?.[i] || 0;
    if (time < wait) return { x: path[i][0], y: path[i][1], z: path[i][2], heading, done: false };
    time -= wait;
    const duration = lengths[i] / spec.speed;
    heading = headingOf(path[i], path[i + 1]);
    if (time < duration) {
      const f = duration ? time / duration : 1;
      const [ax, ay, az] = path[i];
      const [bx, by, bz] = path[i + 1];
      return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, z: az + (bz - az) * f, heading, done: false };
    }
    time -= duration;
  }
  const last = path[path.length - 1];
  return { x: last[0], y: last[1], z: last[2], heading, done: time >= (spec.hold || 0) };
};
