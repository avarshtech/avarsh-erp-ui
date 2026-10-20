/**
 * Day shift or night shift (the ERP's dark mode): sky, fog and one sun or moon that casts the shadows.
 */
const PALETTE = {
  day: { sky: '#e9eef3', fogNear: 220, fogFar: 620, hemiTop: '#ffffff', hemiBottom: '#c8cec4', hemi: 1.15, sun: '#fff4e2', sunI: 2.1, ambient: 0.35 },
  night: { sky: '#0d131b', fogNear: 170, fogFar: 480, hemiTop: '#6a7ea6', hemiBottom: '#141a22', hemi: 0.95, sun: '#b9cbe8', sunI: 0.85, ambient: 0.38 },
};

export default function Lighting({ night, shadows, shadowSize }) {
  const p = night ? PALETTE.night : PALETTE.day;
  return (
    <>
      <color attach="background" args={[p.sky]} />
      <fog attach="fog" args={[p.sky, p.fogNear, p.fogFar]} />
      <hemisphereLight args={[p.hemiTop, p.hemiBottom, p.hemi]} />
      <ambientLight intensity={p.ambient} />
      <directionalLight
        position={[70, 115, 65]}
        intensity={p.sunI}
        color={p.sun}
        castShadow={shadows}
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={70}
        shadow-camera-bottom={-70}
        shadow-camera-near={10}
        shadow-camera-far={320}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
      />
    </>
  );
}
