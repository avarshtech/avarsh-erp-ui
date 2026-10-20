import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';
import { HOME } from './cameraHome';

const VIEW = new Vector3(0.42, 0.78, 0.85).normalize();
const FLIGHT_S = 1.2;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);

/**
 * Pan with the left button, turn with the right, zoom with the wheel (map-style, like a planning
 * table). `apiRef.current.flyTo(x, z, distance)` glides the camera to a spot; any drag cancels it.
 */
export default function CameraRig({ apiRef, reducedMotion }) {
  const { camera, gl } = useThree();
  const controls = useRef(null);
  const flight = useRef(null);

  useEffect(() => {
    const c = new MapControls(camera, gl.domElement);
    Object.assign(c, { enableDamping: true, dampingFactor: 0.08, screenSpacePanning: false, minDistance: 9, maxDistance: 300, minPolarAngle: 0.2, maxPolarAngle: 1.22, zoomToCursor: true });
    c.target.set(...HOME.target);
    camera.position.set(...HOME.position);
    c.addEventListener('start', () => { flight.current = null; });
    c.update();
    controls.current = c;
    return () => c.dispose();
  }, [camera, gl]);

  useEffect(() => {
    if (!apiRef) return undefined;
    const fly = (target, position) => {
      const c = controls.current;
      if (!c) return;
      flight.current = { t: reducedMotion ? FLIGHT_S : 0, fromT: c.target.clone(), toT: target, fromP: camera.position.clone(), toP: position };
    };
    apiRef.current = {
      flyTo: (x, z, distance = 42) => fly(new Vector3(x, 0, z), new Vector3(x, 0, z).addScaledVector(VIEW, distance)),
      home: () => fly(new Vector3(...HOME.target), new Vector3(...HOME.position)),
    };
    return () => { apiRef.current = null; };
  }, [apiRef, camera, reducedMotion]);

  useFrame((_, delta) => {
    const c = controls.current;
    if (!c) return;
    const f = flight.current;
    if (f) {
      f.t = Math.min(FLIGHT_S, f.t + delta);
      const k = ease(f.t / FLIGHT_S);
      c.target.lerpVectors(f.fromT, f.toT, k);
      camera.position.lerpVectors(f.fromP, f.toP, k);
      if (f.t >= FLIGHT_S) flight.current = null;
    }
    c.target.x = Math.max(-110, Math.min(110, c.target.x));
    c.target.z = Math.max(-70, Math.min(70, c.target.z));
    c.update();
  });
  return null;
}
