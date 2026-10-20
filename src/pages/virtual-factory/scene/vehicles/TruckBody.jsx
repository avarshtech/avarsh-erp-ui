/** One vehicle drawn from shared geometries; the parent places and turns it. */
export default function TruckBody({ geometries, livery, shadows, handlers }) {
  return (
    <group>
      <mesh geometry={geometries.gear} castShadow={shadows} {...handlers}>
        <meshStandardMaterial color="#2b3038" roughness={0.7} />
      </mesh>
      <mesh geometry={geometries.cab} castShadow={shadows} {...handlers}>
        <meshStandardMaterial color={livery.cab} roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh geometry={geometries.glass}>
        <meshStandardMaterial color="#1f2a38" roughness={0.15} metalness={0.4} />
      </mesh>
      {geometries.container && (
        <mesh geometry={geometries.container} castShadow={shadows} receiveShadow {...handlers}>
          <meshStandardMaterial color={livery.container} roughness={0.6} />
        </mesh>
      )}
      <mesh geometry={geometries.stripe}>
        <meshStandardMaterial color={livery.stripe} roughness={0.5} />
      </mesh>
    </group>
  );
}
