/**
 * Looping work poses as joint angles (radians). Conventions: a limb hanging down swings forward with
 * a negative x-rotation; the torso leans forward with a positive one; knees bend with a positive one.
 * Loops are slow and small on purpose — a calm floor, not a busy cartoon.
 */
const S = Math.sin;
const SEATED_LEGS = { lHip: -1.42, rHip: -1.42, lKnee: 1.45, rKnee: 1.45 };
const STANDING = { lHip: 0, rHip: 0, lKnee: 0.04, rKnee: 0.04 };

const base = (over) => ({
  seated: false, lean: 0, twist: 0, headPitch: 0, headYaw: 0, bob: 0, carry: false,
  lSh: -0.05, lRoll: 0.08, rSh: -0.05, rRoll: -0.08, lEl: -0.12, rEl: -0.12,
  ...STANDING, ...over,
});

/** Leg and arm swing for walking at `speed` metres a second. */
export const walkCycle = (t, speed, armsFree) => {
  const w = t * (4.2 + speed * 2.2);
  const s = S(w);
  return {
    lHip: -0.42 * s, rHip: 0.42 * s,
    lKnee: 0.15 + 0.55 * Math.max(0, S(w - 1.2)), rKnee: 0.15 + 0.55 * Math.max(0, -S(w - 1.2)),
    bob: 0.025 * Math.abs(S(w)),
    ...(armsFree ? { lSh: 0.32 * s, rSh: -0.32 * s, lEl: -0.25, rEl: -0.25 } : {}),
  };
};

const ACTIVITIES = {
  sew: (t) => base({
    seated: true, ...SEATED_LEGS, lean: 0.28, headPitch: 0.42,
    lSh: -0.52 + 0.05 * S(6.5 * t), rSh: -0.52 + 0.05 * S(6.5 * t + 1.7), lRoll: 0.14, rRoll: -0.14,
    lEl: -1.18 + 0.07 * S(6.5 * t), rEl: -1.18 + 0.07 * S(6.5 * t + 1.7), rKnee: 1.45 + 0.05 * S(8 * t),
  }),
  'sew-idle': (t) => base({
    seated: true, ...SEATED_LEGS, lean: 0.06, headPitch: 0.05, headYaw: 0.35 * S(0.25 * t),
    lSh: -0.32, rSh: -0.32, lRoll: 0.12, rRoll: -0.12, lEl: -0.95, rEl: -0.95,
  }),
  office: (t) => base({
    seated: true, ...SEATED_LEGS, lean: 0.12, headPitch: 0.12 + 0.05 * S(0.4 * t),
    lSh: -0.55 + 0.03 * S(9 * t), rSh: -0.55 + 0.03 * S(9 * t + 2), lRoll: 0.12, rRoll: -0.12, lEl: -1.0, rEl: -1.0,
  }),
  cut: (t) => base({ lean: 0.38, headPitch: 0.35, lSh: -0.95, rSh: -0.95, lEl: -0.45 + 0.04 * S(18 * t), rEl: -0.45, lRoll: 0.2, rRoll: -0.2 }),
  spread: (t) => base({ lean: 0.32, headPitch: 0.3, lSh: -0.85, rSh: -0.85 + 0.05 * S(2 * t), lEl: -0.3, rEl: -0.3, lRoll: 0.25, rRoll: -0.25 }),
  bundle: (t) => base({
    lean: 0.32, headPitch: 0.4, twist: 0.18 * S(0.9 * t),
    lSh: -0.95 + 0.28 * S(1.8 * t), rSh: -0.95 + 0.28 * S(1.8 * t + Math.PI), lEl: -0.6, rEl: -0.6,
  }),
  inspect: (t) => base({
    lean: 0.12, headPitch: 0.22 + 0.08 * S(0.7 * t),
    lSh: -1.22, rSh: -1.22, lRoll: 0.22 + 0.18 * S(1.4 * t), rRoll: -0.22 - 0.18 * S(1.4 * t), lEl: -0.55, rEl: -0.55,
  }),
  trim: (t) => base({ lean: 0.3, headPitch: 0.5, lSh: -0.85, lEl: -0.75, rSh: -0.8 + 0.12 * S(5 * t), rEl: -0.85 + 0.1 * S(5 * t) }),
  iron: (t) => base({
    lean: 0.26, headPitch: 0.42, lSh: -0.7, lEl: -0.65, lRoll: 0.18,
    rSh: -0.78 + 0.28 * S(1.7 * t), rEl: -0.38 - 0.28 * S(1.7 * t), rRoll: -0.12,
  }),
  fold: (t) => {
    const open = Math.max(0, S(1.5 * t));
    return base({ lean: 0.26, headPitch: 0.4, lSh: -0.9, rSh: -0.9, lEl: -0.7, rEl: -0.7, lRoll: 0.1 + 0.35 * open, rRoll: -0.1 - 0.35 * open });
  },
  tag: (t) => base({ lean: 0.2, headPitch: 0.35, rSh: -1.0 + 0.18 * S(3 * t), rEl: -0.7, lSh: -0.9, lEl: -0.8 }),
  pack: (t) => {
    const bend = Math.max(0, S(1.1 * t));
    return base({ lean: 0.3 + 0.2 * bend, headPitch: 0.35, lSh: -0.95 + 0.25 * S(1.1 * t), rSh: -0.95 + 0.25 * S(1.1 * t), lEl: -0.5, rEl: -0.5 });
  },
  supervise: (t) => base({ headYaw: 0.6 * S(0.32 * t), headPitch: 0.05, rSh: -0.72, rEl: -1.45, rRoll: 0.18, lSh: 0.06 }),
  stand: (t) => base({ lean: 0.02 * S(0.5 * t), headYaw: 0.25 * S(0.22 * t), lSh: 0.04, rSh: 0.04 }),
  drive: () => base({ seated: true, ...SEATED_LEGS, lean: 0.05, lSh: -0.9, rSh: -0.9, lEl: -0.5, rEl: -0.5 }),
  carry: () => base({ lSh: -0.72, rSh: -0.72, lEl: -0.95, rEl: -0.95, lRoll: 0.16, rRoll: -0.16, carry: true }),
  walk: () => base({}),
};

/** The pose of one worker at time `t`; `moving` adds a walk cycle to whatever the arms are doing. */
export const poseFor = (activity, t, moving, speed) => {
  const pose = (ACTIVITIES[activity] || ACTIVITIES.stand)(t);
  if (!moving) return pose;
  const armsFree = activity === 'walk' || activity === 'supervise';
  return { ...pose, ...walkCycle(t, speed, armsFree), seated: false };
};
