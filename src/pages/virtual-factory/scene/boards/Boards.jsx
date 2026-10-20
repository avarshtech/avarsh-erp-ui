import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide } from 'three';
import { boardTexture, drawBoard } from '../geometry/textures';
import { pointerHandlers } from '../interaction';

const SIZES = { line: [2.7, 1.58], small: [1.7, 0.96], wide: [7.2, 3.6] };

function Board({ board, onSelect }) {
  const size = board.wide ? 'wide' : board.small ? 'small' : 'line';
  const [w, h] = SIZES[size];
  const texture = useMemo(() => boardTexture(size), [size]);
  useEffect(() => () => texture.dispose(), [texture]);
  // New figures repaint the same canvas; the texture is only replaced when the board changes size.
  const content = JSON.stringify([board.title, board.subtitle, board.rows, board.tone, board.badge]);
  useLayoutEffect(() => {
    const [title, subtitle, rows, tone, badge] = JSON.parse(content);
    drawBoard(texture, { title, subtitle, rows, tone, badge });
  }, [texture, content]);
  const group = useRef(null);
  useFrame(({ camera }) => {
    const g = group.current;
    if (g && !board.wide) g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
  });
  const handlers = pointerHandlers(() => board.select, onSelect, { hover: true });
  return (
    <group ref={group} position={[board.x, board.y, board.z]}>
      <mesh {...handlers}>
        <planeGeometry args={[w, h]} />
        <meshBasicMaterial map={texture} toneMapped={false} side={DoubleSide} transparent />
      </mesh>
      {!board.wide && (
        <mesh position={[0, -board.y / 2 - h / 4, -0.02]}>
          <cylinderGeometry args={[0.035, 0.035, board.y - h / 2, 6]} />
          <meshStandardMaterial color="#59636e" metalness={0.4} />
        </mesh>
      )}
    </group>
  );
}

/** Line andon boards, cutting-table tags, relaxation timers and the office order board. */
export default function Boards({ boards, onSelect }) {
  return boards.map((board) => <Board key={board.key} board={board} onSelect={onSelect} />);
}
