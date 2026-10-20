/** Graphics presets: what the scene spends on sharpness, shadows and animation. */
export const QUALITY = {
  high: { label: 'High', dpr: [1, 2], shadows: true, shadowSize: 2048, crowdHz: 30, ambient: true },
  balanced: { label: 'Balanced', dpr: [1, 1.5], shadows: true, shadowSize: 1024, crowdHz: 24, ambient: true },
  saver: { label: 'Battery saver', dpr: [1, 1], shadows: false, shadowSize: 512, crowdHz: 10, ambient: false },
};

export const QUALITY_OPTIONS = Object.entries(QUALITY).map(([value, q]) => ({ value, label: q.label }));

/** Balanced on most machines; battery saver where the processor has four threads or fewer. */
export const defaultQuality = () => {
  const cores = typeof navigator === 'undefined' ? 8 : navigator.hardwareConcurrency || 8;
  return cores <= 4 ? 'saver' : 'balanced';
};
