import { hashString, pick, seeded } from '../util.js';

/** Skin and hair across an Indian garment workforce; picked per worker from a stable seed. */
const SKIN = ['#8d5524', '#a1673a', '#b97a4c', '#c68a5a', '#9a6339', '#7c4a28', '#d19a6a', '#b0764a'];
const HAIR = ['#1b1410', '#241a12', '#2e2118', '#141414', '#3a2a1e'];

/** Department uniforms: the colour tells a manager at a glance who works where. */
export const UNIFORMS = {
  cutting: { shirt: '#4c6eb1', pants: '#2f3b52', cap: '#3a578f', women: 0.25 },
  sewing: { shirt: '#2e8c86', pants: '#33414d', cap: null, women: 0.78 },
  helper: { shirt: '#6aa9a3', pants: '#33414d', cap: null, women: 0.5 },
  supervisor: { shirt: '#1f2a37', pants: '#5a6270', cap: null, women: 0.3 },
  qc: { shirt: '#eef1f5', pants: '#4a4f5a', cap: '#7a5ba6', women: 0.6 },
  finishing: { shirt: '#d9922e', pants: '#3d3a36', cap: null, women: 0.65 },
  packing: { shirt: '#5e9a4b', pants: '#33402f', cap: null, women: 0.45 },
  store: { shirt: '#e3c14b', pants: '#3b3f46', cap: '#e3c14b', women: 0.15 },
  shipping: { shirt: '#3e5c76', pants: '#283543', cap: '#e3c14b', women: 0.1 },
  office: { shirt: '#5b6573', pants: '#2b3038', cap: null, women: 0.5 },
};

export const DEPARTMENT_LABELS = {
  cutting: 'Cutting', sewing: 'Sewing operator', helper: 'Line helper', supervisor: 'Line supervisor',
  qc: 'QC inspector', finishing: 'Finishing', packing: 'Packing', store: 'Store & material handling',
  shipping: 'Loading & dispatch', office: 'Merchandising & planning',
};

const shade = (hex, amount) => {
  const n = parseInt(hex.slice(1), 16);
  const ch = (shift) => Math.max(0, Math.min(255, Math.round(((n >> shift) & 255) * (1 + amount))));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
};

/**
 * One person on the floor. `activity` picks the looping pose (sew, cut, spread, inspect, iron,
 * fold, pack, carry, walk, supervise…); `path` makes them walk; `label`/`name` feed the inspector.
 */
export const makeWorker = (key, dept, activity, position, extra = {}) => {
  const rand = seeded(hashString(key));
  const uniform = UNIFORMS[dept] || UNIFORMS.helper;
  const woman = rand() < uniform.women;
  return {
    key,
    dept,
    activity,
    x: position[0],
    y: position[1] ?? 0,
    z: position[2],
    ry: position[3] ?? 0,
    skin: pick(rand, SKIN),
    hair: pick(rand, HAIR),
    hairStyle: woman ? (rand() < 0.55 ? 'bun' : 'braid') : 'short',
    shirt: shade(uniform.shirt, (rand() - 0.5) * 0.12),
    pants: uniform.pants,
    cap: uniform.cap,
    phase: rand() * 10,
    tempo: 0.85 + rand() * 0.3,
    role: DEPARTMENT_LABELS[dept] || 'Worker',
    ...extra,
  };
};
