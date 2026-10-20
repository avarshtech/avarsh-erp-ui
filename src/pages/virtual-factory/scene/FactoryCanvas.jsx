import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import Beacons from './alerts/Beacons';
import Boards from './boards/Boards';
import FloorMarks from './building/FloorMarks';
import Ground from './building/Ground';
import Shell from './building/Shell';
import ZoneSigns from './building/ZoneSigns';
import CameraRig from './CameraRig';
import { HOME } from './cameraHome';
import WorkerCrowd from './crowd/WorkerCrowd';
import Movers from './effects/Movers';
import SelectionRing from './effects/SelectionRing';
import Steam from './effects/Steam';
import StitchRoute from './effects/StitchRoute';
import CuttingTables from './furniture/CuttingTables';
import SewingLines from './furniture/SewingLines';
import StaticFurniture from './furniture/StaticFurniture';
import Items from './items/Items';
import Lighting from './Lighting';
import Machines from './machines/Machines';
import { QUALITY } from './quality';
import { targetPosition } from './targets';
import Forklifts from './vehicles/Forklifts';
import Trucks from './vehicles/Trucks';

/**
 * The factory in 3D, drawn entirely from the scene model. Graphics quality remounts the canvas;
 * reduced motion freezes the loops and skips movers; `paused` (a drawer is open) stops drawing.
 */
export default function FactoryCanvas({ model, events, night, quality, reducedMotion, paused, selection, highlightZone, cameraApi, labelsRef, onSelect }) {
  const q = QUALITY[quality] || QUALITY.balanced;
  const animate = !reducedMotion;
  const target = useMemo(() => targetPosition(selection, model), [selection, model]);
  return (
    <Canvas
      key={quality}
      shadows={q.shadows ? 'percentage' : false}
      frameloop={paused ? 'demand' : 'always'}
      dpr={q.dpr}
      flat
      camera={{ fov: 36, near: 0.5, far: 1500, position: HOME.position }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => onSelect(null)}
    >
      <Lighting night={night} shadows={q.shadows} shadowSize={q.shadowSize} />
      <CameraRig apiRef={cameraApi} reducedMotion={reducedMotion} />
      <Ground night={night} />
      <Shell night={night} />
      <FloorMarks night={night} highlight={highlightZone} />
      <ZoneSigns zones={model.zones} onSelect={onSelect} />
      <StaticFurniture night={night} inspecting={model.inspecting} />
      <SewingLines lines={model.sewingLines} night={night} animate={animate} />
      <CuttingTables tables={model.cuttingTables} workers={model.workers} night={night} animate={animate} onSelect={onSelect} />
      <Machines machines={model.machines} chairs={model.chairs} animate={animate} shadows={q.shadows} night={night} onSelect={onSelect} />
      <Items model={model} shadows={q.shadows} onSelect={onSelect} />
      <WorkerCrowd workers={model.workers} hz={animate ? q.crowdHz : 0} shadows={q.shadows} onSelect={onSelect} />
      <Forklifts workers={model.workers} shadows={q.shadows} animate={animate} />
      <Boards boards={model.boards} onSelect={onSelect} />
      <Beacons beacons={model.beacons} animate={animate} labelsRef={labelsRef} onSelect={onSelect} />
      <Trucks trucks={model.trucks} shadows={q.shadows} animate={animate} labelsRef={labelsRef} onSelect={onSelect} />
      <Steam points={model.steam} animate={animate} />
      {animate && <Movers events={events} model={model} ambient={q.ambient} shadows={q.shadows} labelsRef={labelsRef} />}
      <StitchRoute route={model.route} animate={animate} />
      <SelectionRing target={target} animate={animate} />
    </Canvas>
  );
}
