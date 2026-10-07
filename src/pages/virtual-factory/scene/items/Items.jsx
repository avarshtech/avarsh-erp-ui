import { useEffect, useMemo } from 'react';
import { MeshStandardMaterial } from 'three';
import { bundleGeometry, cartonGeometry, foldedGeometry, palletGeometry, rollGeometry, teeGeometry } from '../geometry/items';
import { cartonTexture } from '../geometry/textures';
import InstancedItems from './InstancedItems';
import { pose } from './pose';

const HALF_PI = Math.PI / 2;
const placeRoll = (r) => (r.axis === 'x' ? pose(r.x, r.y, r.z, 0, 0, HALF_PI, r.r, r.len, r.r)
  : r.axis === 'z' ? pose(r.x, r.y, r.z, HALF_PI, 0, 0, r.r, r.len, r.r) : pose(r.x, r.y, r.z, 0, 0, 0, r.r, r.len, r.r));
const placeBox = (b) => pose(b.x, b.y, b.z, 0, b.ry || 0, 0);
const placeCarton = (c) => pose(c.x, c.y, c.z, 0, 0, 0, c.w, c.h, c.d);
const placePallet = (p) => pose(p.x, p.y || 0, p.z);
const colourOf = (item) => item.color || '#c9b99a';
const cartonTone = (c) => (c.open ? '#e3c08f' : '#ffffff');

/** Receiving pallets carry rolls still waiting for fabric inspection. */
const palletRolls = (pallets) => pallets.filter((p) => p.rolls).flatMap((p) => Array.from({ length: p.rolls }, (_, i) => ({
  x: p.x, y: (p.y || 0) + 0.32 + Math.floor(i / 3) * 0.32, z: p.z - 0.33 + (i % 3) * 0.33, axis: 'x', len: 1.2, r: 0.16, color: '#e6dcc4', select: p.select,
})));

/** Rolls, bundles, cartons, garments and pallets: each kind is one instanced draw call. */
export default function Items({ model, shadows, onSelect }) {
  const geo = useMemo(() => ({
    roll: rollGeometry(), bundle: bundleGeometry(), carton: cartonGeometry(), tee: teeGeometry(), folded: foldedGeometry(), pallet: palletGeometry(),
  }), []);
  const mat = useMemo(() => ({
    roll: new MeshStandardMaterial({ roughness: 0.92 }),
    bundle: new MeshStandardMaterial({ roughness: 0.95 }),
    carton: new MeshStandardMaterial({ map: cartonTexture(), roughness: 0.85 }),
    cloth: new MeshStandardMaterial({ roughness: 0.95 }),
    pallet: new MeshStandardMaterial({ color: '#b68a5b', roughness: 0.9 }),
  }), []);
  useEffect(() => () => {
    Object.values(geo).forEach((g) => g.dispose());
    Object.values(mat).forEach((m) => m.dispose());
  }, [geo, mat]);

  const rolls = useMemo(() => [...model.rolls, ...palletRolls(model.pallets)], [model.rolls, model.pallets]);
  const flat = useMemo(() => model.garments.filter((g) => g.pose === 'flat'), [model.garments]);
  const stacks = useMemo(() => model.garments.filter((g) => g.pose !== 'flat'), [model.garments]);

  return (
    <group>
      <InstancedItems items={rolls} geometry={geo.roll} material={mat.roll} place={placeRoll} colourOf={colourOf} castShadow={shadows} onSelect={onSelect} />
      <InstancedItems items={model.bundles} geometry={geo.bundle} material={mat.bundle} place={placeBox} colourOf={colourOf} castShadow={shadows} />
      <InstancedItems items={model.cartons} geometry={geo.carton} material={mat.carton} place={placeCarton} colourOf={cartonTone} castShadow={shadows} receiveShadow />
      <InstancedItems items={flat} geometry={geo.tee} material={mat.cloth} place={placeBox} colourOf={colourOf} />
      <InstancedItems items={stacks} geometry={geo.folded} material={mat.cloth} place={placeBox} colourOf={colourOf} castShadow={shadows} />
      <InstancedItems items={model.pallets} geometry={geo.pallet} material={mat.pallet} place={placePallet} receiveShadow />
    </group>
  );
}
