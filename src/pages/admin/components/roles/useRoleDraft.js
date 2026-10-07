import { useMemo, useState } from 'react';
import { diffPermissions, fromStored } from './permissionMatrixModel';

/**
 * The rights being edited. `baseline` is what the role holds now — nothing, for a new role — and
 * the draft starts from `initial` (a duplicated role starts from its source's rights). The changes
 * are derived, never stored, so they cannot drift from the boxes on screen.
 */
const useRoleDraft = (baseline, initial, screens) => {
  const snapshot = useMemo(() => fromStored(baseline), [baseline]);
  const [permissions, setPermissions] = useState(() => fromStored(initial));
  const changes = useMemo(() => diffPermissions(snapshot, permissions, screens), [snapshot, permissions, screens]);
  return { permissions, setPermissions, changes };
};

export default useRoleDraft;
